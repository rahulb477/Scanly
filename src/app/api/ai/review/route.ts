import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { businesses, analyticsEvents, reviewSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  generateReview as makeReview,
  shortenReview,
  makeMoreNatural,
  translateReview,
} from "@/lib/ai-review";
import { rateLimit } from "@/lib/ratelimit";
import { sanitizeText } from "@/lib/utils";

const schemaInput = z.object({
  businessId: z.string().min(1).max(64),
  overallExperience: z.string().max(64).optional(),
  staffExperience: z.string().max(64).optional(),
  serviceExperience: z.string().max(64).optional(),
  selectedItems: z.array(z.string().max(100)).max(50).optional(),
  positiveFactors: z.array(z.string().max(64)).max(50).optional(),
  customComment: z.string().max(1000).optional(),
  language: z.enum(["English", "Hinglish", "Hindi"]),
  tone: z.enum(["Natural", "Friendly", "Short", "Detailed"]),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (!rateLimit(`ai:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = schemaInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, parsed.data.businessId))
    .limit(1);
  if (!biz) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }
  if (!biz.aiReviewEnabled) {
    return NextResponse.json({ error: "AI review disabled" }, { status: 403 });
  }

  const review = makeReview({
    businessName: biz.businessName,
    overallExperience: parsed.data.overallExperience || null,
    staffExperience: parsed.data.staffExperience || null,
    serviceExperience: parsed.data.serviceExperience || null,
    selectedItems: parsed.data.selectedItems || [],
    positiveFactors: parsed.data.positiveFactors || [],
    customComment: sanitizeText(parsed.data.customComment || "", 800),
    language: parsed.data.language,
    tone: parsed.data.tone,
  });

  // Persist a session record
  await db.insert(reviewSessions).values({
    id: nanoid(),
    businessId: biz.id,
    overallExperience: parsed.data.overallExperience || null,
    staffExperience: parsed.data.staffExperience || null,
    serviceExperience: parsed.data.serviceExperience || null,
    selectedItems: parsed.data.selectedItems || [],
    positiveFactors: parsed.data.positiveFactors || [],
    customComment: parsed.data.customComment || null,
    language: parsed.data.language,
    tone: parsed.data.tone,
    generatedReview: review,
  });

  await db.insert(analyticsEvents).values({
    id: nanoid(),
    businessId: biz.id,
    type: "review_generated",
  });

  return NextResponse.json({ review });
}

const patchInput = z.object({
  businessId: z.string().min(1).max(64),
  action: z.enum(["regenerate", "shorten", "natural", "translate", "copy"]),
  review: z.string().max(2000),
  language: z.enum(["English", "Hinglish", "Hindi"]).optional(),
});

export async function PATCH(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (!rateLimit(`ai:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = patchInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, parsed.data.businessId))
    .limit(1);
  if (!biz) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const lang = parsed.data.language || "English";
  let review = parsed.data.review;
  switch (parsed.data.action) {
    case "regenerate": {
      // Re-run with same defaults from the existing text is impossible,
      // so we just return a slight variation by trimming & naturalising.
      review = makeMoreNatural(review, lang);
      break;
    }
    case "shorten": {
      review = shortenReview(review);
      break;
    }
    case "natural": {
      review = makeMoreNatural(review, lang);
      break;
    }
    case "translate": {
      review = translateReview(review, lang);
      break;
    }
    case "copy": {
      // No transformation, just track
      await db.insert(analyticsEvents).values({
        id: nanoid(),
        businessId: biz.id,
        type: "review_copied",
      });
      return NextResponse.json({ review });
    }
  }

  return NextResponse.json({ review });
}