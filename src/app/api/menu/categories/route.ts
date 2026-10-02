import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { menuCategories } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireUser, requireBusinessAccess } from "@/lib/auth";
import { nanoid } from "nanoid";

const input = z.object({
  businessId: z.string().min(1).max(64),
  name: z.string().min(1).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const parsed = input.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    await requireBusinessAccess(user.id, parsed.data.businessId);

    // Determine sortOrder
    const [{ next: maxOrder }] = await db
      .select({ next: sql<number>`COALESCE(MAX(${menuCategories.sortOrder}), -1) + 1` })
      .from(menuCategories)
      .where(eq(menuCategories.businessId, parsed.data.businessId));

    const id = nanoid();
    await db.insert(menuCategories).values({
      id,
      businessId: parsed.data.businessId,
      name: parsed.data.name,
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