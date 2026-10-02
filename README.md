# Scanly — QR Customer Engagement SaaS

The existing Next.js application has been migrated **in place** to Firebase Authentication, Firestore and Firebase Storage. The dashboard, onboarding, public customer page, menus, themes, analytics and printable QR UI are retained. PostgreSQL is now **legacy migration tooling only**, not an application/authentication dependency.

> **Security action required:** the service-account private key shared in the request is exposed. Revoke that key in Google Cloud **IAM & Admin → Service Accounts → the account → Keys**, review its usage, and issue a replacement. That key was not saved, tested or used here. Never paste the replacement into chat or commit it. A personal Gmail address is not a service-account `client_email`.

## 1. What caused “Network error”?

The unchanged login/register API modules imported `src/db/index.ts`, which threw `DATABASE_URL is required` before their handlers ran. Both POSTs returned **500 HTML**, not JSON. The forms blindly called `res.json()`; the resulting `Unexpected token '<'` error was caught and mislabeled “Network error.” The checked-in loopback PostgreSQL example also returned `ECONNREFUSED` when tested. This was reproduced, not inferred from the toast. See [the pre-change audit](docs/auth-audit.md) for commands, file inventory and deployment limitations.

The new forms call the Firebase Web SDK directly, map Firebase error codes centrally and distinguish credentials, duplicate accounts, password policy, connectivity, missing configuration and API failures.

## 2. Authentication architecture

```text
Firebase Web Auth (email/password; optional Google)
  → onAuthStateChanged / AuthProvider / useAuth
  → users/{Firebase UID} profile in Firestore
  → Firebase ID token in Authorization: Bearer …
  → Next.js API verifies token + revocation with Firebase Admin
  → authorize owner/member against Firestore (never a frontend role/userId)
  → application data operation
```

For the existing **server-rendered** dashboard, `/api/auth/session` exchanges a verified ID token for a **Firebase-generated session cookie** (`scanly_firebase_session`). It is httpOnly, SameSite=Lax, Secure in production and expires after five days. Server pages verify the cookie **with revocation checking**. This is an SSR transport for Firebase identity, not a second authentication system or a custom sessions table. Protected APIs require bearer tokens, not that cookie. Session creation/deletion enforce same-origin requests.

`AuthProvider` exposes `user`, `loading`, `isAuthenticated`, `error`, `login`, `signup`, `logout`, `resetPassword`, optional `loginWithGoogle`, and setup recovery. It does not report authentication ready until the profile and server session are established. Partial setup failures retain the real Firebase account and offer **Retry setup** (no fake rollback/account recreation). `AuthGuard` prevents cached dashboard UI from remaining visible after sign-out. Logout calls Firebase `signOut`, clears the cookie, and revokes refresh tokens/server sessions; **other sessions for that account will also need to sign in again**.

Routes: `/login`, `/register`, `/signup`, `/forgot-password`, `/dashboard` and its feature pages. `/dashboard/*` rewrites to the retained `/admin/*` implementation; old `/admin/*` links still work. No obsolete custom-auth middleware is installed. `/b/[slug]` never requires a customer login.

## 3. Firebase Console setup (required before live use)

