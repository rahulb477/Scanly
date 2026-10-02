import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { businessRef } from "@/lib/data/repository";

export const EVENT_TYPES = ["qr_scan", "review_open", "review_started", "review_generated", "review_copied", "google_review_click", "menu_view", "wifi_view", "instagram_click", "facebook_click", "youtube_click", "website_click", "directions_click", "whatsapp_click", "twitter_click", "review_edited"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export async function trackEvent(businessId: string, type: EventType, sessionId?: string) {
  const ref = businessRef(businessId).collection("analytics").doc();
  await ref.set({ id: ref.id, businessId, type, sessionId: sessionId || null, metadata: null, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
}
export async function logActivity(businessId: string, action: string, message: string, actor = "system") {
  const ref = businessRef(businessId).collection("activityLogs").doc();
  await ref.set({ id: ref.id, businessId, actor, action, message, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
}
