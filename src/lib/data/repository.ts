import "server-only";

import { FieldValue, Timestamp, type DocumentSnapshot, type Transaction } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { ApiError, identifier } from "@/lib/api";
import { nanoid, customAlphabet } from "nanoid";
import { slugify } from "@/lib/utils";
import { defaultBusiness, pickBusinessFields, publicBusiness, PROFILE_FIELDS, WIFI_FIELDS, REVIEW_FIELDS, THEME_FIELDS, SOCIAL_FIELDS } from "./business";
import { analyticsStartDate } from "./analytics-summary";
import type { Business, MenuCategory, MenuItem, AnalyticsEvent, MembershipRole } from "./types";

const slugSuffix = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 6);

export function fromFirestore<T>(snapshot: DocumentSnapshot): T {
  function convert(value: unknown): unknown {
    if (value instanceof Timestamp) return value.toDate();
    if (Array.isArray(value)) return value.map(convert);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, convert(entry)]));
    return value;
  }
  return convert(snapshot.data()) as T;
}
export function businessRef(id: string) { return getAdminDb().collection("businesses").doc(identifier.parse(id)); }

async function readBusiness(id: string, transaction?: Transaction): Promise<Business | null> {
  const ref = businessRef(id);
  const refs = [ref, ref.collection("wifiSettings").doc("default"), ref.collection("reviewSettings").doc("default"), ref.collection("themes").doc("default"), ...SOCIAL_FIELDS.map((field) => ref.collection("socialLinks").doc(field))];
  const snapshots = transaction ? await transaction.getAll(...refs) : await getAdminDb().getAll(...refs);
  if (!snapshots[0].exists) return null;
  const base = fromFirestore<Business>(snapshots[0]);
  const merged = { ...defaultBusiness(id, base.ownerId, base.businessName, base.slug), ...base };
  for (let index = 1; index <= 3; index++) {
    if (snapshots[index].exists) {
      const setting = fromFirestore<Partial<Business>>(snapshots[index]);
      const fields = index === 1 ? WIFI_FIELDS : index === 2 ? REVIEW_FIELDS : THEME_FIELDS;
      for (const field of fields) Object.assign(merged, { [field]: setting[field] ?? merged[field] });
    }
  }
  SOCIAL_FIELDS.forEach((field, index) => { merged[field] = snapshots[index + 4].data()?.url || null; });
  return merged;
}
export async function getBusiness(id: string) { return readBusiness(id); }

export async function getBusinessBySlug(slug: string): Promise<Business | null> {
  if (!/^[a-z0-9_-]{1,120}$/.test(slug)) return null;
  const mapping = await getAdminDb().collection("businessSlugs").doc(slug).get();
  const id = mapping.data()?.businessId;
  if (typeof id !== "string") return null;
  const business = await getBusiness(id);
  return business?.isPublished && !business.deleting ? business : null;
}

export async function getBusinessesForUser(uid: string) {
  const db = getAdminDb();
  const [owned, membership] = await Promise.all([
    db.collection("businesses").where("ownerId", "==", uid).get(),
    db.collectionGroup("members").where("uid", "==", uid).get(),
  ]);
  const roles = new Map<string, MembershipRole>();
  for (const doc of owned.docs) roles.set(doc.id, "owner");
  for (const doc of membership.docs) {
    const data = doc.data();
    if (doc.ref.parent.parent?.parent.id !== "businesses" || doc.id !== uid ||
      doc.ref.parent.parent.id !== data.businessId || !["admin", "staff"].includes(data.role)) continue;
    if (!roles.has(data.businessId)) roles.set(data.businessId, data.role);
  }
  const result = await Promise.all([...roles].map(async ([id, memberRole]) => {
    const business = await getBusiness(id);
    return business && !business.deleting ? { ...business, memberRole } : null;
  }));
  return result.filter((business): business is Business & { memberRole: MembershipRole } => business !== null);
}

