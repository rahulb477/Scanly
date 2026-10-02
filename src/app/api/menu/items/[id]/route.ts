import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, requireBusinessAccess } from "@/lib/auth";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  price: z.string().min(1).max(32).optional(),
  image: z.string().max(2_000_000).optional().nullable(),
  categoryId: z.string().max(64).optional(),
  available: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const [item] = await db
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, id))
      .limit(1);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireBusinessAccess(user.id, item.businessId);
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    await db.update(menuItems).set(parsed.data).where(eq(menuItems.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const [item] = await db
      .select()
      .from(menuItems)
      .where(eq(menuItems.id, id))
      .limit(1);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireBusinessAccess(user.id, item.businessId);
    await db.delete(menuItems).where(eq(menuItems.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}