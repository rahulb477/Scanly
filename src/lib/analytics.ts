import { db } from "@/db";
import { analyticsEvents, activityLogs } from "@/db/schema";
import { nanoid } from "nanoid";

export type EventType =
  | "qr_scan"
  | "review_open"
  | "review_started"
  | "review_generated"
  | "review_copied"
  | "google_review_click"
  | "menu_view"
  | "wifi_view"
  | "instagram_click"
  | "facebook_click"
  | "youtube_click"
  | "website_click"
  | "directions_click"
  | "whatsapp_click"
  | "twitter_click"
  | "review_edited";

export async function trackEvent(
  businessId: string,
  type: EventType,
  sessionId?: string,
  metadata?: Record<string, unknown>
) {
  try {
    await db.insert(analyticsEvents).values({
      id: nanoid(),
      businessId,
      type,
      sessionId: sessionId ?? null,
      metadata: metadata ?? null,
    });
  } catch (err) {
    // Analytics should never break a request
    console.error("trackEvent error", err);
  }
}

export async function logActivity(
  businessId: string,
  action: string,
  message: string,
  actor: string = "system",
  metadata?: Record<string, unknown>
) {
  try {
    await db.insert(activityLogs).values({
      id: nanoid(),
      businessId,
      action,
      message,
      actor,
      metadata: metadata ?? null,
    });
  } catch (err) {
    console.error("logActivity error", err);
  }
}