export async function requireBusinessAccess(uid: string, id: string, permission: "read" | "manage" | "owner" | "menu" = "read") {
  const business = await getBusiness(id);
  if (!business) throw new ApiError(404, "business/not-found", "Business not found.");
  let role: MembershipRole | undefined;
  if (business.ownerId === uid) role = "owner";
  else {
    const membership = await businessRef(id).collection("members").doc(uid).get();
    const member = membership.data();
    if (member?.uid === uid && member.businessId === id && ["admin", "staff"].includes(member.role)) role = member.role;
  }
  if (!role || (permission === "owner" && role !== "owner") || (permission === "manage" && role !== "owner" && role !== "admin")) {
    throw new ApiError(403, "business/forbidden", "You do not have permission to access or manage this business.");
  }
  if (business.deleting && permission !== "owner") throw new ApiError(409, "business/deleting", "This business is being deleted.");
  return { business, role };
}

function writeBusiness(transaction: Transaction, business: Business, creating: boolean) {
  const ref = businessRef(business.id);
  const timestamps = { updatedAt: FieldValue.serverTimestamp(), ...(creating ? { createdAt: FieldValue.serverTimestamp() } : {}) };
  transaction.set(ref, { id: business.id, businessId: business.id, ownerId: business.ownerId, ...pickBusinessFields(business, PROFILE_FIELDS), ...timestamps }, { merge: true });
  for (const [collection, fields] of [["wifiSettings", WIFI_FIELDS], ["reviewSettings", REVIEW_FIELDS], ["themes", THEME_FIELDS]] as const) {
    transaction.set(ref.collection(collection).doc("default"), { businessId: business.id, ...pickBusinessFields(business, fields), ...timestamps }, { merge: true });
  }
  for (const field of SOCIAL_FIELDS) {
    transaction.set(ref.collection("socialLinks").doc(field), { businessId: business.id, platform: field.replace("Url", ""), url: business[field], ...timestamps }, { merge: true });
  }
  const published = getAdminDb().collection("publicBusinesses").doc(business.slug);
  if (business.isPublished && !business.deleting) transaction.set(published, publicBusiness(business));
  else transaction.delete(published);
}

