import { requireActiveBusiness } from "@/lib/admin";
import { db } from "@/db";
import { analyticsEvents } from "@/db/schema";
import { and, gte, eq, desc } from "drizzle-orm";
import { AnalyticsClient } from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ businessId?: string; range?: string }>;
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
        since ? gte(analyticsEvents.createdAt, since) : eq(analyticsEvents.id, analyticsEvents.id) // always true
      )
    )
    .orderBy(desc(analyticsEvents.createdAt));

  return <AnalyticsClient events={events} range={range} />;
}