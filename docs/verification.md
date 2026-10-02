# Firebase migration — verification and release report

Verified locally on **2026-10-02**, on `arena/01a0faff-scanly`, modifying the existing application rather than rebuilding it. Setup, environment variables, collection layout, rules and deployment instructions are in [README](../README.md). The pre-change investigation is in [auth-audit.md](auth-audit.md).

## Confirmed original failure

On the unchanged checkout, missing loaded `DATABASE_URL` caused the auth route's PostgreSQL import to throw **before its handler ran**. Login/register POSTs returned **500 HTML**. The forms called `res.json()` and then labeled the HTML parse exception **“Network error.”** The legacy loopback PostgreSQL example also produced `ECONNREFUSED`.

This was documented before the migration. Relative browser fetch paths were correct; there was no auth middleware or evidence that CORS caused the reproduced failure. No production logs/domain were provided, so an unseen Vercel failure is not independently diagnosed.

## Final executed command results

| Check | Result |
| --- | --- |
| `npm install` | **Passed**, dependency lockfile updated |
| `npm run lint` | **Passed**, no lint errors/warnings |
| `npm run typecheck` | **Passed**, `next typegen` + `tsc --noEmit` |
| `npm run build` | **Passed**, Next.js **16.3.8** optimized production build, without live Firebase credentials |
| `npm test` | **54/54 passed**, seven unit files |
| `npm run test:all` | **94/94 passed**: 54 unit + 29 integration/security + 11 browser |
| Firebase API/rules integration within `test:all` | **29/29 passed**, actual SDK/services and compiled rules |
| Main Chromium browser suite within `test:all` | **10/10 passed**, production-mode application with isolated emulator configuration |
| Missing-config browser suite within `test:all` | **1/1 passed**, separate development app |
| `npm audit` | **0 vulnerabilities**, including development dependencies |
| `npm audit --omit=dev` | **0 production vulnerabilities** |
| `git diff --check` | **Passed** |

The successful full-suite run was followed by another `npm install`, lint, typecheck, ordinary non-emulator build, `npm test`, full/production audits and diff check. The ordinary build compiled successfully in 9.0 seconds and completed TypeScript checking in 9.2 seconds. The successful full suite reported unit duration 2.67 seconds, integration duration 9.93 seconds, main browser duration 42.2 seconds, and missing-config browser duration 16.7 seconds.

### Migration tooling checks (not a production data migration)

- Seven migration unit assertions exercised explicit UID approval, immutable IDs/slugs/timestamps, no accidental user merging, preserved underscore slugs/unpublished flags, orphan references, prototype-property mapping safety and duplicate source records.
- The **dry-run importer CLI** was executed with an explicitly synthetic **empty** export/mapping: it printed a zero-record plan and exited without Firebase/PostgreSQL writes or credentials. This checks CLI loading/default dry-run behavior, not real data transfer.
- `drizzle-kit export --config drizzle.config.ts` successfully generated DDL for the **10 retained legacy tables** using a dummy connection URL. It did **not** connect to PostgreSQL or execute that DDL.
- An optional `drizzle-kit check` invocation produced an AWS Data API parameter diagnostic despite the PostgreSQL configuration. It was not used as proof of migration success; the actual non-executing schema export above succeeded. The custom read-only data exporter does not use that CLI command.
- No legacy database/data export, `--apply` import, production credential call, SQL row deletion or production cutover occurred. Real export/import reconciliation remains an operator task against the actual dataset.

## What the tests actually exercise

### Unit checks — 54

Firebase code-to-message mapping; name/email/password/confirmation validation; image MIME/size validation; rejection of HTML/invalid JSON API responses; a disconnected transport; bounded UTF-8 JSON request parsing; scheme-aware same-origin checks and trusted proxy origins; private/public field separation; settings validation; stable QR origins; actual PNG QR decoding; Wi-Fi escaping/open-network credential omission; real-count analytics/UTC calendar buckets; non-destructive migration planning; and actual self-hosted font-family mappings.

HTTP-boundary unit tests inject transport responses only to reproduce parsing/network failures. They do not replace application authentication or its API implementation.

### Official-emulator API/security checks — 29

