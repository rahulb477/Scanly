import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireBusinessAccess } from "@/lib/auth";
import { apiErrorResponse, identifier, jsonBody } from "@/lib/api";
import { menuItemUpdateSchema } from "@/lib/data/validation";
import { updateMenuItem, deleteMenuEntry } from "@/lib/data/repository";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const user = await requireUser(request);
    const businessId = identifier.parse(request.nextUrl.searchParams.get("businessId"));
    const id = identifier.parse((await params).id);
    await requireBusinessAccess(user.uid, businessId, "menu");
    const input = menuItemUpdateSchema.parse(await jsonBody(request));
    await updateMenuItem(businessId, id, input);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiErrorResponse(error); }
}
export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const user = await requireUser(request);
    const businessId = identifier.parse(request.nextUrl.searchParams.get("businessId"));
    const id = identifier.parse((await params).id);
    await requireBusinessAccess(user.uid, businessId, "menu");
    await deleteMenuEntry(businessId, "menuItems", id);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiErrorResponse(error); }
}
