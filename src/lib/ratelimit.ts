import "server-only";
import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";

// Shared between Vercel instances. Raw IPs/identities are never stored in buckets.
export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const ref = getAdminDb().collection("_rateLimits").doc(createHash("sha256").update(key).digest("hex"));
  return getAdminDb().runTransaction(async (transaction) => {
    const data = (await transaction.get(ref)).data();
    if (!data || data.resetAt.toMillis() <= now) {
      transaction.set(ref, { count: 1, resetAt: Timestamp.fromMillis(now + windowMs), expiresAt: Timestamp.fromMillis(now + windowMs * 2) });
      return true;
    }
    if (data.count >= max) return false;
    transaction.update(ref, { count: data.count + 1 });
    return true;
  });
}
export function requestIp(request: Request) { return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local"; }
