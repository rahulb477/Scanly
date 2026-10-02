# Production login failure: root cause and fix

> **Security review update (2026-10-02, 18:44 UTC):** The live production diagnostic returned successful Google token exchange, Firebase Auth `listUsers`, and Firestore read checks. This confirms the credential currently deployed in production is operational; it does **not** prove that the previously exposed key has been revoked in Google IAM. The temporary unauthenticated diagnostic endpoint and its write-enabled probe workflow have since been removed. Measurements and instructions below are historical.

Target: `https://scanly-jade.vercel.app` (project `restaurant-flow-59183`).

## 1. Symptom

After a successful `signInWithEmailAndPassword()` the browser showed:

> You are signed in to Firebase, but profile or dashboard setup did not finish.
> The server returned an unexpected response. Ask the administrator to check the server configuration.

## 2. Root cause (measured, not guessed)

`POST /api/auth/session` never ran. It returned **HTTP 500 with `content-length: 0`** — no JSON, which is
why `requestJson` reported an "unexpected response" instead of a Firebase message.

Every server-side route failed identically (`/api/health`, `/api/menu/public`, `/api/public/[slug]/wifi`,
`/dashboard`), while prerendered pages (`/`, `/login`, `/register`) were fine. So no Node serverless
function could execute.

`/api/diagnostics/firebase` (added in this fix) reported the real error:

```
import:firebase-admin/auth -> ERR_REQUIRE_ESM:
require() of ES Module /var/task/node_modules/jose/dist/webapi/index.js
from /var/task/node_modules/jwks-rsa/src/utils.js not supported.
```

Chain: `firebase-admin@14.5.0` → `jwks-rsa@4.1.0` → `jose@6` (ESM-only, `"type": "module"`).
`jwks-rsa` is CommonJS and does `require('jose')`. Under Turbopack's external-module loader on Vercel
that throws while the module is loading — before any route handler exists — so the function died with an
empty 500. It reproduced only on Vercel: the same build on Node 22 locally loaded fine.

Firebase Authentication was never the problem, and Firestore security rules were never involved — the
request never reached application code.

## 3. Fixes applied

| Change | File |
| --- | --- |
| Force `jwks-rsa` to use `jose@^5.10.0` (ships a CJS entry). `jwks-rsa` only uses `importJWK`/`exportSPKI`, both present in v5. `firebase-tools` keeps jose v6. | `package.json` (`overrides`) |
| Staged failure handling: configuration → ID-token verification → Firestore profile → session cookie, each with its own production-safe message and the real error logged server-side. | `src/app/api/auth/session/route.ts` |
| Admin app reuse per process (no duplicate `initializeApp`), `\n`-escaped private-key normalisation that leaves valid multiline keys untouched, PEM validation via `crypto.createPrivateKey`, project-match check. | `src/lib/firebase/admin.ts` |
| Credentials recovered from a service-account JSON pasted into `FIREBASE_PRIVATE_KEY` (JSON parse, plus pattern extraction when the paste is pretty-printed), including the `client_email` fallback. | `src/lib/firebase/admin.ts` |
| Scrubbed structured server logging (redacts PEM blocks, JWTs, service-account emails). | `src/lib/server-log.ts` |
| Read-only, sanitised production diagnostic endpoint. | `src/app/api/diagnostics/firebase/route.ts` |
| Non-JSON responses now report the HTTP status instead of a generic message. | `src/lib/http-client.ts`, `src/lib/firebase/authenticated-fetch.ts` |
| Profile create/repair is idempotent: "Retry setup" never duplicates users/businesses/memberships and never overwrites name or role. | `src/app/api/auth/session/route.ts` |

No Firestore rule was loosened and `signInWithEmailAndPassword` is unchanged.

## 4. Result after the fix (production)

| Endpoint | Before | After |
| --- | --- | --- |
| `POST /api/auth/session` (invalid token) | 500, empty body | **401 JSON** `{"error":"Authentication session could not be verified."}` |
| `GET /api/health` | 500, empty body | **500 JSON** (the route runs; the remaining error is the credential below) |
| `GET /dashboard` (no cookie) | 500 | **307 → /login** |
| `import:firebase-admin/auth` | `ERR_REQUIRE_ESM` | **ok** |
| `credentials:parse-private-key` | (never reached) | **ok** |

## 5. Remaining blocker (needs action in Vercel)

The service-account credentials stored in Vercel are rejected by Google:

```
auth:listUsers -> invalid_grant: Invalid JWT Signature
firestore:read -> 16 UNAUTHENTICATED
```

