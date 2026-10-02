import Link from "next/link";
import {
  QrCode,
  Star,
  Coffee,
  Wifi,
  Instagram,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-orange-50/30 to-white">
      {/* Top nav */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-white">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-900 leading-none">Scanly</p>
              <p className="text-[11px] text-slate-500 leading-none">QR Customer SaaS</p>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/register"
              className="hidden sm:inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Live Demo
            </Link>
            <Link
              href="/login"
              className="inline-flex h-10 items-center rounded-lg bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-900"
            >
              Open Admin
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-16 sm:pt-24">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              <Sparkles className="h-3.5 w-3.5" />
              One link. Five stars. Real reviews.
            </span>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
              Turn a QR sticker into a <span className="text-orange-700">customer experience</span>.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600">
              Generate honest AI-assisted reviews, share digital menus, Wi-Fi access
              and social links with a single QR code. Multi-tenant. Mobile-first.
              Built for cafés, restaurants, salons and local businesses.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-slate-950 px-6 text-sm font-medium text-white hover:bg-slate-900"
              >
                Open dashboard <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/register"
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                Create your business page
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> No fake reviews</span>
              <span className="inline-flex items-center gap-1.5"><Smartphone className="h-4 w-4" /> No app install</span>
              <span className="inline-flex items-center gap-1.5"><Coffee className="h-4 w-4" /> Built for cafés</span>
            </div>
          </div>

          {/* Hero preview */}
          <div className="relative">
            <div className="mx-auto w-full max-w-sm rounded-[2rem] border border-slate-200 bg-white p-3 shadow-2xl">
              <div className="rounded-[1.5rem] bg-orange-50 p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-sm text-xl">☕</div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">BAKE Café & Bakery</p>
                    <p className="text-xs text-slate-600">Café & Bakery · Mumbai</p>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500">Share Your Experience</p>
                  <p className="mt-1 text-base font-bold text-slate-900">Help us grow with your review</p>
                  <div className="mt-3 flex items-center gap-1 text-amber-500">
                    {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-xl bg-white p-3 shadow-sm font-medium text-slate-700">⭐ Google Review</div>
                  <div className="rounded-xl bg-white p-3 shadow-sm font-medium text-slate-700">✨ AI Review</div>
                  <div className="rounded-xl bg-white p-3 shadow-sm font-medium text-slate-700">🍰 Menu</div>
                  <div className="rounded-xl bg-white p-3 shadow-sm font-medium text-slate-700">📶 Wi-Fi</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto mt-24 max-w-6xl px-4 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <QrCode className="h-5 w-5" />, title: "Dynamic QR Codes", text: "One QR, every feature. Update content without reprinting." },
            { icon: <Star className="h-5 w-5" />, title: "AI Review Assistant", text: "Helps customers write honest, detailed Google reviews." },
            { icon: <Coffee className="h-5 w-5" />, title: "Digital Menus", text: "Beautiful, mobile-first menus with photos & prices." },
            { icon: <Wifi className="h-5 w-5" />, title: "Wi-Fi QR Sharing", text: "Scan to connect — no typing passwords." },
            { icon: <Instagram className="h-5 w-5" />, title: "Social Hub", text: "Instagram, Facebook, YouTube and website in one tap." },
            { icon: <ShieldCheck className="h-5 w-5" />, title: "No Fake Reviews", text: "Customers write and post — we never auto-submit." },
            { icon: <Sparkles className="h-5 w-5" />, title: "Themes & Branding", text: "Per-business color, logo, font and tagline." },
            { icon: <Smartphone className="h-5 w-5" />, title: "Mobile First", text: "Feels native on Android, iPhone and the web." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-5 card-hover">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-950 text-white">
                {f.icon}
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-900">{f.title}</p>
              <p className="mt-1 text-sm text-slate-500">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Scanly · Get started:{" "}
        <Link href="/register" className="text-slate-700 underline">Create an account</Link>
      </footer>
    </main>
  );
}