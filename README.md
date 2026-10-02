# Scanly — QR Customer Engagement SaaS

A multi-tenant SaaS platform for cafés, restaurants, salons, hotels, gyms and local
businesses. Every business gets a unique public URL — `/b/{slug}` — that customers
reach by scanning a single QR code. The page surfaces:

- A premium mobile-first landing page
- AI-assisted review drafts (multi-language: English, Hinglish, Hindi)
- Direct Google Review deep links
- A visual digital menu
- Wi-Fi QR joining
- Instagram, Facebook, YouTube, WhatsApp, X/Twitter and website links
- Get-directions deep link

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS (mobile-first)
- PostgreSQL via Drizzle ORM
- Sessions cookie auth (bcrypt + httpOnly cookies)
- Lucide icons, Recharts, jsPDF, html2canvas
- QR generation via `qrcode` (SVG + PNG)

## Getting Started

```bash
npm install
npx drizzle-kit push
npm run build
npm run start
```

The seed routine creates a demo business and admin automatically on first page
load of `/` if the database is empty.

### Demo credentials

- URL: <http://localhost:3000/login>
- Email: `demo@bakecafe.test`
- Password: `demo1234`

### Demo business public URL

- <http://localhost:3000/b/bake-cafe>

## Environment Variables

Copy `.env.example` to `.env` and adjust:

- `DATABASE_URL` — Postgres connection string
- `NEXT_PUBLIC_APP_URL` — (optional) public base URL used for QR codes

## Architecture

```
src/
  app/
    page.tsx                — marketing landing page
    login/                  — sign in
    register/               — sign up
    b/[slug]/               — public customer landing page
    admin/                  — protected admin dashboard
      layout.tsx            — admin shell with auth check
      page.tsx              — dashboard
      profile/              — business profile
      qr/                   — QR codes & printable cards
      ai/                   — AI review toggles
      menu/                 — digital menu
      wifi/                  — Wi-Fi details
      social/               — social links
      google/               — Google Review URL
      appearance/           — theme / brand builder
      analytics/            — event charts
      settings/             — public URL & danger zone
      onboarding/           — 11-step setup wizard
    api/
      auth/                 — login, logout, register
      businesses/           — CRUD
      menu/                 — category & item CRUD
      ai/review/            — AI review draft endpoints
      track/                — anonymous event tracking
      wifi-qr/              — Wi-Fi QR SVG endpoint
      health/               — DB healthcheck
  components/ui/            — design system (Button, Input, Modal, Toast)
  db/
    schema.ts               — Drizzle tables & relations
    index.ts                — Drizzle client
  lib/
    auth.ts                 — bcrypt + sessions
    seed.ts                 — demo data seeder
    utils.ts                — slugify, sanitise, Wi-Fi QR string
    themes.ts               — appearance presets
    printable-themes.ts     — printable card themes
    ai-review.ts            — review generator (provider-agnostic)
    analytics.ts            — server-side helpers
    ratelimit.ts            — simple in-memory rate limit
    admin.ts                — server helper for admin access checks
```

## Deploy

Compatible with Vercel + any managed Postgres (Neon, Supabase, RDS):

1. Provision a Postgres database.
2. Set `DATABASE_URL`.
3. Run `npx drizzle-kit push` against the production DB.
4. Deploy with Vercel.

## Multi-tenancy is enforced by:

- `businesses.ownerId` foreign key
- `business_members` (Owner/Admin/Staff) join table
- `requireBusinessAccess()` server-side check on every API mutation

## Security

- httpOnly session cookies
- bcrypt-hashed passwords
- Zod-validated inputs
- Rate-limited AI & auth endpoints
- Wi-Fi passwords stored privately (not exposed via public business API payload that the customer page doesn't need)
- No review content is auto-posted — customers copy and paste themselves