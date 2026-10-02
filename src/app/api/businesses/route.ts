import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { businesses, businessMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireUser } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import { rateLimit } from "@/lib/ratelimit";

const input = z.object({
  businessName: z.string().min(1).max(200),
  category: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (!rateLimit(`create-biz:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many" }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Generate unique slug
  const base = slugify(parsed.data.businessName) || "business";
  let slug = base;
  for (let i = 0; i < 20; i++) {
    const exists = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.slug, slug))
      .limit(1);
    if (exists.length === 0) break;
    slug = `${base}-${nanoid(4).toLowerCase()}`;
  }

  const id = nanoid();
  await db.insert(businesses).values({
    id,
    ownerId: user.id,
    businessName: parsed.data.businessName,
    slug,
    category: parsed.data.category || null,
  });

  await db.insert(businessMembers).values({
    businessId: id,
    userId: user.id,
    role: "owner",
  });

  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, id))
    .limit(1);

  return NextResponse.json({ business: biz });
}