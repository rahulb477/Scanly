import { redirect } from "next/navigation";
import { requireActiveBusiness } from "@/lib/admin";
import { db } from "@/db";
import { analyticsEvents } from "@/db/schema";
import { and, gte, eq, sql, desc } from "drizzle-orm";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

type SP = { businessId?: string; range?: string };

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const { business } = await requireActiveBusiness(sp);
  const range = (sp.range || "7") as "1" | "7" | "30" | "all";
  const days = range === "all" ? null : parseInt(range, 10);

  const since = days ? new Date(Date.now() - days * 86400_000) : new Date(0);

  const events = await db
    .select()
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.businessId, business.id),
        since ? gte(analyticsEvents.createdAt, since) : sql`TRUE`
      )
    );

  const stats = {
    qr_scan: 0,
    google_review_click: 0,
    review_generated: 0,
    menu_view: 0,
    wifi_view: 0,
    instagram_click: 0,
    facebook_click: 0,
    youtube_click: 0,
    website_click: 0,
    directions_click: 0,
    review_open: 0,
    review_started: 0,
    review_copied: 0,
    whatsapp_click: 0,
    twitter_click: 0,
  } as Record<string, number>;
  for (const e of events) {
    stats[e.type] = (stats[e.type] || 0) + 1;
  }

  // Build a per-day series for the chart
  const series: Record<string, number> = {};
  const last = days || 30;
  for (let i = last - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000);
    series[d.toISOString().slice(0, 10)] = 0;
  }
  for (const e of events) {
    const key = e.createdAt.toISOString().slice(0, 10);
    if (key in series) series[key] += 1;
  }
  const chartData = Object.entries(series).map(([date, count]) => ({
    date,
    Scans: stats.qr_scan ? Math.round((count * stats.qr_scan) / Math.max(1, events.length) * last) : count,
    Clicks: count,
  }));
  // Simpler: just show clicks per day
  const chartSeries = Object.entries(series).map(([date]) => {
    const dayStart = new Date(date + "T00:00:00.000Z");
    const dayEnd = new Date(date + "T23:59:59.999Z");
    const scans = events.filter(
      (e) => e.type === "qr_scan" && e.createdAt >= dayStart && e.createdAt <= dayEnd
    ).length;
    const clicks = events.filter(
      (e) =>
        e.createdAt >= dayStart &&
        e.createdAt <= dayEnd &&
        e.type !== "qr_scan"
    ).length;
    return { date: date.slice(5), Scans: scans, Clicks: clicks };
  });

  return (
    <DashboardClient
      businessName={business.businessName}
      slug={business.slug}
      stats={stats}
      chartData={chartSeries}
      range={range}
    />
  );
}