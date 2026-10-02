"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";
import { firebaseClientConfig, FirebaseConfigurationError, missingFirebaseConfig } from "./config";

type Client = { app: FirebaseApp; auth: Auth; db: Firestore };
let client: Client | undefined;
let storage: FirebaseStorage | undefined;
let diagnosed = false;

export function getFirebaseClient(): Client {
  if (client) return client;
  const config = firebaseClientConfig();
  const missing = missingFirebaseConfig(config);
  if (missing.length) {
    if (process.env.NODE_ENV === "development" && !diagnosed) {
      diagnosed = true;
      console.error(`[Scanly Firebase] Missing configuration: ${missing.join(", ")}. Add these to .env.local (or Vercel), then restart/rebuild. No credential values are logged.`);
    }
    throw new FirebaseConfigurationError("Firebase configuration missing. Ask the site administrator to configure Firebase and redeploy.");
  }
  const app = getApps().find((entry) => entry.name === "[DEFAULT]") ?? initializeApp(config);
  const auth = getAuth(app);
  let db: Firestore;
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
    if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.startsWith("demo-") !== true) {
      throw new FirebaseConfigurationError("Firebase emulators require an isolated demo- project; never enable them for a live Firebase project.");
    }
    if (typeof window === "undefined") throw new FirebaseConfigurationError("Initialize the Firebase Web SDK in the browser.");
    // Same-origin proxy: the browser never calls a sandbox/backend loopback address.
    connectAuthEmulator(auth, window.location.origin, { disableWarnings: true });
    db = initializeFirestore(app, {
      host: window.location.host,
      ssl: window.location.protocol === "https:",
      experimentalForceLongPolling: true,
    });
  } else {
    db = getFirestore(app);
  }
  client = { app, auth, db };
  if (process.env.NODE_ENV === "development" && !diagnosed) {
    diagnosed = true;
    console.info("[Scanly Firebase] Health check: configuration loaded, Auth initialized, Firestore initialized. This checks initialization, not remote connectivity or deployed rules.");
  }
  return client;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (storage) return storage;
  const { app } = getFirebaseClient();
  storage = getStorage(app);
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
    if (window.location.protocol !== "http:") {
      storage = undefined;
      throw new FirebaseConfigurationError("Storage emulator uploads require the local HTTP development URL. Production Storage uses HTTPS; never enable emulators on Vercel.");
    }
    connectStorageEmulator(storage, window.location.hostname, Number(window.location.port || 80));
  }
  return storage;
}
