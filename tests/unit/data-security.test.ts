import { describe, expect, it } from "vitest";
import { defaultBusiness, publicBusiness } from "@/lib/data/business";
import { businessUpdateSchema, menuItemSchema } from "@/lib/data/validation";
import { apiErrorResponse, assertSameOrigin } from "@/lib/api";
import { validateImage, MAX_IMAGE_BYTES } from "@/lib/firebase/storage";

describe("public projection and mutation validation", () => {
  it("never spreads ownership, credentials, timestamps or newly added private fields", () => {
    const business = { ...defaultBusiness("business-1", "private-owner", "Coffee", "coffee"), wifiEnabled: true, wifiPublicSharingEnabled: true, wifiPassword: "private-guest-password", privateAnalytics: "sensitive" };
    const result = publicBusiness(business);
    expect(result.wifiEnabled).toBe(true);
    for (const field of ["ownerId", "wifiPassword", "privateAnalytics", "createdAt", "updatedAt"]) expect(result).not.toHaveProperty(field);
    expect(JSON.stringify(result)).not.toContain("private-guest-password");
    expect(JSON.stringify(result)).not.toContain("private-owner");
  });
  it("requires separate opt-in for publicly shared guest Wi-Fi", () => {
    expect(publicBusiness({ ...defaultBusiness("b", "u", "Cafe", "cafe"), wifiEnabled: true, wifiPassword: "private", wifiName: "SSID" })).toMatchObject({ wifiEnabled: false, wifiName: null });
  });
  it("honors the master reviews switch", () => {
    expect(publicBusiness({ ...defaultBusiness("b", "u", "Cafe", "cafe"), reviewEnabled: false, googleReviewUrl: "https://example.test/review" })).toMatchObject({ aiReviewEnabled: false, googleReviewUrl: null });
  });
  it("rejects spoofed ownership/roles/UID and unsafe or embedded-data URLs", () => {
    for (const value of [{ ownerId: "attacker" }, { userId: "attacker" }, { role: "owner" }, { slug: "qr-takeover" }, { instagramUrl: "javascript:alert(1)" }, { logo: "data:image/png;base64,AAAA" }]) expect(businessUpdateSchema.safeParse(value).success).toBe(false);
    expect(businessUpdateSchema.safeParse({ businessName: "New name", googleReviewUrl: "https://example.test/review", wifiEnabled: true }).success).toBe(true);
  });
  it("rejects path traversal and invalid categories on inputs", () => {
    expect(menuItemSchema.safeParse({ businessId: "other/tenant", categoryId: "category", name: "Coffee", price: "$4" }).success).toBe(false);
  });
  it("restricts uploads to bounded raster images", () => {
    expect(() => validateImage({ size: 100, type: "image/png" })).not.toThrow();
    expect(() => validateImage({ size: 100, type: "image/svg+xml" })).toThrow("JPEG, PNG or WebP");
    expect(() => validateImage({ size: MAX_IMAGE_BYTES + 1, type: "image/png" })).toThrow("5 MB");
    expect(() => validateImage({ size: 0, type: "image/png" })).toThrow("5 MB");
  });
  it("blocks cross-origin session operations", () => {
    expect(() => assertSameOrigin(new Request("https://app.example.test/api/auth/session", { headers: { Origin: "https://evil.example.test" } }))).toThrow("Cross-origin");
    expect(() => assertSameOrigin(new Request("https://app.example.test/api/auth/session", { headers: { Origin: "https://app.example.test" } }))).not.toThrow();
  });
  it("does not expose raw server exceptions", async () => {
    const response = apiErrorResponse(new Error("sensitive-internal-detail"));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("sensitive-internal-detail");
  });
});
