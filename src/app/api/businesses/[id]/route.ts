import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { businesses, qrCodes, menuCategories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireUser, requireBusinessAccess } from "@/lib/auth";
import { slugify, sanitizeText, isValidUrl } from "@/lib/utils";

const updateSchema = z.object({
  businessName: z.string().min(1).max(200).optional(),
  category: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  phone: z.string().max(32).optional(),
  email: z.string().email().max(255).optional().or(z.literal("")),
  address: z.string().max(400).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(32).optional(),
  logo: z.string().max(2_000_000).optional().nullable(),
  coverImage: z.string().max(2_000_000).optional().nullable(),

  googleReviewUrl: z.string().max(2000).optional().or(z.literal("")),
  googlePlaceId: z.string().max(200).optional().or(z.literal("")),
  googleMapsUrl: z.string().max(2000).optional().or(z.literal("")),
  websiteUrl: z.string().max(2000).optional().or(z.literal("")),
  instagramUrl: z.string().max(2000).optional().or(z.literal("")),
  facebookUrl: z.string().max(2000).optional().or(z.literal("")),
  youtubeUrl: z.string().max(2000).optional().or(z.literal("")),
  whatsappUrl: z.string().max(2000).optional().or(z.literal("")),
  twitterUrl: z.string().max(2000).optional().or(z.literal("")),

  wifiEnabled: z.boolean().optional(),
  wifiName: z.string().max(120).optional().or(z.literal("")),
  wifiPassword: z.string().max(200).optional().or(z.literal("")),
  wifiSecurity: z.enum(["WPA", "WEP", "Open"]).optional(),

  menuEnabled: z.boolean().optional(),
  reviewEnabled: z.boolean().optional(),
  aiReviewEnabled: z.boolean().optional(),

  theme: z.string().max(64).optional(),
  primaryColor: z.string().max(16).optional(),
  secondaryColor: z.string().max(16).optional(),
  backgroundColor: z.string().max(16).optional(),
  font: z.string().max(64).optional(),
  tagline: z.string().max(200).optional(),
  cardStyle: z.string().max(32).optional(),
  buttonStyle: z.string().max(32).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireBusinessAccess(user.id, id);
    const body = await req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }
    // sanitize URL fields
    const urlFields: (keyof typeof parsed.data)[] = [
      "googleReviewUrl",
      "googleMapsUrl",
      "websiteUrl",
      "instagramUrl",
      "facebookUrl",
      "youtubeUrl",
      "whatsappUrl",
      "twitterUrl",
    ];
    for (const f of urlFields) {
      const v = parsed.data[f] as string | undefined;
      if (v && !isValidUrl(v)) {
        return NextResponse.json({ error: `Invalid URL for ${String(f)}` }, { status: 400 });
      }
    }
    const update = {
      ...parsed.data,
      description: parsed.data.description ? sanitizeText(parsed.data.description, 2000) : parsed.data.description,
    };
    await db.update(businesses).set({ ...update, updatedAt: new Date() }).where(eq(businesses.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireBusinessAccess(user.id, id);
    await db.delete(businesses).where(eq(businesses.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await requireBusinessAccess(user.id, id);
    const [biz] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
    return NextResponse.json({ business: biz });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}