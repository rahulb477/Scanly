import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { menuItems } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 });
  const items = await db
    .select({
      id: menuItems.id,
      name: menuItems.name,
      categoryId: menuItems.categoryId,
    })
    .from(menuItems)
    .where(and(eq(menuItems.businessId, businessId), eq(menuItems.available, true)));
  return NextResponse.json({ items });
}