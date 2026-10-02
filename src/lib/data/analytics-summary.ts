import type { AnalyticsEvent } from "./types";

// Time is captured outside React rendering. Series uses real counts, not estimates.
export function dashboardSummary(events: AnalyticsEvent[], range: string, now = Date.now()) {
  const stats: Record<string, number> = Object.fromEntries(["qr_scan", "review_open", "review_started", "review_generated", "review_copied", "google_review_click", "menu_view", "wifi_view", "instagram_click", "facebook_click", "youtube_click", "website_click", "directions_click", "whatsapp_click", "twitter_click"].map((type) => [type, 0]));
  for (const event of events) stats[event.type] = (stats[event.type] || 0) + 1;
  const days = range === "all" ? 30 : Number(range);
  const series: Record<string, { Scans: number; Clicks: number }> = {};
  for (let i = days - 1; i >= 0; i--) series[new Date(now - i * 86400_000).toISOString().slice(0, 10)] = { Scans: 0, Clicks: 0 };
  for (const event of events) {
    const day = series[event.createdAt.toISOString().slice(0, 10)];
    if (day) { if (event.type === "qr_scan") day.Scans++; else day.Clicks++; }
  }
  return { stats, chartData: Object.entries(series).map(([date, value]) => ({ date: date.slice(5), ...value })) };
}


export function analyticsStartDate(range: string, now = Date.now()) {
  if (range === "all") return new Date(0);
  const since = new Date(now);
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - (Number(range) - 1));
  return since;
}
