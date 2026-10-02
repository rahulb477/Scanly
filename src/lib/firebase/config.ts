import type { FirebaseOptions } from "firebase/app";

export const FIREBASE_CONFIG_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

// Explicit references are required for Next.js to inline public build-time variables.
export function firebaseClientConfig(): FirebaseOptions {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function missingFirebaseConfig(config: FirebaseOptions): string[] {
  const values = [config.apiKey, config.authDomain, config.projectId, config.storageBucket, config.messagingSenderId, config.appId];
  return FIREBASE_CONFIG_KEYS.filter((_, index) => !values[index]?.trim());
}

export class FirebaseConfigurationError extends Error {
  readonly code = "firebase/configuration-missing";
  constructor(message: string) {
    super(message);
    this.name = "FirebaseConfigurationError";
  }
}
