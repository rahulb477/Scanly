import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireBusinessAccess } from "@/lib/auth";
import { apiErrorResponse, identifier } from "@/lib/api";
import { deleteMenuEntry } from "@/lib/data/repository";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const businessId = identifier.parse(request.nextUrl.searchParams.get("businessId"));
    const id = identifier.parse((await params).id);
    await requireBusinessAccess(user.uid, businessId, "menu");
    await deleteMenuEntry(businessId, "menuCategories", id);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiErrorResponse(error); }
}
