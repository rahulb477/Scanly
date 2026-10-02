import { z } from "zod";
import type { Business } from "./types";
import { defaultBusiness } from "./business";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const date = z.iso.datetime({ offset: true });
const legacyUser = z.object({ id, email: z.email(), name: z.string().nullable(), role: z.string(), createdAt: date, updatedAt: date });
const row = z.object({ id, businessId: id, createdAt: date }).passthrough();
export const legacyExportSchema = z.object({
  version: z.literal(1), exportedAt: date, users: z.array(legacyUser),
  businesses: z.array(z.object({ id, ownerId: id, businessName: z.string().min(1).max(200), slug: z.string().regex(/^[a-z0-9_-]{1,120}$/), createdAt: date, updatedAt: date }).passthrough()),
  businessMembers: z.array(z.object({ businessId: id, userId: id, role: z.enum(["owner", "admin", "staff"]), createdAt: date })),
  qrCodes: z.array(row), menuCategories: z.array(row), menuItems: z.array(row), analyticsEvents: z.array(row), reviewSessions: z.array(row), activityLogs: z.array(row),
});
export const uidMappingSchema = z.record(z.string(), id);
export type LegacyExport = z.infer<typeof legacyExportSchema>;

export function validateUidMapping(data: LegacyExport, mapping: Record<string, string>) {
  const required = new Set([...data.businesses.map((business) => business.ownerId), ...data.businessMembers.map((member) => member.userId)]);
  const userIds = new Set(data.users.map((user) => user.id));
  for (const oldId of required) {
    if (!userIds.has(oldId)) throw new Error("Export contains an orphaned owner/member user reference.");
    if (!Object.hasOwn(mapping, oldId)) throw new Error(`Missing approved Firebase UID mapping for legacy user ${oldId}.`);
  }
  if (userIds.size !== data.users.length || new Set(data.businesses.map((business) => business.id)).size !== data.businesses.length ||
    new Set(data.businesses.map((business) => business.slug)).size !== data.businesses.length) throw new Error("Export contains duplicate user/business IDs or QR slugs.");
  const values = Object.values(mapping);
  if (new Set(values).size !== values.length) throw new Error("A Firebase UID cannot silently merge two legacy users. Review the mapping.");
  const businessIds = new Set(data.businesses.map((business) => business.id));
  for (const rows of [data.qrCodes, data.menuCategories, data.menuItems, data.analyticsEvents, data.reviewSessions, data.activityLogs, data.businessMembers]) {
    for (const row of rows) if (!businessIds.has(row.businessId)) throw new Error("Export contains an orphaned business reference.");
  }
  const categories = new Map(data.menuCategories.map((category) => [category.id, category.businessId]));
  for (const item of data.menuItems) {
    if (typeof item.categoryId !== "string" || categories.get(item.categoryId) !== item.businessId) throw new Error("Export contains an orphaned or cross-business menu category reference.");
  }

}
export function migratedBusiness(row: LegacyExport["businesses"][number], ownerUid: string): Business {
  const defaults = defaultBusiness(row.id, ownerUid, row.businessName, row.slug);
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof Business)[]) if (row[key] !== undefined) Object.assign(result, { [key]: row[key] });
  return { ...result, id: row.id, businessId: row.id, ownerId: ownerUid, wifiPublicSharingEnabled: false, isPublished: result.isPublished, createdAt: new Date(row.createdAt), updatedAt: new Date(row.updatedAt) };
}
