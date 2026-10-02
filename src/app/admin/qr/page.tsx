import { requireActiveBusiness } from "@/lib/admin";
import { publicBusinessUrl } from "@/lib/utils";
import { QrClient } from "./QrClient";

export const dynamic = "force-dynamic";

export default async function QrPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const { business } = await requireActiveBusiness(sp);
  return <QrClient business={business} publicUrl={publicBusinessUrl(business.slug)} />;
}