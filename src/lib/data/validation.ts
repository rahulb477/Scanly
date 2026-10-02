import { z } from "zod";
import { identifier } from "@/lib/api";

const text = (max: number) => z.string().trim().max(max);
const url = z.string().max(2048).refine((value) => !value || /^https?:\/\//.test(value) && (() => { try { const parsed = new URL(value); return !parsed.username && !parsed.password; } catch { return false; } })(), "Enter a valid HTTP or HTTPS URL.");
const image = url.nullable();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color.");
export const createBusinessSchema = z.strictObject({ businessName: text(200).min(1), category: text(100).optional() });
export const businessUpdateSchema = z.strictObject({
  businessName: text(200).min(1), category: text(100), description: text(2000), phone: text(32), email: z.union([z.email().max(255), z.literal("")]), address: text(400), city: text(100), state: text(100), pincode: text(32), logo: image, coverImage: image,
  googleReviewUrl: url, googlePlaceId: text(200), googleMapsUrl: url, websiteUrl: url, instagramUrl: url, facebookUrl: url, youtubeUrl: url, whatsappUrl: url, twitterUrl: url,
  wifiEnabled: z.boolean(), wifiPublicSharingEnabled: z.boolean(), wifiName: text(120), wifiPassword: z.string().max(200), wifiSecurity: z.enum(["WPA", "WEP", "Open"]),
  menuEnabled: z.boolean(), reviewEnabled: z.boolean(), aiReviewEnabled: z.boolean(), isPublished: z.boolean(),
  theme: z.enum(["coffee", "restaurant", "salon", "hotel", "retail", "modern", "luxury", "minimal"]), primaryColor: color, secondaryColor: color, backgroundColor: color,
  font: z.enum(["Inter", "Manrope", "Plus Jakarta Sans", "Lora", "DM Serif Display"]), tagline: text(200), cardStyle: z.enum(["rounded", "square", "pill"]), buttonStyle: z.enum(["solid", "outline", "soft"]),
}).partial();
export const categorySchema = z.strictObject({ businessId: identifier, name: text(100).min(1) });
export const menuItemSchema = z.strictObject({ businessId: identifier, categoryId: identifier, name: text(200).min(1), description: text(2000).optional(), price: text(32).min(1), image: image.optional() });
export const menuItemUpdateSchema = menuItemSchema.omit({ businessId: true }).extend({ available: z.boolean(), sortOrder: z.number().int().min(0).max(9999) }).partial();
