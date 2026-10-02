import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireBusinessAccess } from "@/lib/auth";
import { apiErrorResponse, jsonBody } from "@/lib/api";
import { categorySchema } from "@/lib/data/validation";
import { createMenuEntry } from "@/lib/data/repository";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const input = categorySchema.parse(await jsonBody(request));
    await requireBusinessAccess(user.uid, input.businessId, "menu");
    const id = await createMenuEntry(input.businessId, "menuCategories", { name: input.name });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
