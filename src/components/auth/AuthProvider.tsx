"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile, validatePassword, type User } from "firebase/auth";
import { getFirebaseClient } from "@/lib/firebase/client";
import { authErrorMessage, ClientError } from "@/lib/firebase/errors";
import { ensureUserProfile } from "@/lib/firebase/profile";
import { createServerSession } from "@/lib/firebase/session";
import { signupSchema, validatedEmail } from "@/lib/firebase/validation";
import { requestJson } from "@/lib/http-client";

type SignupInput = { name: string; email: string; password: string; confirmPassword: string };
type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  googleEnabled: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (input: SignupInput) => Promise<User>;
  loginWithGoogle: () => Promise<User>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  retrySession: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const googleEnabled = process.env.NEXT_PUBLIC_FIREBASE_GOOGLE_ENABLED === "true";

  const synchronize = useCallback(async (current: User) => {
    // The token-verified server route is authoritative: it creates or repairs
    // users/{uid} with the Admin SDK and issues the httpOnly SSR cookie. The
    // direct Firestore sync afterwards only refreshes the client-owned fields and
    // is tolerated to fail when the deployed rules are stale.
    await createServerSession();
    await ensureUserProfile(current);
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    try {
      const { auth } = getFirebaseClient();
      unsubscribe = onAuthStateChanged(auth, async (current) => {
        const revision = ++generation.current;
        if (busy.current) return;
        setLoading(true);
        setReady(false);
        try {
          if (current) await synchronize(current);
          if (active && revision === generation.current) {
            setUser(current);
            setReady(Boolean(current));
            setError(null);
          }
        } catch (failure) {
          if (active && revision === generation.current) {
            setUser(current);
            setError(authErrorMessage(failure));
          }
        } finally {
          if (active && revision === generation.current) setLoading(false);
        }
      });
    } catch (failure) {
      // Run in the effect, not module scope: missing runtime config never breaks a build.
      queueMicrotask(() => { if (active) { setError(authErrorMessage(failure)); setLoading(false); } });
    }
    return () => { active = false; unsubscribe?.(); };
  }, [synchronize]);

  async function authenticate(action: () => Promise<User>): Promise<User> {
    if (busy.current) throw new ClientError("A sign-in request is already in progress.");
    busy.current = true;
    generation.current++;
    setLoading(true);
    setReady(false);
    setError(null);
    try {
      const current = await action();
      await synchronize(current);
      if (getFirebaseClient().auth.currentUser?.uid !== current.uid) throw new ClientError("Your sign-in changed. Please sign in again.", "auth/user-token-expired");
      setUser(current);
      setReady(true);
      return current;
    } catch (failure) {
      // If Firebase created the account but profile/session setup failed, retain the
      // real Firebase user and offer a retry; never claim the account was rolled back.
      try { setUser(getFirebaseClient().auth.currentUser); } catch { setUser(null); }
      setError(authErrorMessage(failure));
      throw failure;
    } finally { busy.current = false; setLoading(false); }
  }

  async function login(email: string, password: string) {
    const normalized = validatedEmail(email);
    if (!password) throw new ClientError("Enter your password.", "auth/missing-password");
    return authenticate(async () => (await signInWithEmailAndPassword(getFirebaseClient().auth, normalized, password)).user);
  }

  async function signup(input: SignupInput) {
    const parsed = signupSchema.safeParse(input);
    if (!parsed.success) throw new ClientError(parsed.error.issues[0].message, "client/validation");
    return authenticate(async () => {
      const { auth } = getFirebaseClient();
      // Official Auth emulators return HTTP 501 for the passwordPolicy API.
      // App-level validation still applies; the real project policy is checked in live mode.
      const policy = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" ? null : await validatePassword(auth, parsed.data.password);
      if (policy && !policy.isValid) {
        const requirements: string[] = [];
        if (policy.meetsMinPasswordLength === false) requirements.push(`at least ${policy.passwordPolicy.customStrengthOptions.minPasswordLength} characters`);
        if (policy.meetsMaxPasswordLength === false) requirements.push(`no more than ${policy.passwordPolicy.customStrengthOptions.maxPasswordLength} characters`);
        if (policy.containsLowercaseLetter === false) requirements.push("a lowercase letter");
        if (policy.containsUppercaseLetter === false) requirements.push("an uppercase letter");
        if (policy.containsNumericCharacter === false) requirements.push("a number");
        if (policy.containsNonAlphanumericCharacter === false) requirements.push("a symbol");
        throw new ClientError(`Password must include ${requirements.join(", ") || "all required characters"}.`, "auth/weak-password");
      }
      const credential = await createUserWithEmailAndPassword(auth, validatedEmail(parsed.data.email), parsed.data.password);
      await updateProfile(credential.user, { displayName: parsed.data.name });
      return credential.user;
    });
  }

  async function loginWithGoogle() {
    if (!googleEnabled) throw new ClientError("Google sign-in is not enabled. Use email and password.", "auth/operation-not-allowed");
    return authenticate(async () => (await signInWithPopup(getFirebaseClient().auth, new GoogleAuthProvider())).user);
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(getFirebaseClient().auth, validatedEmail(email));
  }

  async function logout() {
    busy.current = true;
    generation.current++;
    setLoading(true);
    setReady(false);
    let failure: unknown;
    try {
      const { auth } = getFirebaseClient();
      let headers: { Authorization: string } | undefined;
      // A failed/expired token refresh must not prevent local signOut or cookie clearing.
      // The same-origin DELETE also accepts the verified Firebase session cookie.
      try { if (auth.currentUser) headers = { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` }; } catch { /* Session-cookie fallback. */ }
      try { await requestJson("/api/auth/session", { method: "DELETE", headers }); }
      catch (error) { failure = error; }
      finally { await signOut(auth); }
    } finally {
      busy.current = false;
      setUser(null);
      setError(null);
      setLoading(false);
    }
    if (failure) throw failure;
  }

  async function retrySession() {
    const current = getFirebaseClient().auth.currentUser;
    if (!current) throw new ClientError("Please sign in again.", "auth/user-token-expired");
    await authenticate(async () => current);
  }

  return <AuthContext.Provider value={{ user, loading, isAuthenticated: Boolean(user && ready), error, googleEnabled, login, signup, loginWithGoogle, logout, resetPassword, retrySession }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
