import { describe, expect, it } from "vitest";
import { legacyExportSchema, migratedBusiness, validateUidMapping } from "@/lib/data/migration";
const at = "2026-10-02T00:00:00.000Z";
const data = legacyExportSchema.parse({ version: 1, exportedAt: at, users: [{ id: "legacy-user", email: "owner@example.test", name: "Owner", role: "owner", createdAt: at, updatedAt: at }], businesses: [{ id: "business", ownerId: "legacy-user", businessName: "Cafe", slug: "cafe", wifiEnabled: true, wifiPassword: "guest-only", createdAt: at, updatedAt: at }], businessMembers: [], qrCodes: [], menuCategories: [], menuItems: [], analyticsEvents: [], reviewSessions: [], activityLogs: [] });
describe("non-destructive legacy data migration", () => {
  it("requires an explicit approved UID map, never implicit email ownership", () => {
    expect(() => validateUidMapping(data, {})).toThrow("Missing approved Firebase UID");
    expect(() => validateUidMapping(data, { "legacy-user": "firebase-uid" })).not.toThrow();
  });
  it("preserves IDs, slugs and timestamps while replacing owner identity", () => {
    expect(migratedBusiness(data.businesses[0], "firebase-uid")).toMatchObject({ id: "business", businessId: "business", slug: "cafe", ownerId: "firebase-uid", createdAt: new Date(at), wifiPublicSharingEnabled: false });
  });
  it("rejects accidental account merging", () => {
    expect(() => validateUidMapping(data, { "legacy-user": "uid", "another-user": "uid" })).toThrow("cannot silently merge");
  });
  it("keeps legacy underscore slugs and explicitly unpublished businesses unchanged", () => {
    const row = legacyExportSchema.parse({ ...data, businesses: [{ ...data.businesses[0], slug: "cafe-a_b", isPublished: false }] }).businesses[0];
    expect(migratedBusiness(row, "firebase-uid")).toMatchObject({ slug: "cafe-a_b", isPublished: false });
  });
  it("rejects missing source users and cross-business menu category references", () => {
    const mapping = { "legacy-user": "firebase-uid" };
    expect(() => validateUidMapping({ ...data, users: [] }, mapping)).toThrow("orphaned owner");
    const invalid = legacyExportSchema.parse({ ...data, menuItems: [{ id: "item", businessId: "business", categoryId: "missing", createdAt: at }] });
    expect(() => validateUidMapping(invalid, mapping)).toThrow("category reference");
  });
  it("does not treat prototype property names as approved UID mappings", () => {
    const tricky = legacyExportSchema.parse({ ...data, users: [{ ...data.users[0], id: "constructor" }], businesses: [{ ...data.businesses[0], ownerId: "constructor" }] });
    expect(() => validateUidMapping(tricky, {})).toThrow("Missing approved Firebase UID");
  });
  it("refuses ambiguous duplicate source records before writing", () => {
    expect(() => validateUidMapping({ ...data, businesses: [...data.businesses, { ...data.businesses[0], id: "another-business" }] }, { "legacy-user": "firebase-uid" })).toThrow("duplicate");
  });
});
