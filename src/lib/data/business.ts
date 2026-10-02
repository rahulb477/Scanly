import type { Business, PublicBusiness } from "./types";

export const WIFI_FIELDS = ["wifiEnabled", "wifiPublicSharingEnabled", "wifiName", "wifiPassword", "wifiSecurity"] as const;
export const REVIEW_FIELDS = ["googleReviewUrl", "googlePlaceId", "reviewEnabled", "aiReviewEnabled"] as const;
export const THEME_FIELDS = ["theme", "primaryColor", "secondaryColor", "backgroundColor", "font", "tagline", "cardStyle", "buttonStyle"] as const;
export const SOCIAL_FIELDS = ["websiteUrl", "instagramUrl", "facebookUrl", "youtubeUrl", "whatsappUrl", "twitterUrl"] as const;
export const PROFILE_FIELDS = ["businessName", "slug", "logo", "coverImage", "category", "description", "phone", "email", "address", "city", "state", "pincode", "googleMapsUrl", "menuEnabled", "isPublished"] as const;

export function defaultBusiness(id: string, ownerId: string, name: string, slug: string): Business {
  return {
    id, businessId: id, ownerId, businessName: name, slug,
    logo: null, coverImage: null, category: null, description: null, phone: null, email: null, address: null, city: null, state: null, pincode: null,
    googleReviewUrl: null, googlePlaceId: null, googleMapsUrl: null,
    websiteUrl: null, instagramUrl: null, facebookUrl: null, youtubeUrl: null, whatsappUrl: null, twitterUrl: null,
    wifiEnabled: false, wifiPublicSharingEnabled: false, wifiName: null, wifiPassword: null, wifiSecurity: "WPA",
    menuEnabled: true, reviewEnabled: true, aiReviewEnabled: true, isPublished: true,
    theme: "coffee", primaryColor: "#7c2d12", secondaryColor: "#d6a86c", backgroundColor: "#fbf6ee", font: "Inter", tagline: null, cardStyle: "rounded", buttonStyle: "solid",
    createdAt: new Date(0), updatedAt: new Date(0),
  };
}

export function pickBusinessFields(business: Business, fields: readonly (keyof Business)[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((key) => [key, business[key]]));
}

// An allowlist is deliberate: adding a private field to Business cannot leak it.
export function publicBusiness(business: Business): PublicBusiness {
  return {
    id: business.id, businessId: business.id,
    ...pickBusinessFields(business, PROFILE_FIELDS),
    googleReviewUrl: business.reviewEnabled ? business.googleReviewUrl : null,
    googlePlaceId: business.reviewEnabled ? business.googlePlaceId : null,
    reviewEnabled: business.reviewEnabled, aiReviewEnabled: business.reviewEnabled && business.aiReviewEnabled,
    ...pickBusinessFields(business, SOCIAL_FIELDS),
    ...pickBusinessFields(business, THEME_FIELDS),
    wifiEnabled: business.wifiEnabled && business.wifiPublicSharingEnabled,
    wifiName: business.wifiEnabled && business.wifiPublicSharingEnabled ? business.wifiName : null,
    wifiSecurity: business.wifiEnabled && business.wifiPublicSharingEnabled ? business.wifiSecurity : "WPA",
  } as PublicBusiness;
}
