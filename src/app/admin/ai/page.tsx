import { requireActiveBusiness } from "@/lib/admin";
import { AiForm } from "./AiForm";

export const dynamic = "force-dynamic";

export default async function AiPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const { business } = await requireActiveBusiness(sp);
  return <AiForm business={business} />;
}