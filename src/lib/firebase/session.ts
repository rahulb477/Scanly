"use client";

import { getFirebaseClient } from "./client";
import { ClientError } from "./errors";
import { requestJson } from "@/lib/http-client";

/**
 * Browser → /api/auth/session.
 *
 * The request is the only place the Firebase ID token crosses the network, so
 * this is the single point where the request shape is observable. The log lines
 * deliberately contain no secret: the header's presence, the token's length,
 * the method, the URL and the HTTP status. The token itself is never logged,
 * copied or stored anywhere.
 */
export const SESSION_ENDPOINT = "/api/auth/session";

export type SessionRequestLog = {
  authorizationHeaderPresent: boolean;
  authorizationScheme: "Bearer" | "missing";
  idTokenLength: number;
  method: "POST";
  url: string;
  responseStatus?: number;
  ok?: boolean;
  errorCode?: string;
};

function log(entry: SessionRequestLog): void {
  // Browser console only. No secret ever reaches this line.
  console.info("[Scanly auth] POST /api/auth/session", entry);
}

/**
 * Exchanges a freshly refreshed Firebase ID token for the httpOnly session
 * cookie. `getIdToken(true)` forces a refresh so a cached token that expired
 * while the tab was open can never be sent to the server.
 */
export async function createServerSession(): Promise<void> {
  const { auth } = getFirebaseClient();
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new ClientError("Your session expired. Please sign in again.", "auth/user-token-expired", 401);

  const idToken = await user.getIdToken(true);
  const entry: SessionRequestLog = {
    authorizationHeaderPresent: Boolean(idToken),
    authorizationScheme: idToken ? "Bearer" : "missing",
    idTokenLength: idToken.length,
    method: "POST",
    url: SESSION_ENDPOINT,
  };

  try {
    await requestJson(SESSION_ENDPOINT, { method: "POST", headers: { Authorization: `Bearer ${idToken}` } });
    log({ ...entry, responseStatus: 200, ok: true });
  } catch (error) {
    const status = error instanceof ClientError ? error.status : undefined;
    const code = error instanceof ClientError ? error.code : undefined;
    log({ ...entry, responseStatus: status, ok: false, errorCode: code });
    throw error;
  }
}
