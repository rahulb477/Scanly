# Fixing “Access denied. Check your business membership or ask the administrator to deploy the Firestore security rules.”

Date: 2026-10-02. Branch: `arena/01a0fd41-scanly`. The application was **not** rebuilt; only
`firestore.rules`, `storage.rules`, `src/lib/firebase/profile.ts`, the sign-in sequencing in
`src/components/auth/AuthProvider.tsx`, a comment in `src/app/api/auth/session/route.ts`, plus a
new env check script and a new unit test were changed.

## 1. Inventory of every Firestore access in the codebase

Grepping `getDoc|getDocs|setDoc|addDoc|updateDoc|deleteDoc|query|where|collection|doc|onSnapshot`
and `import … from "firebase/firestore"` shows that the **Firebase Web SDK touches exactly one
Firestore path**:

| Flow | File | Path | Operation |
| --- | --- | --- | --- |
| Signup / Login / Retry setup | `src/lib/firebase/profile.ts` (`ensureUserProfile`) | `users/{uid}` | `runTransaction`: `transaction.get` → `set` (new) or `update` (existing) |

Everything else runs **server-side with the Firebase Admin SDK**, which bypasses security rules
entirely (verified: `firebase/firestore` is imported only by `src/lib/firebase/client.ts` and
`src/lib/firebase/profile.ts`):

| Flow | Server module | Paths |
| --- | --- | --- |
| Session + profile repair | `src/app/api/auth/session/route.ts` | `users/{uid}` |
| Dashboard init / membership lookup | `src/lib/data/repository.ts` (`getBusinessesForUser`) | `businesses` where `ownerId == uid`, collection-group `members` where `uid == uid` |
| Business creation | `createBusiness` | `businesses/{id}`, `businessSlugs/{slug}`, `businesses/{id}/members/{uid}` (`role: "owner"`), `…/qrCodes/main`, `…/wifiSettings/default`, `…/reviewSettings/default`, `…/themes/default`, `…/socialLinks/{field}`, `publicBusinesses/{slug}` |
| Membership check | `requireBusinessAccess` | `businesses/{id}/members/{uid}` (`role ∈ owner\|admin\|staff`) |
| Menu | `getMenu`, `createMenuEntry`, … | `businesses/{id}/menuCategories/{id}`, `…/menuItems/{id}`, `…/_meta/{counter}` |
| Public page `/b/{slug}` | `getBusinessBySlug` | `businessSlugs/{slug}` → `businesses/{id}` |
| Analytics / activity / AI review | `/api/track`, `/api/ai/review` | `…/analytics/{id}`, `…/activityLogs/{id}`, `…/reviewSessions/{id}` |
| Rate limiting / health | `src/lib/ratelimit.ts`, `/api/health` | `_rateLimits/{hash}`, `_health/connectivity` |

**So the only request that can ever return `permission-denied` in the browser is the
`users/{uid}` write in `ensureUserProfile`.** The message the user sees is
`messages["permission-denied"]` in `src/lib/firebase/errors.ts` — a *raw Firestore client error
code*, not an API error (the API never returns that code; see `apiErrorResponse`).

## 2. Exact rule that was wrong

`match /users/{uid}` previously required, for **both** create and update:

```
function validProfile(uid) {
  let d = request.resource.data;
  return d.keys().hasOnly([...]) &&
    d.uid == uid && d.role == 'user' && d.name is string && d.name.size() <= 200 &&
    d.email is string && d.email == request.auth.token.email &&           // (a)
    (d.photoURL == null || (d.photoURL is string && d.photoURL.size() <= 2048));
}
allow create: … && validProfile(uid) && timestampsOnCreate();              // (b)
allow update: … && validProfile(uid) && timestampsOnUpdate();              // (b)
```

Defects that deny a *legitimate* sign-in:

* **(a) `request.auth.token.email`** — reading a claim that is absent from the ID token raises an
  evaluation error, and the rules engine converts any evaluation error into `permission-denied`.
  It is also case-sensitive against the profile value. Any user whose token carries no `email`
  claim, or a differently-cased one, can never create or refresh their own profile.
* **(b) Exact `== request.time` equality** on `createdAt`/`updatedAt`, and the hard-coded
  `role == 'user'` on *update*: a profile whose timestamps or role were written by anything other
  than this exact client transaction (the Admin repair path, the migration importer, a manual
  console edit) becomes permanently unwritable by its own owner.
* The business tree also contained two latent evaluation errors that fail closed to
  `permission-denied`: `business(id)` dereferenced `get(…).data` without an existence check (a missing
  or deleted business document aborts the whole rule), and the public menu rule read
  `resource.data.available`, a field `menuItemSchema` does not require on create.
* Finally, the practical production cause: **these rules only take effect once they are
  deployed.** A Firebase project still on its default locked/expired test rules denies the
  `users/{uid}` write no matter what this file says.

## 3. Exact change

`firestore.rules` now uses null-safe, default-safe helpers and a tolerant-but-strict profile rule:

```
function isSignedIn() { return request.auth != null; }
function isUser(uid)  { return isSignedIn() && request.auth.uid == uid; }
function businessField(id, key, fallback) {
  return exists(businessPath(id)) ? get(businessPath(id)).data.get(key, fallback) : fallback;
}
function membershipRole(id) { … returns '' instead of reading a missing document … }
function isOwner(id)  { return isSignedIn() && businessField(id, 'ownerId', '') == request.auth.uid; }
function isMember(id) { return isOwner(id) || membershipRole(id) in ['owner','admin','staff']; }
function isAdmin(id)  { return isOwner(id) || membershipRole(id) in ['owner','admin']; }

match /users/{uid} {
  allow get:    if isUser(uid);
  allow list:   if false;
  allow create: if isUser(uid) && profileShape(uid) && request.resource.data.get('role','user') == 'user';
  allow update: if isUser(uid) && profileShape(uid) &&
    request.resource.data.get('role','user')    == resource.data.get('role','user') &&
    request.resource.data.get('createdAt', null) == resource.data.get('createdAt', null);
  allow delete: if false;
}
```

