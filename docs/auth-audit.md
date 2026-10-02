# Authentication/network audit — before migration

Date: 2026-10-02. Baseline: `a7e4163d35ec24f7c8d58a302f2084f158a35934`.

## Confirmed root cause (reproduced on the unchanged source)

1. `src/app/login/page.tsx` posts to `/api/auth/login`; `src/app/register/page.tsx` posts to `/api/auth/register`. Both are correct same-origin App Router URLs.
2. Both handlers import `src/db/index.ts` directly and through `src/lib/auth.ts`.
3. That module throws **at module initialization** if `process.env.DATABASE_URL` is absent: `throw new Error("DATABASE_URL is required")`. There is no `.env`/`.env.local` in the checkout, and the sandbox had no DATABASE_URL environment variable. `.env.example` is not loaded by Next.js.
4. Ran the unmodified app on port 3000, then submitted a valid-shaped POST to each auth endpoint. Both returned **500**, **text/html; charset=utf-8**, and an HTML error page containing `DATABASE_URL is required`. The route handler never reaches its JSON response.
5. Reproduced the browser's `res.json()` operation against each body: `Unexpected token '<', "<!DOCTYPE "… is not valid JSON`.
6. Each form has a blanket `catch` that always displays **“Network error”**. This is a misreported server/import/JSON-parsing failure, not evidence of a browser connectivity problem.

The legacy example and `drizzle.config.json` point at `127.0.0.1:5432/app_db`. A direct `pg` connectivity check returned **ECONNREFUSED 127.0.0.1 5432**. Copying this example without provisioning PostgreSQL would produce another unhandled server failure (both auth routes have no database exception boundary). No production deployment logs or production domain were provided; the above diagnosis is verified for this checkout, not an invented diagnosis of an unseen Vercel environment.

## Audit inventory

- `package.json`: Next 16.2.6, React 19, PostgreSQL/Drizzle, bcrypt, cookie/session auth; no Firebase packages, lockfile, tests or test script initially.
- Complete `src/app` tree: marketing `/`, `/login`, `/register`, public `/b/[slug]`; 11 admin features plus onboarding; business/menu mutations, review generator, event tracking, Wi-Fi QR and health API.
- `src/lib/auth.ts`: bcrypt password hashes in `users`, random database-backed tokens in `sessions`, 30-day `qr_session` httpOnly cookie. Cookie was not Secure. Owners/members enforced in API helpers, but every member could perform owner-only deletion.
- Protected layout/pages: async server components under `/admin`; import custom auth helpers and query PostgreSQL. No `/dashboard` or `/signup` alias existed. Empty accounts cause a dashboard-to-itself redirect.
- Middleware/proxy: **none present**. No middleware caused this failure.
- Environment: only `.env.example`; no Firebase configuration or protected credential ignore rules. No credentials or environment values were dumped during audit.
- Drizzle: JSON config embeds a loopback development database URL instead of reading DATABASE_URL.
- Database tables: users, businesses, business_members, qr_codes, menu_categories, menu_items, analytics_events, review_sessions, activity_logs, sessions. All runtime data features use these tables. PostgreSQL cannot simply be deleted while changing only the login form.
- Auth imports: login/register/logout API, seed, admin access helper/layout/onboarding, all protected business/menu API routes; AdminShell imports SessionUser as a type and calls custom logout.
- Network search: all browser API calls are relative; no browser-side localhost API URL, separate backend port, CORS requirement or HTTPS-to-HTTP request in these flows. The loopback references are database configuration and QR base-URL fallback. The QR fallback could point production printouts to localhost if neither app URL nor VERCEL_URL exists.
- Public payload: spreads the entire business document into a client component; includes ownerId and enabled Wi-Fi passwords, fetches unavailable menu items too. Needs an explicit public allowlist and consent-gated on-demand guest Wi-Fi endpoint.
- Image uploads: base64 embedded in database fields, no Storage layer/progress. This is not suitable for Firestore document size limits.
- Review generator: existing local, deterministic, provider-free implementation (not an external LLM). Preserve and describe honestly; do not substitute fake API responses.
- Baseline commands: `npm install` passed; `npm run typecheck` passed; `npm run lint` failed with 15 existing JSX escaping/React purity errors. `npm test` did not exist.

## Implementation decision

Preserve existing Next.js routes, UI, forms, QR/printable code, review generator and feature logic. Replace authentication with Firebase Web Auth, centralized state, Firestore profiles, and Firebase Admin verification. Use bearer ID tokens for APIs; use **Firebase-generated**, verified httpOnly session cookies solely as an SSR bridge (not a second authentication system). Migrate runtime data operations to Firestore subcollections with tenant authorization and explicit public projections. Keep the legacy PostgreSQL schema/client only for non-destructive export/migration; no runtime auth or application route may import it. Never copy old password hashes or session tokens into Firestore.

Security note: a service-account key was supplied in the request. Treat it as compromised, revoke/replace it, and do not save, test, log or commit it. A personal Gmail address is not a service-account client_email. Real Admin credentials must come from a newly issued service account through secure environment variables or Application Default Credentials.