1. Open [Firebase Console](https://console.firebase.google.com/) and select **`restaurant-flow-59183`**, or create/select the project you intend to use.
2. Add/select its **Web App** under **Project settings → General**. Copy its six SDK configuration values. `.env.example` contains the Web App identifiers provided in the request; these are public configuration, not Admin secrets.
3. Open **Authentication → Get started → Sign-in method**. Enable **Email/Password**. Configure the project's password policy; the app requires at least eight characters and additionally validates the Firebase project policy.
4. Optionally enable **Google**, configure its support email, and only then set `NEXT_PUBLIC_FIREBASE_GOOGLE_ENABLED=true`. It defaults to false and does not affect password authentication.
5. Create a **Firestore database in Native mode**, with database ID **`(default)`**. Choose the correct region for your users. Do not leave test-mode/open rules active.
6. Provision **Storage**, using the actual bucket name shown in Console. Enable billing if Console requires it. The provided bucket identifier is `restaurant-flow-59183.firebasestorage.app`; verify it is provisioned, rather than assuming that a config value creates a bucket.
7. Under **Authentication → Settings → Authorized domains**, add **`localhost`** and **your actual production hostname** from **Vercel → Project → Settings → Domains**. Add `127.0.0.1` if you use that host locally with the live project. Add actual preview/custom hostnames when testing provider popups there. **No production domain was supplied, so none is invented in this repository.** Enter hostnames, not protocols/paths.
8. Configure password-reset email templates/action URLs and verify the sending address in Authentication. Firebase email-enumeration protection can deliberately return success for nonexistent emails; the UI reflects that.
9. Obtain a **new** server service-account key, or configure official Google Application Default Credentials (ADC). The application account needs Firebase Auth user/session verification and revocation permissions, Firestore data access, and Storage object deletion permissions if cleanup is enabled. Use least privilege; typical application roles are Firebase Authentication Admin, Cloud Datastore User, and Storage Object Admin. Rule deployment belongs to your deployment operator, not browser credentials.
10. Authenticate the Firebase CLI as your deployment operator and deploy the checked-in rules/indexes:

    ```bash
    npx firebase login
    npx firebase deploy --project restaurant-flow-59183 --only firestore:rules,firestore:indexes,storage
    ```

    If you selected another project, substitute its real ID. When prompted for Storage-to-Firestore rule access, grant the required Firebase rules service-agent access. The Storage rules use Firestore membership/ownership checks.

Firestore collections appear when actual documents are created; there is no need to create empty collections manually. Creating a business atomically creates its owner membership, private default settings, social-link records, QR metadata and public projection. Signup creates an account/profile, then the dashboard asks you to create your first actual business; it does not invent a business or grant a global admin role.

## 4. Environment variables

Copy `.env.example` to **`.env.local`** locally. All `.env*` files except `.env.example`, service-account files, PEM keys, exports and migration output are ignored. The app builds without credentials; live authentication/data access correctly report configuration errors until configured.

### Public, build-time Web App configuration (all six required)

| Variable | Value/source |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Web App SDK `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Web App SDK `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Web App SDK `projectId` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Actual provisioned Storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Web App SDK `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Web App SDK `appId` |
| `NEXT_PUBLIC_APP_URL` | Your actual HTTPS production **origin**, without a path/query; required for stable production printouts |
| `NEXT_PUBLIC_FIREBASE_GOOGLE_ENABLED` | `false`, or `true` after enabling Google |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | `false` for all deployed environments |

Next.js inlines `NEXT_PUBLIC_*` values into the browser bundle **at build time**. Restart development or **redeploy/rebuild** after changing them. The Web API key is public by design; Firestore/Storage rules, Firebase Auth and API authorization—not hiding that key—protect data. Never prefix an Admin credential with `NEXT_PUBLIC_`.

### Server only

| Variable | Value/source |
| --- | --- |
| `FIREBASE_PROJECT_ID` | `restaurant-flow-59183` (must match the selected Web App/project) |
| `FIREBASE_CLIENT_EMAIL` | The new service-account JSON's **`client_email`**, ending in `.iam.gserviceaccount.com`; **not a personal Gmail address** |
| `FIREBASE_PRIVATE_KEY` | Only the new service-account JSON's PEM **`private_key`** string, **not the whole JSON object** |
| `FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS` | `false` for the email/key approach; `true` only on a runtime with securely configured Google ADC |
| `FIREBASE_CLEANUP_STORAGE_ON_DELETE` | `true` with Storage provisioned; removes business images during owner deletion |

In `.env.local`, a PEM value can be a quoted string using escaped `\n` line breaks. In Vercel, paste the PEM with actual line breaks (or escaped `\n`) **without extra surrounding quotes**. The Admin layer normalizes escaped newlines and is protected with `server-only`. Do not store `service-account.json` in the application. `GOOGLE_APPLICATION_CREDENTIALS`, if used for local ADC, must point to a securely stored file **outside the repository**.

`DATABASE_URL` is optional and used only by the legacy export/Drizzle inspection tools. **Do not configure PostgreSQL to make Firebase login work.** `AI_PROVIDER=local` documents the retained deterministic review draft generator; no external LLM key is used or claimed.

## 5. Firestore model and authorization

```text
users/{uid}                                 uid, name, email, photoURL, role=user,
                                             createdAt, updatedAt; no passwords/tokens
businesses/{businessId}                      id, businessId, ownerId, stable slug,
                                             public profile fields, publication flags,
                                             createdAt, updatedAt
  members/{uid}                             uid, businessId, owner/admin/staff,
                                             createdAt, updatedAt
  qrCodes/{qrId}                             stable targetPath=/b/{slug}, label/style
  menuCategories/{categoryId}                name, sortOrder, timestamps
  menuItems/{itemId}                         categoryId, name, description, price,
                                             image URL, available, sortOrder, timestamps
  socialLinks/{platformKey}                  platform, url, timestamps
  wifiSettings/default                      credentials, enabled, explicit public consent
  reviewSettings/default                    review toggles, Google Review URL/Place ID
  reviewSessions/{sessionId}                 customer draft input/output, timestamps,
                                             expiresAt (30-day TTL)
  analytics/{eventId}                        event type, optional anonymous session UUID,
                                             timestamps; no arbitrary customer metadata
  activityLogs/{logId}                       actor UID, action/message, timestamps
  themes/default                            theme, colors/font/styles/tagline, timestamps
  _meta/{counterId}                          server-only ordering counters
publicBusinesses/{slug}                      explicit public field allowlist; no owner UID,
                                             password, private analytics or auth data
businessSlugs/{slug}                         server-only unique slug reservation/tombstone
_rateLimits/{hashedKey}                      server-only distributed rate limit + TTL
```

The requested logical `businessMembers` collection is represented by **`businesses/{id}/members/{uid}`**; `analyticsEvents` by **`businesses/{id}/analytics/{eventId}`**. All other requested entities are present as appropriately scoped subcollections. There are no duplicate top-level tenant data stores. Persistence uses Firestore timestamps, converted to `Date` for the retained server-rendered UI. The checked-in index enables the server membership collection-group query. Deploy/confirm the TTL policies for `reviewSessions.expiresAt` and `_rateLimits.expiresAt`; TTL expiration is asynchronous.

- Owners/admins can manage business settings through verified APIs. Only the real `ownerId` can delete the business. Staff can manage menu entries, not business identity/ownership/deletion.
- Each API checks the Firebase UID against authoritative ownership/membership. Request-body `userId`, `ownerId`, email or role cannot grant access.
- Menu category references must belong to the same business. Category deletion cascades items. Business deletion disables publication first and recursively removes subcollections/assets. The slug reservation remains as a tombstone: old printed QR codes must never be reassigned to a different owner.
- Mutation payloads are strictly validated. Images are Storage URLs, not large base64 Firestore fields.

### Security rules

`firestore.rules` and `storage.rules` are versioned production policies, not development-open rules:

- Users read/update only their own profile, with UID/email binding, fixed global `role=user` and immutable creation timestamp. No self-escalation.
- Private business documents/settings/analytics are readable only by members/owners; customer review-session data is readable only by owners/admins.
- Sensitive multi-document business/settings operations run through token-verified server APIs to maintain projection/slug/membership invariants. Business/menu client SDK writes are denied; the existing UI uses verified APIs. Membership writes are owner-only and cannot alter the owner membership.
- Anonymous customers can get the intentionally public projection and published, available menu entries; they cannot list private businesses, projections, analytics or accounts.
- Customer events/review writes go through validated, rate-limited public server APIs, not permissive Firestore writes.
- Storage validates authorized business paths, member/manager role, **JPEG/PNG/WebP** MIME types, filename extension and **5 MB** limit. Unknown paths and all private-operation collections default to deny.

The Admin SDK bypasses Firestore rules by design, so **both** the rules and server authorization are essential. Never deploy `allow read, write: if true`.

Business logos/covers/menu images are intentionally public assets. Firebase download-token image URLs are shareable bearer URLs; do not upload private documents to these folders. Deleting/unpublishing a business does not magically revoke an already copied download token; delete the object to invalidate it. No authentication credentials or private QR exports are uploaded there.

### Guest Wi-Fi privacy

Wi-Fi passwords are **never serialized into the initial `/b/[slug]` HTML/client business payload**. The owner must enable both the feature and explicit public-sharing consent. Only when a customer opens the Wi-Fi card does a no-store endpoint return the deliberately published guest network credentials. Open networks omit the password. The Wi-Fi QR is generated in the browser, so its password is not a URL query string/server-log entry. Anyone with the page URL can access consented guest Wi-Fi; this is **not** a secret access gate. Never publish an internal/admin network.

## 6. Local development and testing

Requirements: Node **22.15+**, npm. Official Firebase emulator integration tests additionally need **Java 21+**, internet access for the CLI's initial emulator binary downloads, and Playwright Chromium/browser OS dependencies.

### Live Firebase project

```bash
npm install
cp .env.example .env.local
# Fill in NEW secure Admin credentials; verify Console providers/services/rules.
npm run dev
```

Open <http://localhost:3000>. Servers bind to `0.0.0.0`, browser API calls are relative, and the development allowlist supports actual Arena preview hosts. Web and Admin Firebase configuration must point at the same project. No automatic production demo seed or shared demo password exists.

### Isolated Firebase emulators (no production credentials)

```bash
npm install
npx playwright install --with-deps chromium
npm run dev:emulators
```

Open the **local HTTP** app URL. Test scripts set `demo-scanly` and Auth/Firestore/Storage hosts automatically, overriding any live project values. Only a `demo-` project can use server emulator mode. Browser Auth/Firestore requests and local Storage SDK requests go through same-origin Next.js emulator proxies; loopback addresses exist **only on the server/test side**, not as production browser API URLs. Production-mode **local demo builds** may encode loopback HTTP QR targets only when both a `demo-` project and emulator mode are set; real production projects/non-loopback production targets still require HTTPS. The official Web Storage emulator API uses HTTP, so emulator uploads are intentionally limited to the local HTTP development URL; production Firebase Storage uses HTTPS. Do not enable emulators on Vercel.

Verification commands:

```bash
npm run lint
npm run typecheck
npm run build
npm test                     # deterministic unit tests; no production services
npm run test:integration      # real Firebase SDK, Auth/Firestore/Storage emulators, API/rules checks
npm run test:e2e              # Chromium UI flows + official emulators
npm run test:all              # unit + integration + browser suites
```

The official Auth emulator returns HTTP 501 for Firebase's password-policy inspection API; emulator signup applies the real app's eight-character/confirmation validation without that unsupported inspection call. Live signup additionally calls the Web SDK's `validatePassword` and the real Auth backend enforces its configured policy. Production project password-policy enforcement itself has not been remotely tested.

API and browser suites first build/start the actual production-mode app with isolated `demo-scanly` emulator configuration, then run the missing-config development app sequentially to avoid running two full Next.js compilers alongside Java and Chromium in small CI containers.

Integration tests fail rather than substitute fake auth/API responses if official emulators are unavailable. Limited HTTP-boundary unit tests use injected transport responses to verify the original HTML/JSON failure and disconnected-network mapping; they do not replace application authentication. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` optionally selects an already installed browser in constrained CI. Test artifacts, emulator JARs/databases, logs and browsers are not committed.

The retained appearance controls now apply their saved fonts/card/button styles on the actual public page, not only the editor preview. All five offered fonts are self-hosted. Analytics queries page through the full selected period (no silent 10,000-event truncation); calendar filters/charts use UTC, and All Time totals include all history while the timeline shows the most recent 30 days. Very large event histories incur Firestore reads; aggregate/retention planning is appropriate before high-volume scaling.

The development client logs configuration **names only** if missing, or an initialization health message. `/api/health` performs a real Firestore read with secure server credentials; development responses additionally distinguish initialization/connectivity, without exposing secrets. Initialization alone is not proof that a remote service/provider/rules deployment is ready.

See [test results and release limitations](docs/verification.md) for the exact executed checks. A generated QR is tested by **decoding its pixels and navigating to its URL**, not by claiming a physical-phone camera test happened in the sandbox.

## 7. Preserve/migrate existing PostgreSQL data

The original `src/db/schema.ts` and client are retained for **read-only export/inspection**. Drizzle now reads `DATABASE_URL` instead of a hardcoded loopback URL. All `src/app` runtime routes, authentication helpers and UI data types use Firebase/Firestore, not PostgreSQL. The old auth API endpoints, bcrypt auth code and database session flow are removed; legacy schema columns do not form an active authentication system.

1. Back up PostgreSQL using your provider's backup/export tooling. Keep the source database intact. For the final cutover, put the legacy application into maintenance/read-only mode so writes after the export are not lost; do staging rehearsal before that maintenance window. Do not allow new Firestore businesses to collide with legacy slugs before reconciliation.
2. Configure `DATABASE_URL` only in your secure migration environment and create a private export:

   ```bash
   npm run migrate:export -- backups/scanly-export.json
   ```

   The exporter uses a consistent repeatable-read, **read-only** PostgreSQL transaction and reads all required business/menu/QR/review/analytics/activity tables, excludes passwords/session tokens, refuses to overwrite an output file, and writes it with restrictive permissions. Export files contain private business/customer data and must never be committed.
3. Establish the legitimate owners' Firebase accounts (using Firebase Auth/password reset as appropriate). Produce an **administrator-reviewed** `backups/uid-mapping.json`:

   ```json
   { "LEGACY_USER_ID": "APPROVED_FIREBASE_UID" }
   ```

   Do not transfer ownership just because an unverified signup claims the same email. The importer requires the explicit mapping, checks mapped Auth account emails, and rejects accidental user merges. Old passwords/hashes and sessions are **not** migrated. Affected users use Firebase password reset or register through a controlled ownership-verification process.
4. Validate the plan without credentials or writes:

   ```bash
   npm run migrate:import -- backups/scanly-export.json backups/uid-mapping.json
   ```

5. Test in a staging project first. After reviewing the mapping, destination, data counts and newly rotated credentials, deliberately apply:

   ```bash
   npm run migrate:import -- backups/scanly-export.json backups/uid-mapping.json --apply
   ```

   The importer preserves business IDs/slugs/timestamps (including legacy Nano ID underscore suffixes), normalizes private settings, transfers base64 images to Storage, reconstructs memberships/QR target paths and menu ordering (adding `qrCodes/main` if absent), and defaults public guest-Wi-Fi consent to **off** for owner review. It refuses to overwrite destination business IDs/slugs. Imports are not globally atomic across an entire export: if interrupted, **inspect and reconcile the destination before retrying**; do not silently merge tenants. It never deletes source rows.
6. Reconcile every collection and image, owner/member access and printed QR domain/slug in staging. Keep the PostgreSQL backup/source for rollback. Retirement/removal of PostgreSQL is an operator decision **after actual data migration is verified**, not something this code change silently does.

No legacy production database or dataset was provided, so a production data import was not executed here.

## 8. Vercel deployment

1. Connect this **existing** repository/project in Vercel (Next.js framework, Node 22 runtime; install `npm ci`, build `npm run build`). No separate backend/CORS port is needed.
2. In **Vercel → Project → Settings → Environment Variables**, add all six `NEXT_PUBLIC_FIREBASE_*` Web App variables above, `NEXT_PUBLIC_APP_URL` with the **actual HTTPS production origin**, and the secure server `FIREBASE_PROJECT_ID`, **new** `FIREBASE_CLIENT_EMAIL`, **new** `FIREBASE_PRIVATE_KEY`.
3. Set `NEXT_PUBLIC_FIREBASE_GOOGLE_ENABLED=false` unless configured; `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false`; `FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS=false` for normal Vercel service-account env configuration; `FIREBASE_CLEANUP_STORAGE_ON_DELETE=true` after provisioning Storage. `AI_PROVIDER=local` is optional documentation of the retained provider-free generator.
4. Apply the variables to the appropriate **Production/Preview/Development** scopes. Prefer a separate Firebase staging project for Preview rather than writing test data to production. **Do not add emulator host variables, service-account JSON files or DATABASE_URL for authentication.** Use Vercel's sensitive-variable controls for server credentials.
5. Deploy the Firebase rules/indexes to that same project, verify service/IAM access, and migrate existing data if applicable. Console authorized domains must include the actual domain you are about to use.
6. **Redeploy the application after adding/changing environment variables.** Changing public values without rebuilding cannot update the browser bundle.
7. Verify signup/login/logout/reset, dashboard/API protection, Storage uploads, anonymous customer features and `/api/health` against the live deployment.
8. Set/confirm `NEXT_PUBLIC_APP_URL` before printing. QR codes always encode **`https://<your actual host>/b/<stable slug>`**, never the Google Review URL. Changing the Google Review destination/menu/Wi-Fi/social links does not require a reprint. Moving the domain or deliberately changing the slug would require redirects/reprints and is not exposed as an ordinary editor action.

Live Firebase Console settings, new credentials, authorized production domains, deployed rules/indexes, billing/IAM and Vercel redeployment are operator steps; local emulator tests cannot certify those external resources. No live production deployment is claimed without performing those checks.

## Source map

- `src/lib/firebase/client.ts`, `config.ts`: lazy Web SDK initialization/diagnostics
- `src/lib/firebase/admin.ts`: server-only Admin SDK + secure credential validation
- `src/components/auth/`: centralized auth state, cached-UI guard, partial-setup recovery
- `src/lib/firebase/errors.ts`, `validation.ts`: actionable auth error/policy validation
- `src/lib/firebase/authenticated-fetch.ts`: bearer ID tokens on every protected API call
- `src/lib/firebase/storage.ts`: reusable image validation/upload/progress
- `src/lib/data/`: normalized Firestore repository, typed retained UI view models, public allowlist
- `src/app/api/auth/session/`: Firebase-only SSR session transport/revocation
- `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`: deployable policies/config
- `scripts/`: emulator verification and deliberate legacy export/import
- `tests/`: unit, official-emulator integration/security, and browser flows

The retained “AI Review” feature is a **local deterministic draft generator**, not an external LLM integration. It never auto-posts reviews to Google. Customers review/edit/copy their draft and open the configured Google link themselves.
