// Application view models. Persistence uses Firestore Timestamp, converted to Date
// by the server repository so the existing dashboard UI remains compatible.
export type MembershipRole = "owner" | "admin" | "staff";
export type SessionUser = { id: string; uid: string; email: string; name: string | null; role: string };
export type UserProfile = { uid: string; name: string; email: string; photoURL: string | null; role: "user"; createdAt: Date; updatedAt: Date };
export type Business = {
  id: string; businessId: string; ownerId: string; businessName: string; slug: string;
  logo: string | null; coverImage: string | null; category: string | null; description: string | null;
  phone: string | null; email: string | null; address: string | null; city: string | null; state: string | null; pincode: string | null;
  googleReviewUrl: string | null; googlePlaceId: string | null; googleMapsUrl: string | null;
  websiteUrl: string | null; instagramUrl: string | null; facebookUrl: string | null; youtubeUrl: string | null; whatsappUrl: string | null; twitterUrl: string | null;
  wifiEnabled: boolean; wifiPublicSharingEnabled: boolean; wifiName: string | null; wifiPassword: string | null; wifiSecurity: "WPA" | "WEP" | "Open";
  menuEnabled: boolean; reviewEnabled: boolean; aiReviewEnabled: boolean; isPublished: boolean;
  theme: string; primaryColor: string; secondaryColor: string; backgroundColor: string; font: string; tagline: string | null; cardStyle: string; buttonStyle: string;
  createdAt: Date; updatedAt: Date; deleting?: boolean;
};
export type PublicBusiness = Omit<Business, "ownerId" | "wifiPassword" | "wifiPublicSharingEnabled" | "createdAt" | "updatedAt" | "deleting">;
export type MenuCategory = { id: string; businessId: string; name: string; sortOrder: number; createdAt: Date; updatedAt: Date };
export type MenuItem = { id: string; businessId: string; categoryId: string; name: string; description: string | null; price: string; image: string | null; available: boolean; sortOrder: number; createdAt: Date; updatedAt: Date };
export type AnalyticsEvent = { id: string; businessId: string; type: string; sessionId: string | null; metadata: Record<string, unknown> | null; createdAt: Date; updatedAt: Date };
export type ActivityLog = { id: string; businessId: string; actor: string; action: string; message: string; createdAt: Date; updatedAt: Date };
