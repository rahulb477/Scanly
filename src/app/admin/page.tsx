import { redirect } from "next/navigation";
import { getCurrentUser, getBusinessesForUser, requireBusinessAccess } from "@/lib/auth";
import { getAnalytics, normalizedRange } from "@/lib/data/repository";
import { dashboardSummary } from "@/lib/data/analytics-summary";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";
export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<{ businessId?: string; range?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const businesses = await getBusinessesForUser(user.uid);
  if (businesses.length === 0) return <section className="rounded-2xl border border-slate-200 bg-white p-8"><h1 className="text-2xl font-bold">Welcome to Scanly</h1><p className="mt-3 text-slate-600">Your Firebase account is ready. Select “Create your first business” in the sidebar to start onboarding and get your permanent QR URL.</p></section>;
  const business = businesses.find((entry) => entry.id === sp.businessId) || businesses[0];
  const range = normalizedRange(sp.range);
  await requireBusinessAccess(user.uid, business.id);
  const events = await getAnalytics(business.id, range);
  const { stats, chartData } = dashboardSummary(events, range);
  return <DashboardClient businessName={business.businessName} slug={business.slug} stats={stats} chartData={chartData} range={range} businessId={business.id} />;
}
