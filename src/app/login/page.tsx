"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { QrCode, Mail, Lock } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthRecovery } from "@/components/auth/AuthRecovery";
import { authErrorMessage } from "@/lib/firebase/errors";

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  useEffect(() => { if (auth.isAuthenticated) router.replace("/dashboard"); }, [auth.isAuthenticated, router]);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      setMessage(null);
      await auth.login(email, password);
      toast.success("Welcome back!");
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setMessage(authErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
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
              Sign in to manage your businesses and QR experience.
            </p>
          </div>

          <AuthRecovery />
          {message || auth.error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{message || auth.error}</p> : null}
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Email" htmlFor="email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
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
                  autoComplete="current-password"
                  required
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </Field>

            <Button type="submit" loading={loading || auth.loading} className="w-full" size="lg">
              Sign in
            </Button>
          </form>

          <div className="mt-4 text-center"><Link href="/forgot-password" className="text-sm font-semibold underline">Forgot password?</Link></div>
          {auth.googleEnabled ? <Button variant="secondary" className="mt-4 w-full" disabled={loading || auth.loading} onClick={async () => { setLoading(true); setMessage(null); try { await auth.loginWithGoogle(); router.replace("/dashboard"); router.refresh(); } catch (error) { setMessage(authErrorMessage(error)); } finally { setLoading(false); } }}>Sign in with Google</Button> : null}

          <p className="mt-6 text-center text-sm text-slate-600">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-semibold text-slate-900 underline">
              Create one
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}