`FIREBASE_PRIVATE_KEY` currently holds a whole service-account JSON object
(`looksLikeJson: true`, `hasEscapedNewlines: true`, length 2402) and `FIREBASE_CLIENT_EMAIL` is not a
service-account address (now auto-recovered from the JSON). The recovered account is
`restaurant-flow-59183`, the correct project, and the PEM parses — so the key itself is stale: it was
revoked/deleted, or it does not belong to that service account.

Fix: Firebase Console → Project settings → Service accounts → **Generate new private key**, then set in
Vercel (Production environment) and redeploy:

```
FIREBASE_CLIENT_EMAIL = <client_email from the downloaded JSON>
FIREBASE_PRIVATE_KEY  = <private_key PEM from the same JSON>   # the whole JSON also works
```

Verify with `https://scanly-jade.vercel.app/api/diagnostics/firebase` — it must report `"ok": true`
with `firestore:read` and `auth:listUsers` both `ok`.

## 6. Current production measurement — 2026-10-02 18:06 UTC

Read live from `https://scanly-jade.vercel.app/api/diagnostics/firebase` (deployment
`7897f4c`, `VERCEL_ENV=production`). Nothing here is inferred — it is the deployed
function reporting on itself.

| Check | Result |
| --- | --- |
| `NEXT_PUBLIC_*` Web config (all six) | present |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | present |
| `NEXT_PUBLIC_APP_URL` | present |
| Admin project vs Web project | `restaurant-flow-59183` = `restaurant-flow-59183` → **match** |
| Service-account project recovered from the credential | `restaurant-flow-59183` → **match** |
| `credentials:parse-private-key` (PEM header/footer + DER parse) | **ok** |
| `admin:getFirebaseAdminApp` / `getAdminAuth` / `getAdminDb` | **ok** — one app, reused |
| **`auth:listUsers` (live Google call)** | **failed** — `app/invalid-credential`: `invalid_grant: Invalid JWT Signature` |
| **`firestore:read` (live Google call)** | **failed** — `16 UNAUTHENTICATED` |
| Server clock | `18:06:43Z` vs client `18:09:25Z` → **in sync**, so cause (1) in Google's error text is ruled out |

Ruled out by measurement, not by assumption: A (header missing — the browser sends
`Bearer`), C and F (project mismatch — ids are identical), D (the PEM parses, so the
key is well-formed), G (Admin initialises cleanly), J (every variable is present),
and clock skew. What remains is the one thing Google itself states: the service-account
key in Vercel is **revoked, deleted, or does not belong to the configured
`client_email`** (cause (2) in Google's error text: *"make sure the key ID for your key
file is still present"*).

## 7. Why that surfaces as "Authentication session could not be verified."

`POST /api/auth/session` calls `auth.verifyIdToken(token, true)`. The `true` is
`checkRevoked`, which must call the Firebase Auth backend — and that call needs a valid
service-account OAuth2 token. Google rejects the key, so `verifyIdToken` throws
`app/invalid-credential` **before the ID token is ever judged**. The route previously
collapsed every non-token error into one message, which is why a dead server credential
looked like a bad user token.

The route now classifies it: a rejected credential is logged as
`classification=firebase-admin-credential-rejected` and answered with
`503 firebase/admin-credential-invalid`, while a genuinely expired ID token stays
`401 auth/user-token-expired`. Regression tests: `tests/unit/auth-session-verification.test.ts`.

## 8. The one remaining action (Vercel — cannot be done from the repository)

1. Firebase Console → **restaurant-flow-59183** → Project settings → Service accounts →
   **Generate new private key** (a *new* key; never re-use the one that was exposed).
2. Vercel → Scanly → Settings → Environment Variables → **Production**:
   - `FIREBASE_CLIENT_EMAIL` = `client_email` from the downloaded JSON
   - `FIREBASE_PRIVATE_KEY` = the `private_key` PEM from the **same** JSON
     (the whole JSON also works: the app extracts the PEM and the email from it)
3. **Redeploy.** Vercel bakes environment variables into a deployment, so changing them
   without a new deployment leaves the old key running.

## 9. Verification

`https://scanly-jade.vercel.app/api/diagnostics/firebase` must report:

```json
"ok": true,
"failingSteps": [],
"verdict": { "loginCanSucceed": true, "credentialRejectedByGoogle": false, "requiredAction": "None. ..." }
```

with `credentials:access-token`, `auth:listUsers` and `firestore:read` all `ok`. Then sign in
at `https://scanly-jade.vercel.app/login`: Firebase Auth → `getIdToken(true)` →
`POST /api/auth/session` → `verifyIdToken` → profile → dashboard.
