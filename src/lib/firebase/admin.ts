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

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawPrivateKey ? normalizePrivateKey(rawPrivateKey) : undefined;

  if (Boolean(clientEmail) !== Boolean(privateKey)) {
    serverLog("admin", "configuration-missing", { hasClientEmail: Boolean(clientEmail), hasPrivateKey: Boolean(privateKey) });
    throw new FirebaseConfigurationError("Server Firebase configuration missing: set both FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or use Application Default Credentials.");
  }

  if (clientEmail && privateKey) {
    if (!clientEmail.endsWith(".iam.gserviceaccount.com")) {
      serverLog("admin", "invalid-client-email", { reason: "not a service account address" });
      throw new FirebaseConfigurationError("Invalid Firebase Admin credentials. FIREBASE_CLIENT_EMAIL must be the service account's client_email, not a personal email address.");
    }
    assertUsablePrivateKey(privateKey);
    try {
      const app = initializeApp({ projectId: adminProject, credential: cert({ projectId: adminProject, clientEmail, privateKey }), storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET }, FIREBASE_ADMIN_APP_NAME);
      serverLog("admin", "initialized", { app: FIREBASE_ADMIN_APP_NAME, adminProject });
      return app;
    } catch (error) {
      logServerError("admin", "initializeApp", error, { adminProject });
      throw new FirebaseConfigurationError("Firebase Admin could not be initialized with the configured credentials. Check FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY and redeploy.");
    }
  }

  if (process.env.FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS === "true") {
    return initializeApp({ projectId: adminProject, credential: applicationDefault(), storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET }, FIREBASE_ADMIN_APP_NAME);
  }

  serverLog("admin", "configuration-missing", { missing: "FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY" });
  throw new FirebaseConfigurationError("Server Firebase configuration missing: FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (or Application Default Credentials). Configure secure server variables and redeploy.");
}

export function getAdminAuth() { return getAuth(getFirebaseAdminApp()); }
export function getAdminDb() { return getFirestore(getFirebaseAdminApp()); }
export function getAdminStorage() { return getStorage(getFirebaseAdminApp()); }
