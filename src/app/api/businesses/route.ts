import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createBusiness, getBusinessesForUser } from "@/lib/data/repository";
import { createBusinessSchema } from "@/lib/data/validation";
import { apiErrorResponse, ApiError, jsonBody } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { logActivity } from "@/lib/analytics";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    return NextResponse.json({ businesses: await getBusinessesForUser(user.uid) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const input = createBusinessSchema.parse(await jsonBody(request));
    if (!await rateLimit(`create-biz:${user.uid}`, 10, 60_000)) throw new ApiError(429, "request/rate-limited", "Too many business creation attempts. Try again later.");
    const business = await createBusiness(user.uid, input.businessName, input.category);
    await logActivity(business.id, "business_created", "Business created", user.uid);
    return NextResponse.json({ business }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
