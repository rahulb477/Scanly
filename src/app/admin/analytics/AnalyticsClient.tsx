"use client";

import { Card, CardHeader } from "@/components/ui/Input";
import { ResponsiveContainer, LineChart, Line as RLine, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import type { AnalyticsEvent } from "@/lib/data/types";
import { useState } from "react";

const COLORS = ["#0f172a", "#d97706", "#0ea5e9", "#16a34a", "#db2777", "#7c3aed", "#dc2626", "#0891b2", "#65a30d", "#9333ea"];

const rangeOptions = [
  { value: "1", label: "Today" },
  { value: "7", label: "7 Days" },
  { value: "30", label: "30 Days" },
  { value: "all", label: "All Time" },
];

export function AnalyticsClient({ events, range, chartData, businessId }: { events: AnalyticsEvent[]; range: string; chartData: { date: string; Scans: number; Clicks: number }[]; businessId: string }) {
  // Distribution
  const dist: Record<string, number> = {};
  for (const e of events) dist[e.type] = (dist[e.type] || 0) + 1;
  const distData = Object.entries(dist).map(([name, value]) => ({ name, value }));
  const total = events.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">Total tracked: {total} events. {range === "all" ? "Timeline: last 30 UTC days; totals include all history." : "Calendar days use UTC."}</p>
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-sm">
          {rangeOptions.map((o) => (
            <a
              key={o.value}
              href={`?range=${o.value}&businessId=${businessId}`}
              className={`rounded-lg px-3 py-1.5 font-medium ${
                range === o.value ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {o.label}
            </a>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader title="Activity timeline" />
        <div className="p-3">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#0f172a", color: "#fff", borderRadius: 8, border: "none", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <RLine type="monotone" dataKey="Scans" stroke="#0f172a" strokeWidth={2} dot={false} />
                <RLine type="monotone" dataKey="Clicks" stroke="#d97706" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Event distribution" />
          <div className="p-3">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                    {distData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0f172a", color: "#fff", borderRadius: 8, border: "none", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Top events" />
          <div className="p-3">
            <div className="space-y-2">
              {distData
                .sort((a, b) => b.value - a.value)
                .map((row, i) => {
                  const max = Math.max(...distData.map((d) => d.value));
                  return (
                    <div key={row.name} className="flex items-center gap-3">
                      <span className="w-32 text-xs text-slate-500">{row.name}</span>
                      <div className="h-2 flex-1 rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(row.value / max) * 100}%`,
                            background: COLORS[i % COLORS.length],
                          }}
                        />
                      </div>
                      <span className="w-12 text-right text-sm font-semibold">{row.value}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}