- Real Web SDK email/password accounts, display names, login failures, duplicate signup and password-reset actions.
- Missing/forged bearer token rejection, strict payload validation and refusal to trust frontend `userId`/`ownerId`.
- Firebase-generated httpOnly/SameSite session cookies, profile repair from authoritative Admin Auth metadata, and cross-origin session request denial.
- Tenant isolation for reads/updates/deletion; staff read/menu permission but no settings/deletion authority; immutable ownership and stable physical QR target paths.
- Atomic business/default settings/membership/QR creation; valid unique slug allocation for duplicate names.
- Menu CRUD, foreign-category rejection, category cascade, and concurrent item creation versus category deletion without orphans.
- Published anonymous customer HTML/menu; no owner UID or Wi-Fi password in initial HTML; unavailable/menu-disabled and non-consented Wi-Fi denial.
- Real retained local review generation, persisted private review sessions and analytics, and enforcement of disabled review features.
- Anonymous event persistence, arbitrary personal-metadata rejection and oversized request denial.
- Compiled **Firestore rules**: own-profile access, role-escalation denial, tenant/private-data isolation, no self-joining/owner alteration, no direct business/menu mutation bypass, malformed membership rejection, available-item query constraints, private operational write denial and public projection publishing denial.
- Compiled **Storage rules**: genuine PNG upload/public read, with foreign tenant, SVG and over-5-MB upload denial.
- Local Firebase `signOut`, cookie clearing and copied-cookie revocation. Cookie-only revocation was also tested when a browser bearer token was **absent or forged**. Protected data APIs still require bearer tokens.

Negative rule assertions intentionally produce SDK `PERMISSION_DENIED` stderr. That is evidence that unauthorized writes were blocked, not an application runtime failure.

### Actual Chromium browser checks — 11

1. Signup confirmation validation, Firebase profile/session, empty-account dashboard, business modal, **all 11 onboarding steps**, QR page, logout, cookie removal and dashboard redirect after logout.
2. Invalid credentials and duplicate signup show specific errors; optional Google button is absent when disabled.
3. Forgot-password UI produces a real emulator password-reset action.
4. Actual browser request abortion simulates disconnected transport and shows the connection-specific message (no canned authentication response).
5. Authenticated access to all **11 dashboard feature pages**, the legacy `/admin/profile` alias, and unauthenticated dashboard protection.
6. Actual resumable Firebase Storage logo upload, visible upload progress and persisted/downloadable image URL. Requests were delayed briefly before being **continued to the real emulator**, solely to make the progress state observable.
7. Menu category/item forms: create, edit price, toggle public availability and cascade category deletion.
8. Appearance form persists **Lora**, square cards and outline CTAs; the public page uses the actual loaded self-hosted font and computed CTA style.
9. Decode the actual dashboard canvas pixels to `/b/{slug}`, exercise **all five download buttons** (standalone PNG/vector SVG; printable PNG/PDF/SVG), check file signatures/formats, edit the Google destination, then navigate to the decoded QR URL and confirm the new review link. Printable SVG is a valid SVG containing the high-resolution card PNG, not a PNG mislabeled as SVG.
10. Anonymous **390 × 844** mobile customer view: menu, configured social/directions URLs, guest Wi-Fi, actual Wi-Fi QR image decoding, multi-step review generation, configured Google link and **real clipboard copying**. No Firebase session cookie is required for that customer context.
11. Missing Web/Admin configuration displays an actionable message and development diagnostic names, while health returns **503 JSON**, not HTML mislabeled as a network failure.

Positive signup, protected-route, appearance and anonymous-mobile flows assert no uncaught page errors or unexpected browser `console.error` messages. Expected negative credential/network/missing-config checks may log the deliberately failed request/diagnostic. Third-party destinations were validated as links; real Google review posting was not performed.

## Implemented security/data behavior

