"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { authErrorMessage } from "@/lib/firebase/errors";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  return <main className="grid min-h-screen place-items-center px-6 py-12">
    <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold">Reset your password</h1>
      <p className="mt-2 text-sm text-slate-600">Enter your account email to receive a password reset link.</p>
      <form className="mt-6 space-y-4" onSubmit={async (event) => {
        event.preventDefault(); setLoading(true); setMessage(null); setSuccess(false);
        try { await resetPassword(email); setSuccess(true); setMessage("Password reset email sent. If an account exists, check its inbox and spam folder."); }
        catch (error) { setMessage(authErrorMessage(error)); }
        finally { setLoading(false); }
      }}>
        <Field label="Email" htmlFor="reset-email"><Input id="reset-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
        {message ? <p role={success ? "status" : "alert"} className={success ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{message}</p> : null}
        <Button type="submit" loading={loading} className="w-full">Send reset email</Button>
      </form>
      <Link className="mt-6 block text-center text-sm underline" href="/login">Back to sign in</Link>
    </section>
  </main>;
}
