import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse, assertSameOrigin } from "@/lib/api";
import { verifyBearerToken, verifyFirebaseSession, SESSION_COOKIE, SESSION_DURATION_MS } from "@/lib/auth";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const decoded = await verifyBearerToken(request);
    // The Web SDK creates the default profile first. Repair it server-side if a
    // previous write was interrupted; identity is always from the verified token.
    const ref = getAdminDb().collection("users").doc(decoded.uid);
    await getAdminDb().runTransaction(async (transaction) => {
      const current = await transaction.get(ref);
      if (!current.exists) {
        // updateProfile does not force-refresh existing ID-token name claims.
        const record = await getAdminAuth().getUser(decoded.uid);
        transaction.set(ref, { uid: decoded.uid, email: record.email || "", name: record.displayName || "", photoURL: record.photoURL || null, role: "user", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      }
      else transaction.update(ref, { email: decoded.email || "", updatedAt: FieldValue.serverTimestamp() });
    });
    const session = await getAdminAuth().createSessionCookie(request.headers.get("authorization")!.slice(7), { expiresIn: SESSION_DURATION_MS });
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(SESSION_COOKIE, session, { httpOnly: true, secure: process.env.NODE_ENV === "production" || request.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: SESSION_DURATION_MS / 1000 });
    // Retire an existing legacy cookie without consulting the old database.
    response.cookies.set("qr_session", "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" });
    return response;
  } catch (error) { return apiErrorResponse(error); }
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
        if (!(typeof error === "object" && error !== null && "status" in error && error.status === 401)) throw error;
      }
    }
    // A failed browser token refresh must still permit authenticated cookie logout.
    // This exception is DELETE-only; protected data APIs never authenticate via cookies.
    const session = request.cookies.get(SESSION_COOKIE)?.value;
    if (!uid && session) uid = (await verifyFirebaseSession(session))?.uid;
    if (uid) await getAdminAuth().revokeRefreshTokens(uid);
  } catch (error) { response = apiErrorResponse(error); }
  // Always clear the local SSR cookie, even if revocation is unavailable.
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  response.cookies.set("qr_session", "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" });
  return response;
}
