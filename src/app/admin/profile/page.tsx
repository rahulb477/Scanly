import { requireActiveBusiness } from "@/lib/admin";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const { business } = await requireActiveBusiness(sp);
  return <ProfileForm business={business} />;
}