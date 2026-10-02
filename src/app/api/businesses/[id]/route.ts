import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireBusinessAccess } from "@/lib/auth";
import { apiErrorResponse, identifier, jsonBody } from "@/lib/api";
import { businessUpdateSchema } from "@/lib/data/validation";
import { updateBusiness, deleteBusiness } from "@/lib/data/repository";
import { sanitizeText } from "@/lib/utils";
import { logActivity } from "@/lib/analytics";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const id = identifier.parse((await context.params).id);
    await requireBusinessAccess(user.uid, id, "manage");
    const input = businessUpdateSchema.parse(await jsonBody(request));
    if (input.description !== undefined) input.description = sanitizeText(input.description, 2000);
    await updateBusiness(id, input);
    await logActivity(id, "settings_updated", "Business settings updated", user.uid);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiErrorResponse(error); }
}
export async function DELETE(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const id = identifier.parse((await context.params).id);
    await requireBusinessAccess(user.uid, id, "owner");
    await deleteBusiness(id);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiErrorResponse(error); }
}
export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await requireUser(request);
    const id = identifier.parse((await context.params).id);
    const { business, role } = await requireBusinessAccess(user.uid, id);
    return NextResponse.json({ business, memberRole: role }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
