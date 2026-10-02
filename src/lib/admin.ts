import { getCurrentUser, getBusinessesForUser, requireBusinessAccess } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Business } from "@/lib/data/types";

export async function requireActiveBusiness(searchParams: { businessId?: string }, permission: "read" | "manage" = "read"): Promise<{ userId: string; business: Business }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const businesses = await getBusinessesForUser(user.uid);
  if (businesses.length === 0) redirect("/dashboard");
  const active = searchParams.businessId ? businesses.find((business) => business.id === searchParams.businessId) : businesses[0];
  if (!active) redirect("/dashboard");
  await requireBusinessAccess(user.uid, active.id, permission);
  return { userId: user.uid, business: active };
}
