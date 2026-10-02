import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { analyticsEvents } from "@/db/schema";
import { nanoid } from "nanoid";
import { rateLimit } from "@/lib/ratelimit";
import { businesses } from "@/db/schema";
import { eq } from "drizzle-orm";

const ALLOWED_TYPES = [
  "qr_scan",
  "review_open",
  "review_started",
  "review_generated",
  "review_copied",
  "google_review_click",
  "menu_view",
  "wifi_view",
  "instagram_click",
  "facebook_click",
  "youtube_click",
  "website_click",
  "directions_click",
  "whatsapp_click",
  "twitter_click",
  "review_edited",
];

const schema = z.object({
  businessId: z.string().min(1).max(64),
  type: z.string().min(1).max(64),
  sessionId: z.string().max(100).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (!rateLimit(`track:${ip}`, 200, 60_000)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  if (!ALLOWED_TYPES.includes(parsed.data.type)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  // verify business exists
  const [b] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.id, parsed.data.businessId))
    .limit(1);
  if (!b) return NextResponse.json({ ok: false }, { status: 404 });

  await db.insert(analyticsEvents).values({
    id: nanoid(),
    businessId: parsed.data.businessId,
    type: parsed.data.type,
    sessionId: parsed.data.sessionId ?? null,
    metadata: parsed.data.metadata ?? null,
  });

  return NextResponse.json({ ok: true });
}