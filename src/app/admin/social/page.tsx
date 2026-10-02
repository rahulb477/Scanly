import { requireActiveBusiness } from "@/lib/admin";
import { SocialForm } from "./SocialForm";

export const dynamic = "force-dynamic";

export default async function SocialPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const { business } = await requireActiveBusiness(sp);
  return <SocialForm business={business} />;
}