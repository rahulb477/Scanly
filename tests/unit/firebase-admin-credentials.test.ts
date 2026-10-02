import { afterEach, describe, expect, it } from "vitest";
import { normalizePrivateKey, resolveServiceAccountCredentials } from "@/lib/firebase/admin";

const PEM = ["-----BEGIN PRIVATE KEY-----", "MIIBFAKEKEYMATERIAL", "-----END PRIVATE KEY-----"].join("\n");
const SERVICE_ACCOUNT = "firebase-adminsdk-fake@restaurant-flow-59183.iam.gserviceaccount.com";

describe("Firebase Admin credential handling", () => {
  afterEach(() => {
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
  });

  it("converts escaped \\n sequences into real newlines", () => {
    expect(normalizePrivateKey(PEM.replace(/\n/g, "\\n"))).toBe(PEM);
  });

  it("leaves an already-valid multiline key byte-for-byte intact", () => {
    expect(normalizePrivateKey(PEM)).toBe(PEM);
    expect(normalizePrivateKey(`${PEM}\n`)).toBe(PEM);
  });

  it("unwraps surrounding quotes without touching the key", () => {
    expect(normalizePrivateKey(`"${PEM.replace(/\n/g, "\\n")}"`)).toBe(PEM);
  });

  it("uses the environment credentials when they are already correct", () => {
    process.env.FIREBASE_CLIENT_EMAIL = SERVICE_ACCOUNT;
    process.env.FIREBASE_PRIVATE_KEY = PEM.replace(/\n/g, "\\n");
    expect(resolveServiceAccountCredentials()).toMatchObject({ clientEmail: SERVICE_ACCOUNT, privateKey: PEM, source: "environment" });
  });

  it("extracts the PEM and client_email from a service-account JSON pasted into FIREBASE_PRIVATE_KEY", () => {
    process.env.FIREBASE_CLIENT_EMAIL = "owner@example.com";
    process.env.FIREBASE_PRIVATE_KEY = JSON.stringify({ type: "service_account", project_id: "restaurant-flow-59183", private_key: PEM.replace(/\n/g, "\\n"), client_email: SERVICE_ACCOUNT });
    expect(resolveServiceAccountCredentials()).toMatchObject({ clientEmail: SERVICE_ACCOUNT, privateKey: PEM, source: "service-account-json", unwrappedJson: true });
  });

  it("recovers the PEM and client_email from a pretty-printed JSON blob that cannot be parsed", () => {
    process.env.FIREBASE_CLIENT_EMAIL = "owner@example.com";
    // Raw newlines inside a JSON string make JSON.parse fail; the PEM is recovered by pattern.
    process.env.FIREBASE_PRIVATE_KEY = [`{`, `  "type": "service_account",`, `  "project_id": "restaurant-flow-59183",`, `  "private_key": "${PEM}",`, `  "client_email": "${SERVICE_ACCOUNT}"`, `}`].join("\n");
    expect(resolveServiceAccountCredentials()).toMatchObject({ clientEmail: SERVICE_ACCOUNT, privateKey: PEM, source: "service-account-json", unwrappedJson: true });
  });

  it("recovers the PEM from a JSON blob whose key uses escaped \\n sequences", () => {
    process.env.FIREBASE_CLIENT_EMAIL = SERVICE_ACCOUNT;
    process.env.FIREBASE_PRIVATE_KEY = `{"private_key": "${PEM.replace(/\n/g, "\\n")}"}`;
    expect(resolveServiceAccountCredentials()).toMatchObject({ clientEmail: SERVICE_ACCOUNT, privateKey: PEM });
  });

  it("reports exactly which credential is missing", () => {
    expect(resolveServiceAccountCredentials()).toEqual({ error: "missing" });
    process.env.FIREBASE_CLIENT_EMAIL = SERVICE_ACCOUNT;
    expect(resolveServiceAccountCredentials()).toEqual({ error: "missing-private-key" });
    delete process.env.FIREBASE_CLIENT_EMAIL;
    process.env.FIREBASE_PRIVATE_KEY = PEM;
    expect(resolveServiceAccountCredentials()).toEqual({ error: "missing-client-email" });
  });
});
