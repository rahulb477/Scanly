import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getBusiness, businessRef } from "@/lib/data/repository";
import { apiErrorResponse, ApiError, identifier } from "@/lib/api";
import { FieldValue } from "firebase-admin/firestore";
import { trackEvent } from "@/lib/analytics";
import {
  generateReview as makeReview,
  shortenReview,
  makeMoreNatural,
  translateReview,
} from "@/lib/ai-review";
import { rateLimit } from "@/lib/ratelimit";
import { sanitizeText } from "@/lib/utils";

const schemaInput = z.object({
  businessId: identifier,
  overallExperience: z.enum(["Very Poor", "Poor", "Okay", "Good", "Amazing"]).nullable().optional(),
  staffExperience: z.enum(["Very Poor", "Poor", "Okay", "Good", "Excellent"]).nullable().optional(),
  serviceExperience: z.enum(["Slow", "Average", "Good", "Excellent"]).nullable().optional(),
  selectedItems: z.array(z.string().max(100)).max(50).optional(),
  positiveFactors: z.array(z.string().max(64)).max(50).optional(),
  customComment: z.string().max(1000).optional(),
  language: z.enum(["English", "Hinglish", "Hindi"]),
  tone: z.enum(["Natural", "Friendly", "Short", "Detailed"]),
});

async function postReview(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (!await rateLimit(`ai:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = schemaInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const biz = await getBusiness(parsed.data.businessId);
  if (!biz || !biz.isPublished || biz.deleting) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }
  if (!biz.reviewEnabled || !biz.aiReviewEnabled) {
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

  const session = businessRef(biz.id).collection("reviewSessions").doc();
  await session.set({
    id: session.id, businessId: biz.id,
    overallExperience: parsed.data.overallExperience || null,
    staffExperience: parsed.data.staffExperience || null,
    serviceExperience: parsed.data.serviceExperience || null,
    selectedItems: parsed.data.selectedItems || [],
    positiveFactors: parsed.data.positiveFactors || [],
    customComment: sanitizeText(parsed.data.customComment || "", 800),
    language: parsed.data.language, tone: parsed.data.tone, generatedReview: review,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 30 * 86400_000),
  });
  await trackEvent(biz.id, "review_generated");

  return NextResponse.json({ review });
}

const patchInput = z.object({
  businessId: identifier,
  action: z.enum(["regenerate", "shorten", "natural", "translate", "copy"]),
  review: z.string().max(2000),
  language: z.enum(["English", "Hinglish", "Hindi"]).optional(),
});

async function patchReview(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "local";
  if (!await rateLimit(`ai:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = patchInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const biz = await getBusiness(parsed.data.businessId);
  if (!biz || !biz.isPublished || biz.deleting) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  if (!biz.reviewEnabled || !biz.aiReviewEnabled) throw new ApiError(403, "review/disabled", "Review assistant is disabled.");

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
      await trackEvent(biz.id, "review_copied");
      return NextResponse.json({ review });
    }
  }

  return NextResponse.json({ review });
}
export async function POST(req: NextRequest) {
  try { return await postReview(req); } catch (error) { return apiErrorResponse(error); }
}
export async function PATCH(req: NextRequest) {
  try { return await patchReview(req); } catch (error) { return apiErrorResponse(error); }
}
