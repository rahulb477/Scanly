"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Toaster, toast } from "@/components/ui/Toast";
import { QrCode, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@bakecafe.test");
  const [password, setPassword] = useState("demo1234");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Login failed");
      } else {
        toast.success("Welcome back!");
        router.push("/admin");
        router.refresh();
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <Toaster />
      {/* Left visual */}
      <aside className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-orange-50 to-amber-100 p-12">
        <Link href="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-white">
            <QrCode className="h-5 w-5" />
          </div>
          <span className="text-base font-bold text-slate-900">Scanly</span>
        </Link>
        <div>
          <h1 className="text-4xl font-extrabold text-slate-950 leading-tight">
            Your single QR code, the whole customer experience.
          </h1>
          <p className="mt-3 text-slate-700 max-w-md">
            Reviews, menu, Wi-Fi and social — all without customers downloading another app.
          </p>
        </div>
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} Scanly</p>
      </aside>

      {/* Right form */}
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md animate-fade-in">
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-slate-950">Sign in</h2>
            <p className="mt-1 text-sm text-slate-600">
              Use the demo credentials below — they're pre-filled for convenience.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Email" htmlFor="email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  required
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@business.com"
                />
              </div>
            </Field>
            <Field label="Password" htmlFor="password">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  required
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </Field>

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Sign in
            </Button>
          </form>

          <div className="mt-6 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm">
            <p className="font-semibold text-amber-900">Demo credentials</p>
            <p className="mt-1 text-amber-900/80">
              Email: <code>demo@bakecafe.test</code>
              <br />
              Password: <code>demo1234</code>
            </p>
          </div>

          <p className="mt-6 text-center text-sm text-slate-600">
            Don't have an account?{" "}
            <Link href="/register" className="font-semibold text-slate-900 underline">
              Create one
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}