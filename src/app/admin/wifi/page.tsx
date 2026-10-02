import { requireActiveBusiness } from "@/lib/admin";
import { WifiForm } from "./WifiForm";

export const dynamic = "force-dynamic";

export default async function WifiPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const { business } = await requireActiveBusiness(sp);
  return <WifiForm business={business} />;
}