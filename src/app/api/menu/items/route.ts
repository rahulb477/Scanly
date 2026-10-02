import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { menuItems, menuCategories } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireUser, requireBusinessAccess } from "@/lib/auth";
import { nanoid } from "nanoid";

const input = z.object({
  businessId: z.string().min(1).max(64),
  categoryId: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.string().min(1).max(32),
  image: z.string().max(2_000_000).optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = input.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    await requireBusinessAccess(user.id, parsed.data.businessId);

    const [{ next: maxOrder }] = await db
      .select({ next: sql<number>`COALESCE(MAX(${menuItems.sortOrder}), -1) + 1` })
      .from(menuItems)
      .where(eq(menuItems.businessId, parsed.data.businessId));

    const id = nanoid();
    await db.insert(menuItems).values({
      id,
      businessId: parsed.data.businessId,
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      price: parsed.data.price,
      image: parsed.data.image || null,
      sortOrder: Number(maxOrder ?? 0),
    });
    return NextResponse.json({ id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}