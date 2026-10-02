"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { Button } from "@/components/ui/Button";
import { authErrorMessage } from "@/lib/firebase/errors";

export function AuthRecovery() {
  const { user, error, isAuthenticated, retrySession, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  if (!user || isAuthenticated || !error) return null;
  return <div className="mb-5 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm" role="alert">
    <p>You are signed in to Firebase, but profile or dashboard setup did not finish. Your account still exists; retry setup instead of creating it again.</p>
    <p>{failure || error}</p>
    <div className="flex gap-2">
      <Button size="sm" loading={busy} onClick={async () => { setBusy(true); try { await retrySession(); } catch (error) { setFailure(authErrorMessage(error)); } finally { setBusy(false); } }}>Retry setup</Button>
      <Button size="sm" variant="secondary" disabled={busy} onClick={async () => { try { await logout(); } catch (error) { setFailure(authErrorMessage(error)); } }}>Sign out</Button>
    </div>
  </div>;
}
