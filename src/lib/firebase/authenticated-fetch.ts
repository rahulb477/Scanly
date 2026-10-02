"use client";

import { getFirebaseClient } from "./client";
import { ClientError } from "./errors";

// Every protected API derives identity from this verified token, never a request body.
export async function authenticatedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const { auth } = getFirebaseClient();
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new ClientError("Your session expired. Please sign in again.", "auth/user-token-expired", 401);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  let response: Response;
  try { response = await fetch(url, { ...init, headers, cache: "no-store" }); }
  catch { throw new ClientError("Unable to reach the server. Check your connection and try again.", "client/network-unavailable"); }
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new ClientError("The server returned an unexpected response. Check the server Firebase configuration.", "client/invalid-response", response.status);
  }
  return response;
}
