import { requireActiveBusiness } from "@/lib/admin";
import { getAnalytics, normalizedRange } from "@/lib/data/repository";
import { dashboardSummary } from "@/lib/data/analytics-summary";
import { AnalyticsClient } from "./AnalyticsClient";
export const dynamic = "force-dynamic";
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ businessId?: string; range?: string }> }) {
  const sp = await searchParams;
  const { business } = await requireActiveBusiness(sp);
  const range = normalizedRange(sp.range);
  const events = await getAnalytics(business.id, range);
  const { chartData } = dashboardSummary(events, range);
  return <AnalyticsClient events={events} range={range} chartData={chartData} businessId={business.id} />;
}
