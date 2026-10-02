import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { initializeApp, deleteApp } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile, type User } from "firebase/auth";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc, updateDoc, serverTimestamp, query, where } from "firebase/firestore";
import { ref, uploadBytes, getBytes } from "firebase/storage";
import { readFile } from "node:fs/promises";
import { initializeApp as initializeAdminApp, getApps as adminApps } from "firebase-admin/app";
import { getFirestore as adminFirestore } from "firebase-admin/firestore";
import { PNG } from "pngjs";

const base = "http://127.0.0.1:3001";
const projectId = "demo-scanly";
const app = initializeApp({ apiKey: "demo-emulator-only-key", projectId, authDomain: `${projectId}.firebaseapp.com` }, "integration-tests");
const auth = getAuth(app);
let owner: User;
let ownerToken: string;
let otherToken: string;
let business: { id: string; slug: string; ownerId: string };
let foreignBusiness: { id: string; slug: string };
let environment: RulesTestEnvironment;
const suffix = `${Date.now()}`;
const ownerEmail = `owner-${suffix}@example.test`;
let categoryId: string;
let itemId: string;
const headers = (token = ownerToken) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json", Origin: base });
async function call(path: string, method = "GET", body?: unknown, token = ownerToken) {
  return fetch(base + path, { method, headers: headers(token), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
const admin = adminFirestore(adminApps().find((entry) => entry.name === "rules-test-seed") ?? initializeAdminApp({ projectId }, "rules-test-seed"));

beforeAll(async () => {
  if (process.env.FIREBASE_PROJECT_ID !== projectId || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error("Run npm run test:integration. Production services must not be used.");
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  environment = await initializeTestEnvironment({ projectId, firestore: { host: "127.0.0.1", port: 8080, rules: await readFile("firestore.rules", "utf8") }, storage: { host: "127.0.0.1", port: 9199, rules: await readFile("storage.rules", "utf8") } });
  owner = (await createUserWithEmailAndPassword(auth, ownerEmail, "Secure123!")).user;
  await updateProfile(owner, { displayName: "Actual Firebase Owner" });
  ownerToken = await owner.getIdToken();
  business = (await (await call("/api/businesses", "POST", { businessName: `Integration Cafe ${suffix}` })).json()).business;
  const other = (await createUserWithEmailAndPassword(auth, `other-${suffix}@example.test`, "Secure123!")).user;
  otherToken = await other.getIdToken();
  foreignBusiness = (await (await call("/api/businesses", "POST", { businessName: `Foreign Cafe ${suffix}` }, otherToken)).json()).business;
  await signInWithEmailAndPassword(auth, ownerEmail, "Secure123!");
});
afterAll(async () => { await environment?.cleanup(); await deleteApp(app); });

describe("real Firebase authentication and token-protected application APIs", () => {
  it("creates a real email/password account with displayName, not a custom session user", () => { expect(owner.uid).toBeTruthy(); expect(owner.displayName).toBe("Actual Firebase Owner"); expect(business.ownerId).toBe(owner.uid); });
  it("rejects invalid credentials and duplicate signup with Firebase codes", async () => {
    await expect(signInWithEmailAndPassword(auth, ownerEmail, "incorrect-password")).rejects.toHaveProperty("code", "auth/wrong-password");
    await expect(createUserWithEmailAndPassword(auth, ownerEmail, "Secure123!")).rejects.toMatchObject({ code: "auth/email-already-in-use" });
  });
  it("issues a password reset action through Firebase", async () => {
    await sendPasswordResetEmail(auth, ownerEmail);
    const response = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${projectId}/oobCodes`);
    const codes = (await response.json()).oobCodes as { email: string; requestType: string }[];
    expect(codes.some((code) => code.email === ownerEmail && code.requestType === "PASSWORD_RESET")).toBe(true);
  });
  it("rejects missing or forged tokens and never trusts a frontend userId", async () => {
    expect((await fetch(base + "/api/businesses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessName: "Spoofed", userId: owner.uid }) })).status).toBe(401);
    expect((await call("/api/businesses", "POST", { businessName: "Spoofed" }, "forged-token")).status).toBe(401);
    expect((await call("/api/businesses", "POST", { businessName: "Spoofed", ownerId: owner.uid }, otherToken)).status).toBe(400);
  });
  it("creates a Firebase-issued httpOnly SSR cookie and Firestore profile", async () => {
    const response = await call("/api/auth/session", "POST");
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    const profile = (await admin.collection("users").doc(owner.uid).get()).data();
    expect(profile).toMatchObject({ uid: owner.uid, email: ownerEmail, name: "Actual Firebase Owner", role: "user" });
    expect(profile).not.toHaveProperty("passwordHash");
  });
  it("blocks cross-origin session creation and clearing", async () => {
    for (const method of ["POST", "DELETE"]) {
      const response = await fetch(base + "/api/auth/session", { method, headers: { ...headers(), Origin: "https://evil.example.test" } });
      expect(response.status).toBe(403);
    }
  });
  it("enforces tenant isolation on reads, edits and deletion", async () => {
    for (const method of ["GET", "PATCH", "DELETE"]) expect((await call(`/api/businesses/${business.id}`, method, method === "PATCH" ? { businessName: "Unauthorized" } : undefined, otherToken)).status).toBe(403);
    expect((await call(`/api/businesses/${business.id}`, "PATCH", { ownerId: "spoof" })).status).toBe(400);
  });
  it("creates required settings, membership and permanent QR metadata atomically", async () => {
    const snapshot = await admin.collection("businesses").doc(business.id).get();
    expect(snapshot.data()).toMatchObject({ businessId: business.id, ownerId: owner.uid });
    for (const collection of ["members", "wifiSettings", "reviewSettings", "themes", "qrCodes", "socialLinks", "activityLogs"]) expect((await snapshot.ref.collection(collection).get()).empty).toBe(false);
    expect((await snapshot.ref.collection("qrCodes").doc("main").get()).data()?.targetPath).toBe(`/b/${business.slug}`);
  });
  it("keeps a physical QR URL stable when business and destination settings change", async () => {
    expect((await call(`/api/businesses/${business.id}`, "PATCH", { businessName: "Renamed Integration Cafe", googleReviewUrl: "https://search.google.com/local/writereview?placeid=TEST", instagramUrl: "https://instagram.com/test", wifiEnabled: true, wifiName: "Guest", wifiPassword: "Guest-Secret", wifiPublicSharingEnabled: true })).status).toBe(200);
    expect((await (await call(`/api/businesses/${business.id}`)).json()).business.slug).toBe(business.slug);
    expect((await admin.collection("businesses").doc(business.id).collection("qrCodes").doc("main").get()).data()?.targetPath).toBe(`/b/${business.slug}`);
  });
  it("allocates distinct valid permanent slugs for duplicate business names", async () => {
    const name = `Duplicate Cafe ${suffix}`;
    const first = await call("/api/businesses", "POST", { businessName: name });
    const second = await call("/api/businesses", "POST", { businessName: name });
    expect(first.status).toBe(201); expect(second.status).toBe(201);
    const a = (await first.json()).business; const b = (await second.json()).business;
    expect(b.slug).not.toBe(a.slug); expect(b.slug).toMatch(/^[a-z0-9-]{1,120}$/);
    expect((await fetch(base + `/b/${b.slug}`)).status).toBe(200);
  });
  it("supports category/item CRUD and rejects foreign category references", async () => {
    const response = await call("/api/menu/categories", "POST", { businessId: business.id, name: "Coffee" });
    expect(response.status).toBe(201); categoryId = (await response.json()).id;
    const foreign = await (await call("/api/menu/categories", "POST", { businessId: foreignBusiness.id, name: "Private" }, otherToken)).json();
    expect((await call("/api/menu/items", "POST", { businessId: business.id, categoryId: foreign.id, name: "Foreign", price: "$5" })).status).toBe(400);
    const item = await call("/api/menu/items", "POST", { businessId: business.id, categoryId, name: "Espresso", price: "$4", description: "Real menu item" });
    expect(item.status).toBe(201); itemId = (await item.json()).id;
    expect((await call(`/api/menu/items/${itemId}?businessId=${business.id}`, "PATCH", { price: "$5" })).status).toBe(200);
    expect((await call(`/api/menu/items/${itemId}?businessId=${business.id}`, "DELETE", undefined, otherToken)).status).toBe(403);
  });
  it("does not orphan items when category deletion races item creation", async () => {
    const response = await call("/api/menu/categories", "POST", { businessId: business.id, name: "Concurrent category" });
    expect(response.status).toBe(201); const category = (await response.json()).id;
    const [creation, removal] = await Promise.all([
      call("/api/menu/items", "POST", { businessId: business.id, categoryId: category, name: "Concurrent item", price: "$1" }),
      call(`/api/menu/categories/${category}?businessId=${business.id}`, "DELETE"),
    ]);
    expect([201, 400]).toContain(creation.status); expect(removal.status).toBe(200);
    expect((await admin.collection("businesses").doc(business.id).collection("menuItems").where("categoryId", "==", category).get()).empty).toBe(true);
  });
  it("rejects oversized customer payloads before persisting them", async () => {
    const response = await fetch(base + "/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: business.id, type: "qr_scan", metadata: "x".repeat(70_000) }) });
    expect(response.status).toBe(413); expect((await response.json()).code).toBe("request/too-large");
  });
  it("publishes a customer page without login, without ownership/Wi-Fi/analytics leaks", async () => {
    const response = await fetch(base + `/b/${business.slug}`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Renamed Integration Cafe"); expect(html).toContain("Espresso");
    expect(html).not.toContain("Guest-Secret"); expect(html).not.toContain(owner.uid);
    expect(html).not.toContain("passwordHash");
    const wifi = await fetch(base + `/api/public/${business.slug}/wifi`);
    expect(wifi.status).toBe(200); expect(await wifi.json()).toMatchObject({ name: "Guest", password: "Guest-Secret" });
  });
  it("does not expose unpublished/unavailable menus or non-consented Wi-Fi", async () => {
    await call(`/api/menu/items/${itemId}?businessId=${business.id}`, "PATCH", { available: false });
    const menu = await fetch(base + `/api/menu/public?businessId=${business.id}`);
    expect((await menu.json()).items).toEqual([]);
    await call(`/api/businesses/${business.id}`, "PATCH", { menuEnabled: false, wifiPublicSharingEnabled: false });
    expect((await fetch(base + `/api/menu/public?businessId=${business.id}`)).status).toBe(403);
    expect((await fetch(base + `/api/public/${business.slug}/wifi`)).status).toBe(404);
    await call(`/api/businesses/${business.id}`, "PATCH", { menuEnabled: true, wifiPublicSharingEnabled: true });
    await call(`/api/menu/items/${itemId}?businessId=${business.id}`, "PATCH", { available: true });
  });
  it("generates a genuine local review draft and records private analytics/session data", async () => {
    const response = await fetch(base + "/api/ai/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: business.id, overallExperience: "Amazing", staffExperience: "Excellent", serviceExperience: "Good", selectedItems: ["Espresso"], language: "English", tone: "Natural" }) });
    expect(response.status).toBe(200); expect((await response.json()).review).toContain("Espresso");
    expect((await admin.collection("businesses").doc(business.id).collection("reviewSessions").get()).empty).toBe(false);
    expect((await admin.collection("businesses").doc(business.id).collection("analytics").where("type", "==", "review_generated").get()).empty).toBe(false);
    await call(`/api/businesses/${business.id}`, "PATCH", { aiReviewEnabled: false });
    expect((await fetch(base + "/api/ai/review", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: business.id, action: "shorten", review: "Text" }) })).status).toBe(403);
    await call(`/api/businesses/${business.id}`, "PATCH", { aiReviewEnabled: true });
  });
  it("stores anonymous events but rejects arbitrary customer personal data", async () => {
    const response = await fetch(base + "/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: business.id, type: "qr_scan" }) });
    expect(response.status).toBe(200);
    expect((await fetch(base + "/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: business.id, type: "qr_scan", metadata: { email: "private@example.test" } }) })).status).toBe(400);
  });
  it("prevents a staff member from editing business settings or deleting ownership", async () => {
    const otherUid = (await signInWithEmailAndPassword(auth, `other-${suffix}@example.test`, "Secure123!")).user.uid;
    await admin.collection("businesses").doc(business.id).collection("members").doc(otherUid).set({ uid: otherUid, businessId: business.id, role: "staff" });
    const token = await auth.currentUser!.getIdToken();
    expect((await call(`/api/businesses/${business.id}`, "PATCH", { businessName: "Staff rename" }, token)).status).toBe(403);
    expect((await call(`/api/businesses/${business.id}`, "DELETE", undefined, token)).status).toBe(403);
    expect((await call(`/api/businesses/${business.id}`, "GET", undefined, token)).status).toBe(200);
    expect((await call("/api/menu/categories", "POST", { businessId: business.id, name: "Staff menu access" }, token)).status).toBe(201);
    await signInWithEmailAndPassword(auth, ownerEmail, "Secure123!");
  });
});

describe("deployed Firestore/Storage security rules in the official emulators", () => {
  it("allows only a user's own profile and forbids role escalation", async () => {
    const db = environment.authenticatedContext(owner.uid, { email: ownerEmail }).firestore();
    await assertSucceeds(getDoc(doc(db, "users", owner.uid)));
    await assertFails(getDoc(doc(db, "users", "someone-else")));
    await assertFails(updateDoc(doc(db, "users", owner.uid), { role: "admin", updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(db, "users", owner.uid), { name: "Edited name", updatedAt: serverTimestamp() }));
  });
  it("denies private data to anonymous customers and other tenants", async () => {
    const anonymous = environment.unauthenticatedContext().firestore();
    const stranger = environment.authenticatedContext("not-a-member", { email: "stranger@example.test" }).firestore();
    for (const db of [anonymous, stranger]) {
      await assertFails(getDoc(doc(db, "businesses", business.id)));
      await assertFails(getDoc(doc(db, "businesses", business.id, "wifiSettings", "default")));
      await assertFails(getDocs(collection(db, "businesses", business.id, "analytics")));
      await assertFails(getDocs(collection(db, "businesses", business.id, "reviewSessions")));
    }
    await assertSucceeds(getDoc(doc(anonymous, "publicBusinesses", business.slug)));
    await assertFails(getDocs(collection(anonymous, "publicBusinesses")));
  });
  it("prevents self-joining and unauthorized member/owner changes", async () => {
    const stranger = environment.authenticatedContext("not-a-member", { email: "stranger@example.test" }).firestore();
    await assertFails(setDoc(doc(stranger, "businesses", business.id, "members", "not-a-member"), { uid: "not-a-member", businessId: business.id, role: "admin", createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    const db = environment.authenticatedContext(owner.uid, { email: ownerEmail }).firestore();
    await assertFails(updateDoc(doc(db, "businesses", business.id), { ownerId: "not-a-member", updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db, "businesses", business.id)));
    await assertFails(deleteDoc(doc(db, "businesses", business.id, "members", owner.uid)));
  });
  it("requires business/menu API mutations and rejects malformed membership authority", async () => {
    const own = environment.authenticatedContext(owner.uid, { email: ownerEmail }).firestore();
    await assertFails(updateDoc(doc(own, "businesses", business.id), { businessName: "Bypass projection", updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(own, "businesses", business.id, "menuItems", "bypass"), { id: "bypass", businessId: business.id, categoryId, name: "Bypass counters", price: "$1", description: "", image: null, available: true, sortOrder: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    const uid = "malformed-membership";
    await admin.collection("businesses").doc(business.id).collection("members").doc(uid).set({ uid, businessId: business.id, role: "owner" });
    await assertFails(getDoc(doc(environment.authenticatedContext(uid).firestore(), "businesses", business.id)));
    await assertFails(uploadBytes(ref(environment.authenticatedContext(uid).storage(), `businesses/${business.id}/menu/malformed.png`), new Uint8Array([1]), { contentType: "image/png" }));
  });
  it("filters anonymous menu queries to available items", async () => {
    const db = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDocs(query(collection(db, "businesses", business.id, "menuItems"), where("available", "==", true))));
    await assertFails(getDocs(collection(db, "businesses", business.id, "menuItems")));
  });
  it("protects private operational collections and public projection publishing", async () => {
    const db = environment.authenticatedContext(owner.uid, { email: ownerEmail }).firestore();
    for (const path of ["_rateLimits/spoof", "businessSlugs/spoof", `publicBusinesses/${business.slug}`, `businesses/${business.id}/analytics/spoof`]) await assertFails(setDoc(doc(db, path), { spoof: true }));
  });
  it("allows real PNG uploads with membership, denies SVG/oversize/other tenant uploads", async () => {
    const png = new PNG({ width: 2, height: 2 }); png.data.fill(255);
    const bytes = PNG.sync.write(png);
    const ownStorage = environment.authenticatedContext(owner.uid, { email: ownerEmail }).storage();
    const strangerStorage = environment.authenticatedContext("not-a-member").storage();
    const destination = `businesses/${business.id}/logos/security-test.png`;
    await assertSucceeds(uploadBytes(ref(ownStorage, destination), bytes, { contentType: "image/png" }));
    await assertFails(uploadBytes(ref(strangerStorage, destination), bytes, { contentType: "image/png" }));
    await assertFails(uploadBytes(ref(ownStorage, `businesses/${business.id}/logos/unsafe.svg`), new TextEncoder().encode("<svg/>"), { contentType: "image/svg+xml" }));
    await assertFails(uploadBytes(ref(ownStorage, `businesses/${business.id}/logos/oversize.png`), new Uint8Array(5 * 1024 * 1024 + 1), { contentType: "image/png" }));
    await assertSucceeds(getBytes(ref(environment.unauthenticatedContext().storage(), destination)));
  });
});

describe("logout and cleanup", () => {
  it("cascades category deletion and permits only the real owner to delete a business", async () => {
    expect((await call(`/api/menu/categories/${categoryId}?businessId=${business.id}`, "DELETE")).status).toBe(200);
    expect((await admin.collection("businesses").doc(business.id).collection("menuItems").doc(itemId).get()).exists).toBe(false);
  });
  for (const authorization of [undefined, "Bearer forged-token"]) {
    it(`revokes cookie-only logout even when the browser bearer token is ${authorization ? "invalid" : "unavailable"}`, async () => {
      const account = (await createUserWithEmailAndPassword(auth, `cookie-logout-${authorization ? "invalid" : "absent"}-${suffix}@example.test`, "Secure123!")).user;
      const token = await account.getIdToken();
      const response = await call("/api/auth/session", "POST", undefined, token);
      expect(response.status).toBe(200);
      const cookie = response.headers.get("set-cookie")!.split(";")[0];
      expect((await fetch(base + "/dashboard", { headers: { Cookie: cookie }, redirect: "manual" })).status).toBe(200);
      // Firebase revocation compares auth_time with second-precision validity time.
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const logout = await fetch(base + "/api/auth/session", { method: "DELETE", headers: { Cookie: cookie, Origin: base, ...(authorization ? { Authorization: authorization } : {}) } });
      expect(logout.status).toBe(200); expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
      expect((await fetch(base + "/dashboard", { headers: { Cookie: cookie }, redirect: "manual" })).status).toBe(307);
      expect((await call("/api/businesses", "GET", undefined, token)).status).toBe(401);
      await signInWithEmailAndPassword(auth, ownerEmail, "Secure123!");
    });
  }
  it("signs out Firebase, revokes copied server sessions and clears cookies", async () => {
    const response = await call("/api/auth/session", "POST");
    const cookie = response.headers.get("set-cookie")!.split(";")[0];
    const logout = await call("/api/auth/session", "DELETE");
    expect(logout.status).toBe(200); expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
    await signOut(auth); expect(auth.currentUser).toBeNull();
    const stale = await fetch(base + "/dashboard", { headers: { Cookie: cookie }, redirect: "manual" });
    expect(stale.status).toBe(307); expect(stale.headers.get("location")).toBe("/login");
  });
});