- Firebase Auth is the sole identity source. Legacy custom auth endpoints, bcrypt login and database sessions are inactive/removed from runtime; the old SQL schema/data is retained for export/rollback.
- `AuthProvider`/`useAuth` handle initialization/loading, login/signup/logout/reset, optional Google and recoverable profile/session setup failures.
- Protected APIs verify Firebase ID tokens with revocation checking and use the decoded UID for authoritative Firestore owner/member authorization. Cookies are only the Firebase-native SSR bridge (plus authenticated logout fallback), not a second auth database.
- Multi-document settings, immutable slug/ownership, menu counters/cascades and public projection changes are coordinated server-side. Sensitive client SDK writes are denied by default.
- Public business data is allowlisted; guest Wi-Fi requires explicit owner consent and is retrieved only on demand with no-store headers. Open networks omit passwords. Customer sessions/private analytics never appear in public projections.
- Logos/covers/menu uploads are validated and business scoped; download-token URLs are deliberately public branding assets, not private document storage.
- QR targets always encode the app customer page, never the Google destination. Destination edits preserve the slug/target. Deleted slugs remain tombstones to prevent printed-QR takeover.
- Calendar analytics filters/charts use UTC and queries page through the full selected history rather than silently truncating totals.

## Issues discovered and resolved during verification

In addition to the original SQL/import/JSON bug: stale ID-token display-name claims during profile repair; stale auth completion; failed token refresh preventing logout cleanup; namespace consistency in membership checks; random underscore slug suffix incompatibility with the new validator (legacy underscores are now preserved); category-delete/item-create race; fake-success review copying; printable PNG mislabeled as SVG; duplicate toast hosts; saved fonts/card/button styles not reaching the actual public page; missing font assets; and calendar-range/truncation inconsistencies.

Test-environment issues were also distinguished from application defects: Chromium initially lacked NSS/NSPR shared libraries; Next development compiler processes were demonstrably **OOM-killed by the sandbox kernel**. Both API and browser tests now build/start the actual production-mode app once, with demo-only Firebase configuration; the missing-config development app runs separately. This reduced memory without bypassing app/auth/rules behavior. Failed selectors (route-announcer alerts and a Continue button that requires answered questions) were corrected to match the existing UI, not by removing the UI requirements.

## Emulator/browser versions and reproducibility

The sandbox used Node **22.22.3**, Java **21**, Chromium **153**, Firebase Web SDK **12.19.0**, Firebase Admin **14.5.0**, and Firebase CLI **15.32.1**. Auth ran the official CLI emulator; Firestore used the official **1.18.2** JAR via `FIRESTORE_EMULATOR_BINARY_PATH`, and Storage rules used **1.1.3**. Those are the versions actually exercised, not a claim that a renamed older binary is a newer release.

Both JARs matched official Firebase CLI v12.9.1 metadata:

| Binary | Bytes | Official MD5 matched |
| --- | ---: | --- |
| Firestore 1.18.2 | 63,929,486 | `7b066cd684baf9bcd4a56a258be344a5` |
| Storage rules 1.1.3 | 52,892,936 | `2ca11ec1193003bea89f806cc085fa25` |

Large Google/browser CDN downloads were unavailable in this sandbox, so verified emulator caches and a registry-packaged Chromium/Java runtime were used. In a normal environment, install Java 21 and Playwright browser dependencies, then run the README commands; Firebase CLI downloads its official default emulator binaries. JARs/browsers/logs/generated builds are not committed.

The official Auth emulator returns **501** for password-policy inspection. Emulator signup still applies app-level validation and uses the real emulator account-creation API; live signup additionally calls Firebase `validatePassword`. **Live project policy enforcement was not remotely tested.**

## Release gates outside this checkout

Still required before production use:

1. Revoke the exposed service-account key, review its usage, and configure a **new** key or secure ADC. No exposed key was retained/used here.
2. Enable the actual Console providers, provision Firestore/Storage, confirm IAM/billing/bucket, deploy rules/indexes and enable TTL policies.
3. Set the Web and secure Admin environment variables, actual HTTPS `NEXT_PUBLIC_APP_URL`, and actual authorized production domain; rebuild/redeploy in Vercel.
4. Rehearse and reconcile a real legacy data migration in staging; use maintenance/read-only cutover for the final export and retain PostgreSQL/backups until confirmed.
5. Verify live auth, real email delivery, uploads, URLs and customer features on the actual deployment.

No actual production domain, new Admin credentials or legacy dataset was provided. **No production deployment, live Google popup, inbox delivery, physical phone/camera/printed-paper scan, Wi-Fi hardware connection, high-volume load test or production data import is claimed.** QR pixel decoding/navigation and Wi-Fi payload decoding were actually performed as described above.
