import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse, ApiError } from "@/lib/api";
import { getBusinessBySlug } from "@/lib/data/repository";
import { rateLimit, requestIp } from "@/lib/ratelimit";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const business = await getBusinessBySlug((await params).slug);
    if (!business || !business.wifiEnabled || !business.wifiPublicSharingEnabled) throw new ApiError(404, "wifi/not-published", "Guest Wi-Fi sharing is not enabled for this business.");
    if (!await rateLimit(`wifi:${requestIp(request)}`, 60, 60_000)) throw new ApiError(429, "request/rate-limited", "Too many requests. Try again later.");
    return NextResponse.json({ name: business.wifiName, password: business.wifiSecurity === "Open" ? null : business.wifiPassword, security: business.wifiSecurity }, { headers: { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" } });
  } catch (error) { return apiErrorResponse(error); }
}