export async function createBusiness(uid: string, name: string, category?: string) {
  const db = getAdminDb();
  const id = nanoid();
  const base = slugify(name) || "business";
  for (let attempt = 0; attempt < 10; attempt++) {
    const slug = attempt ? `${base}-${slugSuffix()}` : base;
    const created = await db.runTransaction(async (transaction) => {
      const slugRef = db.collection("businessSlugs").doc(slug);
      if ((await transaction.get(slugRef)).exists) return false;
      const business = { ...defaultBusiness(id, uid, name, slug), category: category || null };
      writeBusiness(transaction, business, true);
      transaction.set(slugRef, { businessId: id, createdAt: FieldValue.serverTimestamp() });
      transaction.set(businessRef(id).collection("members").doc(uid), { uid, businessId: id, role: "owner", createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      transaction.set(businessRef(id).collection("qrCodes").doc("main"), { id: "main", businessId: id, label: "Main QR", style: "classic", targetPath: `/b/${slug}`, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      return true;
    });
    if (created) return (await getBusiness(id))!;
  }
  throw new ApiError(409, "business/slug-conflict", "Could not allocate a business URL. Please try again.");
}

export async function updateBusiness(id: string, update: Partial<Business>) {
  return getAdminDb().runTransaction(async (transaction) => {
    const existing = await readBusiness(id, transaction);
    if (!existing || existing.deleting) throw new ApiError(404, "business/not-found", "Business not found.");
    // Identity and physical QR slug are immutable through this editor.
    const business = { ...existing, ...update, id, businessId: id, ownerId: existing.ownerId, slug: existing.slug };
    writeBusiness(transaction, business, false);
  });
}

export async function deleteBusiness(id: string) {
  const ref = businessRef(id);
  await getAdminDb().runTransaction(async (transaction) => {
    const business = fromFirestore<Business>(await transaction.get(ref));
    if (!business) throw new ApiError(404, "business/not-found", "Business not found.");
    transaction.update(ref, { isPublished: false, deleting: true, updatedAt: FieldValue.serverTimestamp() });
    transaction.delete(getAdminDb().collection("publicBusinesses").doc(business.slug));
    // Keep the slug reserved until cleanup completes; no QR may resolve to a new owner.
  });
  // Storage objects are public branding/menu assets, not user authentication data.
  const { getAdminStorage } = await import("@/lib/firebase/admin");
  if (process.env.FIREBASE_STORAGE_EMULATOR_HOST || process.env.FIREBASE_CLEANUP_STORAGE_ON_DELETE === "true") {
    await getAdminStorage().bucket().deleteFiles({ prefix: `businesses/${id}/`, force: true });
  }
  await getAdminDb().recursiveDelete(ref);
  // Slug tombstones are deliberately retained to prevent old printed QR takeover.
}

export async function getMenu(id: string, onlyPublic = false) {
  const ref = businessRef(id);
  const [categories, items] = await Promise.all([ref.collection("menuCategories").orderBy("sortOrder").get(), ref.collection("menuItems").orderBy("sortOrder").get()]);
  const categoryData = categories.docs.map((doc) => fromFirestore<MenuCategory>(doc));
  const itemData = items.docs.map((doc) => fromFirestore<MenuItem>(doc)).filter((item) => !onlyPublic || item.available);
  return { categories: onlyPublic ? categoryData.filter((cat) => itemData.some((item) => item.categoryId === cat.id)) : categoryData, items: itemData };
}

export async function createMenuEntry(id: string, collection: "menuCategories" | "menuItems", input: Record<string, unknown>) {
  const ref = businessRef(id);
  const entry = ref.collection(collection).doc(nanoid());
  const counter = ref.collection("_meta").doc(collection);
  await getAdminDb().runTransaction(async (transaction) => {
    const [business, ordering] = await transaction.getAll(ref, counter);
    if (!business.exists || business.data()?.deleting) throw new ApiError(404, "business/not-found", "Business not found.");
    if (collection === "menuItems") {
      const category = await transaction.get(ref.collection("menuCategories").doc(identifier.parse(input.categoryId)));
      if (!category.exists) throw new ApiError(400, "menu/invalid-category", "Choose a category from this business.");
    }
    const nextOrder = ordering.data()?.nextOrder || 0;
    transaction.set(counter, { nextOrder: nextOrder + 1 });
    transaction.set(entry, { ...input, id: entry.id, businessId: id, sortOrder: nextOrder, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  });
  return entry.id;
}

export async function updateMenuItem(businessId: string, itemId: string, input: Record<string, unknown>) {
  const ref = businessRef(businessId);
  await getAdminDb().runTransaction(async (transaction) => {
    const itemRef = ref.collection("menuItems").doc(identifier.parse(itemId));
    const [business, item] = await transaction.getAll(ref, itemRef);
    if (!business.exists || business.data()?.deleting || !item.exists) throw new ApiError(404, "menu/not-found", "Menu item not found.");
    if (input.categoryId) {
      const category = await transaction.get(ref.collection("menuCategories").doc(identifier.parse(input.categoryId)));
      if (!category.exists) throw new ApiError(400, "menu/invalid-category", "Choose a category from this business.");
    }
    transaction.update(itemRef, { ...input, updatedAt: FieldValue.serverTimestamp() });
  });
}
export async function deleteMenuEntry(businessId: string, collection: "menuCategories" | "menuItems", entryId: string) {
  const ref = businessRef(businessId).collection(collection).doc(identifier.parse(entryId));
  if (!(await ref.get()).exists) throw new ApiError(404, "menu/not-found", "Menu entry not found.");
  if (collection === "menuCategories") {
    // Remove the category BEFORE reading its items. Creation/moves read the category
    // inside transactions: they finish before this deletion or retry and reject it.
    // Reading items first would miss a concurrent create and leave an orphan.
    await ref.delete();
    const items = await businessRef(businessId).collection("menuItems").where("categoryId", "==", entryId).get();
    for (let offset = 0; offset < items.docs.length; offset += 400) {
      const batch = getAdminDb().batch();
      items.docs.slice(offset, offset + 400).forEach((item) => batch.delete(item.ref));
      await batch.commit();
    }
  } else await ref.delete();
}

export async function getAnalytics(businessId: string, range: string) {
  const since = analyticsStartDate(range);
  const query = businessRef(businessId).collection("analytics").where("createdAt", ">=", since).orderBy("createdAt", "desc");
  const events: AnalyticsEvent[] = [];
  let page = await query.limit(1000).get();
  while (!page.empty) {
    events.push(...page.docs.map((doc) => fromFirestore<AnalyticsEvent>(doc)));
    if (page.size < 1000) break;
    page = await query.startAfter(page.docs[page.docs.length - 1]).limit(1000).get();
  }
  return events;
}

export function normalizedRange(value?: string): "1" | "7" | "30" | "all" {
  return value === "1" || value === "7" || value === "30" || value === "all" ? value : "7";
}
