import { requireActiveBusiness } from "@/lib/admin";
import { getMenu } from "@/lib/data/repository";
import { MenuClient } from "./MenuClient";
export const dynamic = "force-dynamic";
export default async function MenuPage({ searchParams }: { searchParams: Promise<{ businessId?: string }> }) {
  const { business } = await requireActiveBusiness(await searchParams);
  const { categories, items } = await getMenu(business.id);
  return <MenuClient business={business} categories={categories} items={items} />;
}
