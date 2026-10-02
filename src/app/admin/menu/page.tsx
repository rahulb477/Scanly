import { requireActiveBusiness } from "@/lib/admin";
import { db } from "@/db";
import { menuCategories, menuItems } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { MenuClient } from "./MenuClient";

export const dynamic = "force-dynamic";

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const { business } = await requireActiveBusiness(sp);
  const cats = await db
    .select()
    .from(menuCategories)
    .where(eq(menuCategories.businessId, business.id))
    .orderBy(asc(menuCategories.sortOrder));
  const items = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.businessId, business.id))
    .orderBy(asc(menuItems.sortOrder));
  return <MenuClient business={business} categories={cats} items={items} />;
}