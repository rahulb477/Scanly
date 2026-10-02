import "server-only";
import { headers } from "next/headers";
import { publicBusinessUrl } from "@/lib/utils";

export async function serverBusinessUrl(slug: string) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || (process.env.NODE_ENV === "development" ? "http" : "https");
  return publicBusinessUrl(slug, host ? `${protocol}://${host}` : undefined);
}
