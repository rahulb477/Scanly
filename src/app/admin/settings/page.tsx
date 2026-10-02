import { requireActiveBusiness } from "@/lib/admin";
import { serverBusinessUrl } from "@/lib/server-url";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const { business } = await requireActiveBusiness(sp);
  return <SettingsClient business={business} publicUrl={await serverBusinessUrl(business.slug)} />;
}