`profileShape` keeps the key allowlist, the `uid == uid` binding, the length limits and the
anti-spoofing email check, but reads the claim safely and case-insensitively
(`d.email.lower() == request.auth.token.get('email', '').lower()`) and accepts any
`is timestamp` value instead of demanding `== request.time`.

Security is unchanged or stronger: a user can still only read/write **their own** profile,
cannot list other profiles, cannot delete, cannot add unknown keys, cannot escalate `role`, and
cannot claim an email the verified token does not carry. Nowhere in either rules file is there
an `if true`; both end with `match /{document=**} { allow read, write: if false; }`.

Other changes in `firestore.rules`:

* public (unauthenticated) read for the published surfaces used by `/b/{slug}`:
  `publicBusinesses/{slug}` (allowlisted projection only), `menuCategories`/`menuItems`
  (`menuIsPublic(id)` + `available == true`), `socialLinks` with a non-null url, `themes`
  (appearance), `qrCodes` (the `/b/{stableSlug}` destination);
* private data stays private: `wifiSettings` (holds `wifiPassword`), `analytics`,
  `activityLogs` and `reviewSessions` are owner/admin-only, never staff for the last three, never
  customers; `members` is readable only by members and writable only by the owner (who can never
  demote or delete themselves);
* every client write to business data remains `if false` — all mutation, menu CRUD/reorder,
  analytics event creation and the anonymous AI review flow go through token-verified API routes,
  so customers cannot forge, update or delete analytics, and the anonymous review flow needs no
  Firebase account at all.

`storage.rules` was given the same null-safe helpers and still validates authentication,
ownership/membership, content type (`jpeg|png|webp`), size (≤ 5 MB) and file name; public read is
limited to `logos`, `covers` and `menu` of a published, non-deleting business; the rest of the
bucket is `read, write: if false`.

## 4. Application change (not a message change)

`ensureUserProfile` is a convenience write; the authoritative profile create/repair already
happens in `POST /api/auth/session` with the Admin SDK after verifying the ID token. The order is
now **session route first, client profile sync second**, and a `permission-denied` from that
single client write is logged with the exact deploy command instead of aborting login. The raw
Firestore error for any other failure is still surfaced unchanged, and the “Retry setup” banner
still works.

## 5. Deploying the rules

```bash
# one-time
npm i -g firebase-tools          # or use the local devDependency: npx firebase …
firebase login

# verify the environment points at the project you are about to deploy to
vercel env pull .env.local       # optional, to check the deployed values
node --env-file=.env.local scripts/check-firebase-env.mjs

# deploy
firebase deploy --only firestore:rules   --project <YOUR_FIREBASE_PROJECT_ID>
firebase deploy --only firestore:indexes --project <YOUR_FIREBASE_PROJECT_ID>
firebase deploy --only storage           --project <YOUR_FIREBASE_PROJECT_ID>

# or all three
FIREBASE_PROJECT_ID=<YOUR_FIREBASE_PROJECT_ID> npm run deploy:rules
```

`firebase deploy` validates the rules syntax server-side and refuses to publish an invalid file.

In CI, use `firebase deploy --only firestore:rules --project <id> --token "$FIREBASE_TOKEN"` or a
service account via `GOOGLE_APPLICATION_CREDENTIALS`.

## 6. Checking production environment variables

`scripts/check-firebase-env.mjs` fails if any of
`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
`NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
`NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` is missing, if the
server-side `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` are missing
or malformed, if the auth domain or storage bucket belongs to a different project, or if emulator
mode is enabled for a non-`demo-` project. **The Vercel project must use the same
`NEXT_PUBLIC_FIREBASE_PROJECT_ID` as the project the rules are deployed to**; `src/lib/firebase/admin.ts`
already refuses to start when the web and admin project ids differ.

## 7. Verification performed here, and what still has to be run against the live project

| Check | Result |
| --- | --- |
| `npm run lint` | passed |
| `npm run typecheck` | passed |
| `npm run build` | passed (Next.js 16.3.8 production build) |
| `npm test` (unit) | 61/61 passed, including the new `tests/unit/security-rules.test.ts` |
| `npm run test:integration` / `test:e2e` | **could not run in this sandbox** — the Firebase emulator jar is fetched from `storage.googleapis.com`, which is not reachable from this network (`Failed to make request to https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v1.22.0.jar`) |
| `firebase deploy --only firestore:rules` | **could not run in this sandbox** — all `*.googleapis.com` / `*.google.com` hosts are blocked, and no Firebase credentials are available here |

The rules therefore still have to be deployed and exercised against the real project by someone
with console access, using the commands in section 5, then:

1. new signup → 2. `users/{uid}` created → 3. login → 4. retry setup → 5. business creation →
6. membership document → 7. dashboard → 8. business profile → 9. menu → 10. QR → 11. appearance →
12. social links → 13. analytics → 14. logout → 15. login again, plus User A attempting to open
Business B (must stay denied; `requireBusinessAccess` returns 403 and the rules deny the read).

`npm run test:all` (54 unit + integration + Playwright) covers exactly this matrix against the
emulators and should be run on a machine that can reach `storage.googleapis.com`.
