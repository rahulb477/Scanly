"use client";

import { Card, CardHeader, Badge } from "@/components/ui/Input";
import {
  QrCode,
  Star,
  Sparkles,
  UtensilsCrossed,
  Wifi,
  Instagram,
  Facebook,
  Youtube,
  Globe,
  MapPin,
  Activity,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";

type Props = {
  businessName: string;
  slug: string;
  stats: Record<string, number>;
  chartData: { date: string; Scans: number; Clicks: number }[];
  range: string;
};

const statTiles = [
  { key: "qr_scan", label: "Total QR Scans", icon: QrCode, accent: "bg-slate-950" },
  { key: "google_review_click", label: "Google Review Clicks", icon: Star, accent: "bg-amber-600" },
  { key: "review_generated", label: "AI Reviews Generated", icon: Sparkles, accent: "bg-violet-600" },
  { key: "menu_view", label: "Menu Views", icon: UtensilsCrossed, accent: "bg-rose-600" },
  { key: "wifi_view", label: "Wi-Fi Views", icon: Wifi, accent: "bg-sky-600" },
  { key: "instagram_click", label: "Instagram Clicks", icon: Instagram, accent: "bg-pink-600" },
  { key: "facebook_click", label: "Facebook Clicks", icon: Facebook, accent: "bg-blue-700" },
  { key: "youtube_click", label: "YouTube Clicks", icon: Youtube, accent: "bg-red-600" },
] as const;

const rangeOptions = [
  { value: "1", label: "Today" },
  { value: "7", label: "7 Days" },
  { value: "30", label: "30 Days" },
  { value: "all", label: "All Time" },
];

export function DashboardClient({
  businessName,
  slug,
  stats,
  chartData,
  range,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">Welcome back</p>
          <h1 className="text-2xl font-extrabold text-slate-950">{businessName}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Public page: <code className="rounded bg-slate-100 px-1.5 py-0.5">/b/{slug}</code>
          </p>
        </div>
        <RangePicker current={range} />
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statTiles.map((t) => {
          const v = stats[t.key] || 0;
          return (
            <Card key={t.key} className="p-5 card-hover">
              <div className="flex items-start justify-between">
                <div className={`grid h-10 w-10 place-items-center rounded-xl ${t.accent} text-white`}>
                  <t.icon className="h-5 w-5" />
                </div>
                <Badge variant="default">+{Math.max(0, Math.round(v / Math.max(1, 30)))}</Badge>
              </div>
              <p className="mt-4 text-2xl font-extrabold text-slate-950">{v}</p>
              <p className="text-xs text-slate-500">{t.label}</p>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Activity" subtitle="Scans vs. clicks" />
          <div className="p-3">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0f172a" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#0f172a" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d97706" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#d97706" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      color: "#fff",
                      borderRadius: 8,
                      border: "none",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Scans"
                    stroke="#0f172a"
                    fill="url(#g1)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="Clicks"
                    stroke="#d97706"
                    fill="url(#g2)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Top interactions" subtitle="Breakdown" />
          <div className="p-3">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: "Google", value: stats.google_review_click },
                    { name: "AI", value: stats.review_generated },
                    { name: "Menu", value: stats.menu_view },
                    { name: "Wi-Fi", value: stats.wifi_view },
                    { name: "Insta", value: stats.instagram_click },
                    { name: "FB", value: stats.facebook_click },
                    { name: "YT", value: stats.youtube_click },
                    { name: "Web", value: stats.website_click },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      color: "#fff",
                      borderRadius: 8,
                      border: "none",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" fill="#0f172a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader title="Recent Activity" subtitle="Last events on your QR page" />
        <RecentActivityList stats={stats} />
      </Card>

      {/* Quick links */}
      <Card>
        <CardHeader
          title="Quick links"
          action={
            <a
              href={`/admin/onboarding?businessId=${slug}`}
              className="text-xs font-semibold text-slate-700 underline"
            >
              Run setup wizard
            </a>
          }
        />
        <div className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-4">
          <QuickLink href={`/admin/qr?businessId=${slug}`} label="QR Code" icon={QrCode} />
          <QuickLink href={`/admin/menu?businessId=${slug}`} label="Menu" icon={UtensilsCrossed} />
          <QuickLink href={`/admin/wifi?businessId=${slug}`} label="Wi-Fi" icon={Wifi} />
          <QuickLink href={`/admin/appearance?businessId=${slug}`} label="Theme" icon={Sparkles} />
        </div>
      </Card>
    </div>
  );
}

function RecentActivityList({ stats }: { stats: Record<string, number> }) {
  const rows = [
    { icon: QrCode, label: "QR Scanned", value: stats.qr_scan },
    { icon: Sparkles, label: "Review Started", value: stats.review_started },
    { icon: Sparkles, label: "Review Generated", value: stats.review_generated },
    { icon: Star, label: "Google Review Clicked", value: stats.google_review_click },
    { icon: UtensilsCrossed, label: "Menu Opened", value: stats.menu_view },
    { icon: Instagram, label: "Instagram Clicked", value: stats.instagram_click },
    { icon: Wifi, label: "Wi-Fi Opened", value: stats.wifi_view },
  ];
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="p-3">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3 py-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-700">
            <r.icon className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900">{r.label}</p>
            <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-slate-950 transition-all"
                style={{ width: `${(r.value / max) * 100}%` }}
              />
            </div>
          </div>
          <p className="w-12 text-right text-sm font-bold text-slate-900">{r.value}</p>
        </div>
      ))}
    </div>
  );
}

function QuickLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
    >
      <Icon className="h-4 w-4" />
      {label}
    </a>
  );
}

function RangePicker({ current }: { current: string }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-sm">
      {rangeOptions.map((o) => (
        <a
          key={o.value}
          href={`?range=${o.value}`}
          className={`rounded-lg px-3 py-1.5 font-medium ${
            current === o.value ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {o.label}
        </a>
      ))}
    </div>
  );
}