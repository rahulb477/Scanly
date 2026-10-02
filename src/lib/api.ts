import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { firebaseErrorCode } from "@/lib/firebase/errors";

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); this.name = "ApiError"; }
}
export const identifier = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, "Invalid identifier.");

export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid input.", code: "request/invalid-input" }, { status: 400 });
  const code = firebaseErrorCode(error);
  if (code === "firebase/configuration-missing") {
    return NextResponse.json({ error: "Server Firebase configuration missing or invalid. Ask the administrator to configure secure Firebase Admin environment variables and redeploy.", code }, { status: 503 });
  }
  if (code && ["auth/insufficient-permission", "auth/internal-error", "auth/invalid-credential"].includes(code)) {
    return NextResponse.json({ error: "Firebase Authentication is unavailable. Ask the administrator to check secure server credentials and Auth permissions.", code: "firebase/auth-unavailable" }, { status: 503 });
  }
  if (code?.startsWith("auth/")) {
    return NextResponse.json({ error: "Your session is invalid or expired. Please sign in again.", code: "auth/user-token-expired" }, { status: 401 });
  }
  // Never return raw SDK errors, private keys, connection strings or stack traces.
  const grpcCode = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  // 7 PERMISSION_DENIED / 16 UNAUTHENTICATED from the Admin SDK mean the server's
  // service-account credentials or IAM roles are wrong — a deployment problem,
  // not a transient outage and not something the signed-in user can fix.
  const misconfigured = grpcCode === 7 || grpcCode === 16;
  const status = misconfigured || grpcCode === 14 || grpcCode === 4 ? 503 : 500;
  return NextResponse.json({ error: misconfigured ? "Server Firebase configuration is incomplete. Ask the administrator to check the service-account credentials, IAM roles and redeploy." : status === 503 ? "Firebase is temporarily unavailable. Please try again." : "The server could not complete this request. Check Firebase configuration and service permissions.", code: "server/request-failed" }, { status });
}

export async function jsonBody(request: Request): Promise<unknown> {
  const limit = 64 * 1024;
  if (Number(request.headers.get("content-length")) > limit) throw new ApiError(413, "request/too-large", "Request body exceeds the 64 KB limit.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "request/invalid-json", "Send a valid JSON request.");
  try {
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) {
        await reader.cancel();
        throw new ApiError(413, "request/too-large", "Request body exceeds the 64 KB limit.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "request/invalid-json", "Send a valid JSON request.");
  } finally { reader.releaseLock(); }
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host") || new URL(request.url).host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || new URL(request.url).protocol.replace(":", "");
  const site = request.headers.get("sec-fetch-site");
  try {
    if (!origin || new URL(origin).origin !== new URL(`${protocol}://${host}`).origin || (site && site !== "same-origin" && site !== "none")) throw new Error("Origin mismatch");
  } catch { throw new ApiError(403, "request/cross-origin", "Cross-origin session requests are not allowed."); }
}
