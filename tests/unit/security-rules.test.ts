import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const firestoreRules = readFileSync("firestore.rules", "utf8");
const storageRules = readFileSync("storage.rules", "utf8");
const all = [["firestore.rules", firestoreRules], ["storage.rules", storageRules]] as const;

function withoutComments(source: string) {
  return source.replace(/\/\/[^\n]*/g, "");
}
function balanced(source: string, open: string, close: string) {
  let depth = 0;
  for (const character of source) {
    if (character === open) depth++;
    if (character === close) depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

describe("deployed security rules", () => {
  it("declares rules_version 2 and the right service, with balanced syntax", () => {
    for (const [name, source] of all) {
      const body = withoutComments(source);
      expect(body, name).toContain("rules_version = '2';");
      expect(balanced(body, "{", "}"), `${name} braces`).toBe(true);
      expect(balanced(body, "(", ")"), `${name} parentheses`).toBe(true);
      expect(balanced(body, "[", "]"), `${name} brackets`).toBe(true);
    }
    expect(firestoreRules).toContain("service cloud.firestore");
    expect(storageRules).toContain("service firebase.storage");
  });

  it("never opens Firestore or Storage to everyone", () => {
    for (const [name, source] of all) {
      const body = withoutComments(source).replace(/\s+/g, " ");
      expect(body, name).not.toMatch(/allow [a-z, ]*: if true/);
      expect(body, name).not.toMatch(/allow read, write: if true/);
      expect(body, name).not.toMatch(/allow write: if request\.auth != null;/);
      // A terminal catch-all deny must exist so new collections are never public.
      expect(body, name).toMatch(/match \/\{(document|allPaths)=\*\*\} \{ allow read, write: if false; \}/);
    }
  });

  it("keeps every user profile private to its own authenticated owner", () => {
    const profile = firestoreRules.slice(firestoreRules.indexOf("match /users/{uid}"));
    expect(profile).toContain("allow get: if isUser(uid);");
    expect(profile).toContain("allow list: if false;");
    expect(profile).toContain("allow delete: if false;");
    // Self-write only, no role escalation, no foreign email claim.
    expect(profile).toMatch(/allow create: if isUser\(uid\)/);
    expect(profile).toMatch(/allow update: if isUser\(uid\)/);
    expect(firestoreRules).toContain("request.auth.token.get('email', '').lower()");
    expect(firestoreRules).toContain("request.resource.data.get('role', 'user') == resource.data.get('role', 'user')");
  });

  it("gates business data on real ownership or membership, never on a client-supplied id", () => {
    for (const [name, source] of all) {
      expect(source, name).toContain("businessField(id, 'ownerId', '') == request.auth.uid");
      expect(source, name).toContain("membershipDoc(id).data.get('businessId', '') == id");
      expect(source, name).toContain("membershipDoc(id).data.get('uid', '') == request.auth.uid");
      expect(source, name).toMatch(/in \['owner', 'admin', 'staff'\]/);
    }
    // Owners cannot be demoted/removed through the members subcollection.
    expect(firestoreRules).toContain("allow delete: if isOwner(id) && uid != businessField(id, 'ownerId', '');");
  });

  it("exposes only the published public surface used by /b/{slug}", () => {
    expect(firestoreRules).toContain("match /publicBusinesses/{slug}");
    expect(firestoreRules).toContain("allow list, write: if false;");
    // Private collections stay private even for a published business.
    for (const line of [
      "match /wifiSettings/{settingId} {\n        allow read: if isMember(id);",
      "match /analytics/{eventId} {\n        allow read: if isAdmin(id);",
      "match /activityLogs/{logId} {\n        allow read: if isAdmin(id);",
      "match /reviewSessions/{sessionId} {",
    ]) expect(firestoreRules).toContain(line);
    // Public read is allowed for menu, social links, appearance and QR destination.
    expect(firestoreRules).toContain("allow read: if isMember(id) || menuIsPublic(id);");
    expect(firestoreRules).toContain("allow read: if isMember(id) || (menuIsPublic(id) && resource.data.get('available', false) == true);");
    expect(firestoreRules).toContain("match /themes/{themeId} {\n        allow read: if isMember(id) || isPublished(id);");
    expect(firestoreRules).toContain("match /qrCodes/{qrId} {\n        allow read: if isMember(id) || isPublished(id);");
  });

  it("never dereferences a document that may not exist", () => {
    // get() returns null for missing documents; .data must only be read behind exists()/null checks.
    for (const [name, source] of all) {
      const body = withoutComments(source);
      expect(body, name).toMatch(/exists\(businessPath\(id\)\) \? /);
      expect(body, name).toContain("membershipDoc(id) == null ?");
    }
  });

  it("validates Storage uploads for identity, membership, type and size", () => {
    expect(storageRules).toContain("request.resource.size <= 5 * 1024 * 1024");
    expect(storageRules).toContain("request.resource.contentType in ['image/jpeg', 'image/png', 'image/webp']");
    expect(storageRules).toContain("fileName.matches('^[A-Za-z0-9_-]+\\\\.(jpg|png|webp)$')");
    expect(storageRules).toContain("allow read: if kind in ['logos', 'covers', 'menu'] && (isMember(id) || isPublished(id));");
  });
});
