import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireBusinessAccess } from "@/lib/auth";
import { apiErrorResponse, jsonBody } from "@/lib/api";
import { menuItemSchema } from "@/lib/data/validation";
import { createMenuEntry } from "@/lib/data/repository";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const { businessId, ...input } = menuItemSchema.parse(await jsonBody(request));
    await requireBusinessAccess(user.uid, businessId, "menu");
    const id = await createMenuEntry(businessId, "menuItems", { ...input, description: input.description || null, image: input.image || null, available: true });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
