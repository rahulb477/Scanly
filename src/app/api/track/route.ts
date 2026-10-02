import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, ApiError, identifier, jsonBody } from "@/lib/api";
import { getBusiness } from "@/lib/data/repository";
import { EVENT_TYPES, trackEvent } from "@/lib/analytics";
import { rateLimit, requestIp } from "@/lib/ratelimit";

// No email, customer text, IP, user-agent, URL query strings or arbitrary metadata.
const input = z.strictObject({ businessId: identifier, type: z.enum(EVENT_TYPES), sessionId: z.string().uuid().optional() });
export async function POST(request: NextRequest) {
  try {
    const data = input.parse(await jsonBody(request));
    const business = await getBusiness(data.businessId);
    if (!business?.isPublished || business.deleting) throw new ApiError(404, "business/not-found", "Business not found.");
    if (!await rateLimit(`track:${requestIp(request)}`, 200, 60_000)) throw new ApiError(429, "request/rate-limited", "Too many tracking requests.");
    await trackEvent(data.businessId, data.type, data.sessionId);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiErrorResponse(error); }
}
