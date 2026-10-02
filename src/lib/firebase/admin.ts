import "server-only";

import { createPrivateKey } from "node:crypto";
import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { FirebaseConfigurationError } from "./config";
import { logServerError, serverLog } from "../server-log";

/**
 * Firebase Admin for Vercel serverless execution.
 *
 * Every serverless invocation is a fresh Node process that may be reused for
 * several requests, so the app is created once per process and always reused:
 * duplicate `initializeApp()` calls throw `app/duplicate-app` and take the whole
 * function down (which surfaces in the browser as a non-JSON 500).
 */
export const FIREBASE_ADMIN_APP_NAME = "scanly-server";

/**
 * Accepts every form the key can take in a Vercel environment variable:
 * real newlines, escaped `\n` sequences, or a value wrapped in quotes.
 * A key that already contains real newlines is never rewritten, so a valid
 * multiline key is left byte-for-byte intact.
 */
export function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if (key.length >= 2 && ((key.startsWith("\"") && key.endsWith("\"")) || (key.startsWith("'") && key.endsWith("'")))) key = key.slice(1, -1).trim();
  const hasRealNewline = key.includes("\n") || key.includes("\r");
  const hasEscapedNewline = key.includes("\\n");
  if (!hasRealNewline && hasEscapedNewline) key = key.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
  return key;
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'")))) return trimmed.slice(1, -1).trim();
  return trimmed;
}

function isServiceAccountEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/i.test(stripWrappingQuotes(value));
}

/** Extracts a PEM from a blob even when the surrounding JSON cannot be parsed (pretty-printed pastes put raw newlines inside the string). */
function extractPrivateKeyFromBlob(value: string): string | undefined {
  const match = value.match(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/);
  return match ? normalizePrivateKey(match[0]) : undefined;
}

/** Extracts client_email from a blob even when the surrounding JSON cannot be parsed. */
function extractClientEmailFromBlob(value: string): string | undefined {
  const match = value.match(/"client_email"\s*:\s*"([^"]+)"/);
  return match?.[1] ? stripWrappingQuotes(match[1]) : undefined;
}

function looksLikeServiceAccountBlob(value: string): boolean {
  return value.includes("\"private_key\"") || value.includes("\"client_email\"") || value.trim().startsWith("{");
}

