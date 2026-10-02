import { requireActiveBusiness } from "@/lib/admin";
import { GoogleForm } from "./GoogleForm";

export const dynamic = "force-dynamic";

export default async function GooglePage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const { business } = await requireActiveBusiness(sp);
  return <GoogleForm business={business} />;
}