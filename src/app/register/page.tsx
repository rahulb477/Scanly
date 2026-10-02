"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { toast } from "@/components/ui/Toast";
import { QrCode, Mail, Lock, User } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthRecovery } from "@/components/auth/AuthRecovery";
import { authErrorMessage } from "@/lib/firebase/errors";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const auth = useAuth();
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { if (auth.isAuthenticated) router.replace("/dashboard"); }, [auth.isAuthenticated, router]);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      setMessage(null);
      await auth.signup({ name, email, password, confirmPassword });
      toast.success("Account created");
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
      <aside className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-amber-50 to-orange-100 p-12">
        <Link href="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-white">
            <QrCode className="h-5 w-5" />
          </div>
          <span className="text-base font-bold text-slate-900">Scanly</span>
        </Link>
        <div>
          <h1 className="text-4xl font-extrabold text-slate-950 leading-tight">
            Create your free admin account.
          </h1>
          <p className="mt-3 text-slate-700 max-w-md">
            Then run the 11-step setup wizard to get your QR code live in minutes.
          </p>
        </div>
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} Scanly</p>
      </aside>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md animate-fade-in">
          <h2 className="text-2xl font-bold text-slate-950">Create account</h2>
          <p className="mt-1 text-sm text-slate-600">
            Already have one?{" "}
            <Link href="/login" className="font-semibold underline">Sign in</Link>
          </p>

          <AuthRecovery />
          {message || auth.error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{message || auth.error}</p> : null}
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <Field label="Name" htmlFor="name">
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="name" autoComplete="name" maxLength={200} required className="pl-9" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
            </Field>
            <Field label="Email" htmlFor="email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="email" autoComplete="email" type="email" required className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" />
              </div>
            </Field>
            <Field label="Password" htmlFor="password" hint="At least 8 characters; additional Firebase policy may apply">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input id="password" aria-describedby="password-hint" autoComplete="new-password" maxLength={128} type="password" required minLength={8} className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
            </Field>

            <Field label="Confirm password" htmlFor="confirm-password">
              <Input id="confirm-password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your password" />
            </Field>
            <Button type="submit" loading={loading || auth.loading} className="w-full" size="lg">
              Create account
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}