/** Recognises the common dashboard mistake of pasting the whole service-account JSON into FIREBASE_PRIVATE_KEY. */
function parseServiceAccountJson(value: string): Record<string, unknown> | undefined {
  const text = stripWrappingQuotes(value);
  if (!text.startsWith("{")) return undefined;
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

export type ServiceAccountCredentials = { clientEmail: string; privateKey: string; source: "environment" | "service-account-json"; unwrappedJson: boolean };
export type CredentialResolution = ServiceAccountCredentials | { error: "missing" | "missing-client-email" | "missing-private-key" };

/**
 * Reads the Firebase Admin service-account credentials from the environment.
 *
 * Tolerates the two Vercel dashboard mistakes that otherwise surface only as an
 * opaque "invalid PEM" / "invalid credential" failure:
 *  - FIREBASE_PRIVATE_KEY containing the whole service-account JSON instead of
 *    just the `private_key` PEM (the PEM is extracted from it), and
 *  - FIREBASE_CLIENT_EMAIL that is not the service-account address, when the
 *    service-account JSON provides the real `client_email`.
 *
 * Only safe booleans are logged; no value is ever written to a log or response.
 */
export function resolveServiceAccountCredentials(): CredentialResolution {
  const rawEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const rawKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
  if (!rawEmail && !rawKey) return { error: "missing" };

  let clientEmail = rawEmail ? stripWrappingQuotes(rawEmail) : "";
  let privateKey = rawKey ? normalizePrivateKey(rawKey) : "";
  let unwrappedJson = false;

  const json = rawKey ? parseServiceAccountJson(rawKey) : undefined;
  if (json || (rawKey && looksLikeServiceAccountBlob(rawKey))) {
    unwrappedJson = true;
    const jsonKey = typeof json?.private_key === "string" ? json.private_key : undefined;
    const extractedKey = (jsonKey && jsonKey.includes("-----BEGIN PRIVATE KEY-----") ? jsonKey : undefined) ?? (rawKey ? extractPrivateKeyFromBlob(rawKey) : undefined);
    if (extractedKey) {
      privateKey = normalizePrivateKey(extractedKey);
      serverLog("admin", "private-key-json-unwrapped", { reason: "FIREBASE_PRIVATE_KEY holds a service-account JSON object; extracted its private_key", parsed: Boolean(json) });
    }
    const jsonEmail = typeof json?.client_email === "string" ? json.client_email : undefined;
    const extractedEmail = jsonEmail ?? (rawKey ? extractClientEmailFromBlob(rawKey) : undefined);
    if (!isServiceAccountEmail(clientEmail) && extractedEmail && isServiceAccountEmail(extractedEmail)) {
      clientEmail = stripWrappingQuotes(extractedEmail);
      serverLog("admin", "client-email-json-fallback", { reason: "FIREBASE_CLIENT_EMAIL is not a service-account address; using client_email from the service-account JSON" });
    }
  }

  if (!clientEmail) return { error: rawKey ? "missing-client-email" : "missing" };
  if (!privateKey) return { error: "missing-private-key" };
  return { clientEmail, privateKey, source: unwrappedJson ? "service-account-json" : "environment", unwrappedJson };
}

function assertUsablePrivateKey(privateKey: string): void {
  if (!privateKey.includes("-----BEGIN PRIVATE KEY-----") || !privateKey.includes("-----END PRIVATE KEY-----")) {
    serverLog("admin", "invalid-private-key", { reason: "missing PEM header/footer" });
    throw new FirebaseConfigurationError("Invalid Firebase Admin credentials. Set FIREBASE_PRIVATE_KEY to the PEM private_key string from the service account (not the whole JSON, not a public key).");
  }
  try {
    // Proves the PEM parses before Firebase Admin tries to sign with it; a bad
    // key otherwise fails later with an opaque error during token verification.
    createPrivateKey(privateKey);
  } catch (error) {
    logServerError("admin", "private-key", error);
    throw new FirebaseConfigurationError("Invalid Firebase Admin private key. Re-download the service account key and paste the full PEM private_key, then redeploy.");
  }
}

export function getFirebaseAdminApp(): App {
  // Reuse the existing app in this process. Never initialize twice.
  const existing = getApps().find((app) => app.name === FIREBASE_ADMIN_APP_NAME);
  if (existing) return existing;

  const adminProject = process.env.FIREBASE_PROJECT_ID?.trim();
  const webProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();

  if (!adminProject) {
    serverLog("admin", "configuration-missing", { missing: "FIREBASE_PROJECT_ID" });
    throw new FirebaseConfigurationError("Server Firebase configuration missing: FIREBASE_PROJECT_ID. Configure the server and redeploy.");
  }
  if (webProject && webProject !== adminProject) {
    // Safe identifiers only: project ids are public configuration, never secrets.
    serverLog("admin", "Firebase Admin project does not match Firebase Web project.", { adminProject, webProject });
    throw new FirebaseConfigurationError("Firebase Admin project does not match Firebase Web project. Set FIREBASE_PROJECT_ID to the same project as NEXT_PUBLIC_FIREBASE_PROJECT_ID and redeploy.");
  }
  serverLog("admin", "initializing", { app: FIREBASE_ADMIN_APP_NAME, adminProject, webProject: webProject || null });

  const emulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST);
  if (emulator) {
    if (!adminProject.startsWith("demo-") || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
      throw new FirebaseConfigurationError("Emulator mode requires a demo- project and both Auth and Firestore emulator hosts; production credentials are never used in emulator tests.");
    }
    return initializeApp({ projectId: adminProject, storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET }, FIREBASE_ADMIN_APP_NAME);
  }

  const rawEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
  if (!rawEmail && !rawPrivateKey) {
    if (process.env.FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS === "true") {
      return initializeApp({ projectId: adminProject, credential: applicationDefault(), storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET }, FIREBASE_ADMIN_APP_NAME);
    }
    serverLog("admin", "configuration-missing", { missing: "FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY" });
    throw new FirebaseConfigurationError("Server Firebase configuration missing: FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (or Application Default Credentials). Configure secure server variables and redeploy.");
  }

  if (Boolean(rawEmail) !== Boolean(rawPrivateKey)) {
    serverLog("admin", "configuration-missing", { hasClientEmail: Boolean(rawEmail), hasPrivateKey: Boolean(rawPrivateKey) });
    throw new FirebaseConfigurationError("Server Firebase configuration missing: set both FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or use Application Default Credentials.");
  }

  const credentials = resolveServiceAccountCredentials();
  if ("error" in credentials) {
    serverLog("admin", "configuration-missing", { reason: credentials.error });
    throw new FirebaseConfigurationError("Server Firebase configuration missing: set both FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or use Application Default Credentials.");
  }
  const { clientEmail, privateKey, source, unwrappedJson } = credentials;
  if (!isServiceAccountEmail(clientEmail)) {
    serverLog("admin", "invalid-client-email", { reason: "not a service account address", source });
    throw new FirebaseConfigurationError("Invalid Firebase Admin credentials. FIREBASE_CLIENT_EMAIL must be the service account's client_email (…@<project>.iam.gserviceaccount.com), not a personal email address.");
  }
  assertUsablePrivateKey(privateKey);
  try {
    const app = initializeApp({ projectId: adminProject, credential: cert({ projectId: adminProject, clientEmail, privateKey }), storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET }, FIREBASE_ADMIN_APP_NAME);
    serverLog("admin", "initialized", { app: FIREBASE_ADMIN_APP_NAME, adminProject, source, unwrappedJson });
    return app;
  } catch (error) {
    logServerError("admin", "initializeApp", error, { adminProject });
    throw new FirebaseConfigurationError("Firebase Admin could not be initialized with the configured credentials. Check FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY and redeploy.");
  }
}

export function getAdminAuth() { return getAuth(getFirebaseAdminApp()); }
export function getAdminDb() { return getFirestore(getFirebaseAdminApp()); }
export function getAdminStorage() { return getStorage(getFirebaseAdminApp()); }
