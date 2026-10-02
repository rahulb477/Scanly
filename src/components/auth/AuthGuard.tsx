"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated, user, error } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !isAuthenticated) router.replace("/login"); }, [loading, isAuthenticated, router]);
  if (loading) return <main className="grid min-h-screen place-items-center" role="status">Verifying your session…</main>;
  if (!isAuthenticated || !user) return <main className="grid min-h-screen place-items-center">{error || "Redirecting to sign in…"}</main>;
  return children;
}
