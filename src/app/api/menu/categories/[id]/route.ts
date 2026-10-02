import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { menuCategories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, requireBusinessAccess } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const [cat] = await db
      .select({ businessId: menuCategories.businessId })
      .from(menuCategories)
      .where(eq(menuCategories.id, id))
      .limit(1);
    if (!cat) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireBusinessAccess(user.id, cat.businessId);
    await db.delete(menuCategories).where(eq(menuCategories.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}