import "server-only";

import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { FirebaseConfigurationError } from "./config";

export function getFirebaseAdminApp(): App {
  const existing = getApps().find((app) => app.name === "scanly-server");
  if (existing) return existing;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new FirebaseConfigurationError("Server Firebase configuration missing: FIREBASE_PROJECT_ID. Configure the server and redeploy.");
  if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== projectId) throw new FirebaseConfigurationError("Firebase Web and Admin project IDs must match. Correct the environment variables and rebuild/redeploy.");
  const emulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST);
  if (emulator) {
    if (!projectId.startsWith("demo-") || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
      throw new FirebaseConfigurationError("Emulator mode requires a demo- project and both Auth and Firestore emulator hosts; production credentials are never used in emulator tests.");
    }
    return initializeApp({ projectId, storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET }, "scanly-server");
  }
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (Boolean(clientEmail) !== Boolean(privateKey)) {
    throw new FirebaseConfigurationError("Server Firebase configuration missing: set both FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or use Application Default Credentials.");
  }
  if (clientEmail && privateKey) {
    if (!clientEmail.endsWith(".iam.gserviceaccount.com") || !privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
      throw new FirebaseConfigurationError("Invalid Firebase Admin credentials. Use the client_email and PEM private_key from a newly issued service account, not a personal email or a JSON object in FIREBASE_PRIVATE_KEY.");
    }
    try {
      return initializeApp({ projectId, credential: cert({ projectId, clientEmail, privateKey }), storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET }, "scanly-server");
    } catch { throw new FirebaseConfigurationError("Invalid Firebase Admin private key. Use the newly rotated service account PEM private_key and redeploy; never paste the full JSON into FIREBASE_PRIVATE_KEY."); }
  }
  if (process.env.FIREBASE_USE_APPLICATION_DEFAULT_CREDENTIALS === "true") {
    return initializeApp({ projectId, credential: applicationDefault(), storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET }, "scanly-server");
  }
  throw new FirebaseConfigurationError("Server Firebase configuration missing: FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY (or Application Default Credentials). Configure secure server variables and redeploy.");
}

export function getAdminAuth() { return getAuth(getFirebaseAdminApp()); }
export function getAdminDb() { return getFirestore(getFirebaseAdminApp()); }
export function getAdminStorage() { return getStorage(getFirebaseAdminApp()); }
