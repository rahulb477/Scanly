import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb, getAdminStorage } from "../src/lib/firebase/admin";
import { legacyExportSchema, uidMappingSchema, validateUidMapping, migratedBusiness } from "../src/lib/data/migration";
import { PROFILE_FIELDS, WIFI_FIELDS, REVIEW_FIELDS, THEME_FIELDS, SOCIAL_FIELDS, pickBusinessFields, publicBusiness } from "../src/lib/data/business";
config({ path: ".env.local" });

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const positional = args.filter((arg) => !arg.startsWith("--"));
function time(value: unknown, fallback: Timestamp) { return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? Timestamp.fromDate(new Date(value)) : fallback; }

async function main() {
  if (positional.length !== 2) throw new Error("Usage: npm run migrate:import -- backups/scanly-export.json backups/uid-mapping.json [--apply]");
  const data = legacyExportSchema.parse(JSON.parse(await readFile(positional[0], "utf8")));
  const mapping = uidMappingSchema.parse(JSON.parse(await readFile(positional[1], "utf8")));
  validateUidMapping(data, mapping);
  console.info(`Migration plan: ${data.businesses.length} businesses, ${data.users.length} user profiles, ${data.menuItems.length} menu items. No passwords or sessions will be imported. Guest Wi-Fi public consent defaults to OFF.`);
  if (!apply) { console.info("Dry run only: no Firebase or PostgreSQL writes, and no production credential is required. Add --apply after reviewing the export and approved UID mapping."); return; }
  const auth = getAdminAuth();
  const db = getAdminDb();
  // Deliberate UID mapping + provider email validation prevents an unverified email
  // signup from claiming legacy businesses through an automatic email match.
  for (const user of data.users) {
    if (!Object.hasOwn(mapping, user.id)) continue;
    const firebaseUser = await auth.getUser(mapping[user.id]);
    if (firebaseUser.email?.toLowerCase() !== user.email.toLowerCase()) throw new Error("Approved UID mapping email does not match the legacy account. Review ownership manually.");
  }
  // Refuse to overwrite a populated destination or transfer a previously reserved QR.
  for (const row of data.businesses) {
    const [existing, slug] = await db.getAll(db.collection("businesses").doc(row.id), db.collection("businessSlugs").doc(row.slug));
    if (existing.exists || slug.exists) throw new Error("Destination already contains a business ID/slug from this export. Import into an empty, verified destination; do not overwrite tenants.");
  }
  for (const user of data.users) {
    if (!Object.hasOwn(mapping, user.id)) continue; const uid = mapping[user.id];
    const createdAt = Timestamp.fromDate(new Date(user.createdAt));
    await db.collection("users").doc(uid).set({ uid, name: user.name || "", email: user.email.toLowerCase(), photoURL: null, role: "user", createdAt, updatedAt: Timestamp.fromDate(new Date(user.updatedAt)) }, { merge: true });
  }
  async function migrateImage(value: unknown, businessId: string, kind: string): Promise<string | null> {
    if (typeof value !== "string" || !value) return null;
    if (!value.startsWith("data:")) return value;
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
    if (!match) throw new Error("Unsupported legacy inline image. Convert to JPEG/PNG/WebP before migration.");
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > 5 * 1024 * 1024) throw new Error("Legacy image exceeds the Storage 5 MB limit.");
    const extension = match[1] === "image/jpeg" ? "jpg" : match[1] === "image/png" ? "png" : "webp";
    const { randomUUID } = await import("node:crypto");
    const token = randomUUID();
    const bucket = getAdminStorage().bucket();
    const path = `businesses/${businessId}/${kind}/${randomUUID()}.${extension}`;
    await bucket.file(path).save(bytes, { resumable: false, contentType: match[1], metadata: { metadata: { firebaseStorageDownloadTokens: token } } });
    return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  }
  for (const row of data.businesses) {
    const business = migratedBusiness(row, mapping[row.ownerId]);
    business.logo = await migrateImage(business.logo, business.id, "logos");
    business.coverImage = await migrateImage(business.coverImage, business.id, "covers");
    const ref = db.collection("businesses").doc(business.id);
    const timestamps = { createdAt: Timestamp.fromDate(business.createdAt), updatedAt: Timestamp.fromDate(business.updatedAt) };
    await db.runTransaction(async (transaction) => {
      const slugRef = db.collection("businessSlugs").doc(business.slug);
      const [existing, slug] = await transaction.getAll(ref, slugRef);
      if (existing.exists || slug.exists) throw new Error("Destination changed during migration; refusing to overwrite.");
      transaction.set(ref, { id: business.id, businessId: business.id, ownerId: business.ownerId, ...pickBusinessFields(business, PROFILE_FIELDS), ...timestamps });
      transaction.set(slugRef, { businessId: business.id, createdAt: timestamps.createdAt });
      for (const [collection, fields] of [["wifiSettings", WIFI_FIELDS], ["reviewSettings", REVIEW_FIELDS], ["themes", THEME_FIELDS]] as const) transaction.set(ref.collection(collection).doc("default"), { businessId: business.id, ...pickBusinessFields(business, fields), ...timestamps });
      for (const field of SOCIAL_FIELDS) transaction.set(ref.collection("socialLinks").doc(field), { businessId: business.id, platform: field.replace("Url", ""), url: business[field], ...timestamps });
      transaction.set(db.collection("publicBusinesses").doc(business.slug), publicBusiness(business));
      transaction.set(ref.collection("members").doc(business.ownerId), { uid: business.ownerId, businessId: business.id, role: "owner", ...timestamps });
    });
    for (const member of data.businessMembers.filter((member) => member.businessId === business.id && member.userId !== row.ownerId)) {
      const uid = mapping[member.userId];
      await ref.collection("members").doc(uid).set({ uid, businessId: business.id, role: member.role === "owner" ? "admin" : member.role, createdAt: time(member.createdAt, timestamps.createdAt), updatedAt: timestamps.updatedAt });
    }
    for (const [collection, rows] of [["qrCodes", data.qrCodes], ["menuCategories", data.menuCategories], ["menuItems", data.menuItems], ["analytics", data.analyticsEvents], ["reviewSessions", data.reviewSessions], ["activityLogs", data.activityLogs]] as const) {
      for (const legacy of rows.filter((entry) => entry.businessId === business.id)) {
        const entry = { ...legacy, createdAt: time(legacy.createdAt, timestamps.createdAt), updatedAt: time(legacy.updatedAt, timestamps.updatedAt) };
        if (collection === "qrCodes") Object.assign(entry, { targetPath: `/b/${business.slug}` });
        if (collection === "menuItems") Object.assign(entry, { image: await migrateImage(legacy.image, business.id, "menu") });
        if (collection === "reviewSessions") Object.assign(entry, { expiresAt: Timestamp.fromMillis(Date.now() + 30 * 86400_000) });
        if (collection === "activityLogs") {
          if (typeof legacy.actor === "string" && Object.hasOwn(mapping, legacy.actor)) Object.assign(entry, { actor: mapping[legacy.actor] });
          if (typeof legacy.userId === "string") Object.assign(entry, { userId: Object.hasOwn(mapping, legacy.userId) ? mapping[legacy.userId] : null });
        }
        if (collection === "analytics") Object.assign(entry, { metadata: null }); // Never import raw UA/referrer/PII metadata.
        await ref.collection(collection).doc(legacy.id).set(entry);
      }
    }
    if (!data.qrCodes.some((entry) => entry.businessId === business.id && entry.id === "main")) {
      await ref.collection("qrCodes").doc("main").set({ id: "main", businessId: business.id, label: "Main QR", style: "classic", targetPath: `/b/${business.slug}`, ...timestamps });
    }
    // Continue sort counters above imported ordering, rather than resetting to zero.
    for (const [collection, rows] of [["menuCategories", data.menuCategories], ["menuItems", data.menuItems]] as const) {
      const orders = rows.filter((entry) => entry.businessId === business.id).map((entry) => Number(entry.sortOrder) || 0);
      await ref.collection("_meta").doc(collection).set({ nextOrder: Math.max(-1, ...orders) + 1 });
    }
  }
  console.info("Import completed. PostgreSQL was not changed or deleted. Reconcile counts, memberships, assets and physical QR URLs before cutting over traffic. In a partial failure, inspect the destination before any retry; this importer never silently overwrites existing tenants.");
}
main().catch((error: unknown) => {
  const safe = error instanceof Error && !error.message.includes("credential") && !error.message.includes("private") ? error.message : "Check secure server configuration and source data.";
  // SDK errors are not printed: they may contain sensitive connection details.
  console.error(`Migration failed: ${safe.startsWith("Usage:") || safe.includes("mapping") || safe.includes("Destination") ? safe : "Check secure Firebase configuration, approved UID mapping, destination conflicts and export schema. No credentials are printed."}`);
  process.exitCode = 1;
});
