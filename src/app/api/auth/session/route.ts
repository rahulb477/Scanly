import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse, ApiError, assertSameOrigin } from "@/lib/api";
import { verifyBearerToken, verifyFirebaseSession, SESSION_COOKIE, SESSION_DURATION_MS } from "@/lib/auth";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { logServerError, serverLog } from "@/lib/server-log";
import { FieldValue } from "firebase-admin/firestore";
import type { DecodedIdToken } from "firebase-admin/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Production-safe client messages. The real cause is only ever written to the
// server log, never returned to the browser.
const MESSAGE = {
  configuration: "Server authentication configuration is incomplete.",
  token: "Authentication session could not be verified.",
  firestore: "Account setup could not be completed.",
  unexpected: "Unable to complete account setup.",
} as const;

/**
 * Creates or repairs `users/{uid}` with the Admin SDK.
 *
 * Idempotent by design: "Retry setup" calls this route again and must never
 * create duplicate users/businesses/memberships or clobber profile fields the
 * account owner edited. Existing documents are only repaired where a field is
 * missing, and name/role/photo are never overwritten on an existing profile.
 */
async function ensureUserProfile(decoded: DecodedIdToken): Promise<void> {
  const db = getAdminDb();
  const ref = db.collection("users").doc(decoded.uid);
  const existing = await ref.get();

  // Read outside the transaction: an Auth lookup inside a Firestore transaction
  // holds the transaction open over a second network round trip.
  let record: { email?: string; displayName?: string; photoURL?: string | null } | undefined;
  if (!existing.exists) {
    try {
      record = await getAdminAuth().getUser(decoded.uid);
    } catch (error) {
      logServerError("auth-session", "auth-getUser", error, { uid: decoded.uid });
    }
  }

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) {
      transaction.set(ref, {
        uid: decoded.uid,
        email: record?.email || decoded.email || "",
        name: record?.displayName || decoded.name || "",
        photoURL: record?.photoURL ?? decoded.picture ?? null,
        role: "user",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }
    const data = snapshot.data() || {};
    const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (typeof data.uid !== "string" || !data.uid) patch.uid = decoded.uid;
    if (typeof data.role !== "string" || !data.role) patch.role = "user";
    const email = decoded.email || record?.email;
    if (email && data.email !== email) patch.email = email;
    transaction.update(ref, patch);
  });
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    assertSameOrigin(request);

    // Stage 1 — server Firebase Admin configuration.
    try {
      getAdminAuth();
      getAdminDb();
    } catch (error) {
      logServerError("auth-session", "configuration", error);
      throw new ApiError(503, "firebase/configuration-missing", MESSAGE.configuration);
    }

    // Stage 2 — verify the Firebase ID token from the Authorization header.
    let decoded: DecodedIdToken;
    try {
      decoded = await verifyBearerToken(request);
    } catch (error) {
      const unavailable = error instanceof ApiError && error.status === 503;
      logServerError("auth-session", "verify-id-token", error);
      throw new ApiError(unavailable ? 503 : 401, unavailable ? "firebase/auth-unavailable" : "auth/user-token-expired", MESSAGE.token);
    }

    // Stage 3 — profile create/repair (Admin SDK bypasses client rules).
    try {
      await ensureUserProfile(decoded);
    } catch (error) {
      logServerError("auth-session", "profile", error, { uid: decoded.uid });
      throw new ApiError(503, "firestore/profile-failed", MESSAGE.firestore);
    }

    // Stage 4 — exchange the verified token for an httpOnly session cookie.
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) throw new ApiError(401, "auth/missing-token", MESSAGE.token);
    let session: string;
    try {
      session = await getAdminAuth().createSessionCookie(authorization.slice(7), { expiresIn: SESSION_DURATION_MS });
    } catch (error) {
      logServerError("auth-session", "create-session-cookie", error, { uid: decoded.uid });
      throw new ApiError(401, "auth/user-token-expired", MESSAGE.token);
    }

    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(SESSION_COOKIE, session, { httpOnly: true, secure: process.env.NODE_ENV === "production" || request.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: SESSION_DURATION_MS / 1000 });
    // Retire an existing legacy cookie without consulting the old database.
    response.cookies.set("qr_session", "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" });
    serverLog("auth-session", "session-created", { uid: decoded.uid, ms: Date.now() - startedAt });
    return response;
  } catch (error) {
    if (error instanceof ApiError) return apiErrorResponse(error);
    logServerError("auth-session", "unexpected", error);
    return apiErrorResponse(new ApiError(500, "server/request-failed", MESSAGE.unexpected));
  }
}

export async function DELETE(request: NextRequest) {
  try { assertSameOrigin(request); } catch (error) { return apiErrorResponse(error); }
  let response: NextResponse = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  try {
    // Firebase token revocation also invalidates copied SSR cookies; signOut alone
    // only clears browser persistence. This signs out this account's other sessions.
    let uid: string | undefined;
    if (request.headers.has("authorization")) {
      try { uid = (await verifyBearerToken(request)).uid; }
      catch (error) {
        logServerError("auth-session", "logout-verify-token", error);
        if (!(typeof error === "object" && error !== null && "status" in error && error.status === 401)) throw error;
      }
    }
    // A failed browser token refresh must still permit authenticated cookie logout.
    // This exception is DELETE-only; protected data APIs never authenticate via cookies.
    const session = request.cookies.get(SESSION_COOKIE)?.value;
    if (!uid && session) uid = (await verifyFirebaseSession(session))?.uid;
    if (uid) await getAdminAuth().revokeRefreshTokens(uid);
  } catch (error) {
    logServerError("auth-session", "logout", error);
    response = apiErrorResponse(error);
  }
  // Always clear the local SSR cookie, even if revocation is unavailable.
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  response.cookies.set("qr_session", "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" });
  return response;
}
