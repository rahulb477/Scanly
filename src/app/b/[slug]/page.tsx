import { notFound } from "next/navigation";
import { getBusinessBySlug, getMenu } from "@/lib/data/repository";
import { publicBusiness } from "@/lib/data/business";
import { getTheme } from "@/lib/themes";
import { BusinessLanding } from "./BusinessLanding";

export const dynamic = "force-dynamic";
export default async function PublicBusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const business = await getBusinessBySlug((await params).slug);
  if (!business) notFound();
  const menu = business.menuEnabled ? await getMenu(business.id, true) : { categories: [], items: [] };
  return <BusinessLanding business={publicBusiness(business)} categories={menu.categories} items={menu.items} theme={getTheme(business.theme)} />;
}
