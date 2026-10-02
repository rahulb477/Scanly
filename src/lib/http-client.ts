import { ClientError } from "@/lib/firebase/errors";

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { ...init, cache: "no-store" }); }
  catch { throw new ClientError("Unable to reach the server. Check your connection and try again.", "client/network-unavailable"); }
  if (!response.headers.get("content-type")?.includes("application/json")) {
    // A non-JSON body means the server never ran the route's error handling
    // (crashed or platform-level failure), so report the status to make the
    // server log entry findable. Never claim success here.
    throw new ClientError(`The server returned an unexpected response (HTTP ${response.status}). Ask the administrator to check the server configuration.`, "client/invalid-response", response.status);
  }
  let data: T & { error?: string; code?: string };
  try { data = await response.json(); }
  catch { throw new ClientError("The server returned an invalid response. Please try again.", "client/invalid-response", response.status); }
  if (!response.ok) throw new ClientError(data.error || "The request failed. Please try again.", data.code || "client/api-error", response.status);
  return data;
}
