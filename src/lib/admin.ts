import { getCurrentUser, getBusinessesForUser, userCanAccessBusiness } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Business } from "@/db/schema";

export async function requireActiveBusiness(
  searchParams: { businessId?: string }
): Promise<{ userId: string; business: Business }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const businesses = await getBusinessesForUser(user.id);
  if (businesses.length === 0) {
    redirect("/admin?welcome=1");
  }

  const requested = searchParams.businessId;
  let active = businesses[0];
  if (requested) {
    const found = businesses.find((b) => b.id === requested);
    if (found) active = found;
  }
  // double check permission
  const access = await userCanAccessBusiness(user.id, active.id);
  if (!access) redirect("/admin");
  return { userId: user.id, business: access.business };
}