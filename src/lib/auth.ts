import "server-only";

import { cookies } from "next/headers";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { ApiError } from "@/lib/api";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { SessionUser } from "@/lib/data/types";
export { getBusinessesForUser, requireBusinessAccess } from "@/lib/data/repository";
export type { SessionUser } from "@/lib/data/types";

export const SESSION_COOKIE = "scanly_firebase_session";
export const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Classifies the header without ever copying the token into a log: only the
 * scheme, whether it is present, and the token's length are reported.
 */
export function describeAuthorization(header: string | null): { present: boolean; scheme: "bearer" | "other" | "missing"; tokenLength: number } {
  if (!header) return { present: false, scheme: "missing", tokenLength: 0 };
  if (header.startsWith("Bearer ")) return { present: true, scheme: "bearer", tokenLength: header.length - "Bearer ".length };
  // Never echo the value: an unexpected scheme may be a raw token.
  return { present: true, scheme: "other", tokenLength: header.length };
}

/**
 * True when the Admin SDK could not authenticate to Google at all (revoked or
 * deleted service-account key, wrong client_email, missing IAM role).
 *
 * These codes are what firebase-admin raises when the OAuth2 token exchange for
 * the service account fails (`app/invalid-credential` = `invalid_grant`) or when
 * the backend rejects the call as unauthenticated (gRPC 16). They are a
 * deployment problem: the ID token itself was never the issue.
 */
export function isAdminCredentialError(error: unknown): boolean {
  const record = typeof error === "object" && error !== null ? (error as { code?: unknown }) : {};
  const code = typeof record.code === "string" || typeof record.code === "number" ? String(record.code) : "";
  return ["app/invalid-credential", "auth/invalid-credential", "auth/insufficient-permission", "auth/internal-error", "16"].includes(code);
}

export async function verifyBearerToken(request: Request): Promise<DecodedIdToken> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ") || header.length < 8) throw new ApiError(401, "auth/missing-token", "Please sign in to access this resource.");
  const auth = getAdminAuth();
  try { return await auth.verifyIdToken(header.slice(7), true); }
  catch (error) {
    if (invalidFirebaseToken(error)) throw new ApiError(401, "auth/invalid-token", "Your session is invalid or expired. Please sign in again.", error);
    if (isAdminCredentialError(error)) throw new ApiError(503, "firebase/admin-credential-invalid", "Server Firebase credentials were rejected by Google. Regenerate the service-account key and redeploy.", error);
    throw new ApiError(503, "firebase/auth-unavailable", "Firebase Authentication could not verify your session. Retry, or ask the administrator to check server credentials and permissions.", error);
  }
}

function invalidFirebaseToken(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  return ["auth/argument-error", "auth/invalid-argument", "auth/invalid-id-token", "auth/id-token-expired", "auth/id-token-revoked", "auth/user-disabled", "auth/user-not-found", "auth/invalid-session-cookie", "auth/session-cookie-expired", "auth/session-cookie-revoked"].includes(code);
}

export async function verifyFirebaseSession(session: string): Promise<DecodedIdToken | null> {
  const auth = getAdminAuth();
  try { return await auth.verifySessionCookie(session, true); }
  catch (error) {
    if (invalidFirebaseToken(error)) return null;
    if (isAdminCredentialError(error)) throw new ApiError(503, "firebase/admin-credential-invalid", "Server Firebase credentials were rejected by Google. Regenerate the service-account key and redeploy.", error);
    throw new ApiError(503, "firebase/auth-unavailable", "Firebase Authentication could not verify your session. Retry, or ask the administrator to check server credentials and permissions.", error);
  }
}

function identity(token: DecodedIdToken): SessionUser {
  return { id: token.uid, uid: token.uid, email: token.email || "", name: token.name || null, role: "user" };
}

// Protected APIs MUST pass their request. Cookies are only used by server pages.
export async function requireUser(request: Request): Promise<SessionUser> {
  return identity(await verifyBearerToken(request));
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) return null;
  const token = await verifyFirebaseSession(session);
  if (!token) return null;
  const profile = (await getAdminDb().collection("users").doc(token.uid).get()).data();
  return { ...identity(token), name: profile?.name || token.name || null };
}
