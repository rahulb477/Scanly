import { requireActiveBusiness } from "@/lib/admin";
import { AppearanceForm } from "./AppearanceForm";

export const dynamic = "force-dynamic";

export default async function AppearancePage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const { business } = await requireActiveBusiness(sp);
  return <AppearanceForm business={business} />;
}