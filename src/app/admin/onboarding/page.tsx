import { redirect } from "next/navigation";
import { getCurrentUser, getBusinessesForUser } from "@/lib/auth";
import { OnboardingClient } from "./OnboardingClient";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string }>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const businesses = await getBusinessesForUser(user.id);
  const business =
    businesses.find((b) => b.id === sp.businessId) || businesses[0];
  if (!business) redirect("/admin");
  return <OnboardingClient business={business} />;
}