import { NextRequest, NextResponse } from "next/server";
import { apiErrorResponse, ApiError, identifier } from "@/lib/api";
import { getBusiness, getMenu } from "@/lib/data/repository";

export async function GET(request: NextRequest) {
  try {
    const businessId = identifier.parse(request.nextUrl.searchParams.get("businessId"));
    const business = await getBusiness(businessId);
    if (!business || !business.isPublished || business.deleting) throw new ApiError(404, "business/not-found", "Business not found.");
    if (!business.menuEnabled) throw new ApiError(403, "menu/disabled", "This menu is not published.");
    const menu = await getMenu(businessId, true);
    return NextResponse.json({ items: menu.items.map(({ id, name, categoryId }) => ({ id, name, categoryId })) });
  } catch (error) { return apiErrorResponse(error); }
}
