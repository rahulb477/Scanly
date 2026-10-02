import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
import { firebaseTestEnv } from "./scripts/firebase-test-env.mjs";

const missingConfig = Object.fromEntries(Object.keys(firebaseTestEnv).filter((key) => key.startsWith("NEXT_PUBLIC_FIREBASE_") || key.startsWith("FIREBASE_") || key === "FIRESTORE_EMULATOR_HOST").map((key) => [key, ""]));
// Separate invocation: do not run two full Next compilers beside Java/Chromium in CI.
export default defineConfig(base, {
  testMatch: "missing-config.spec.ts",
  webServer: { command: "npm run dev -- --webpack --port 3002", url: "http://127.0.0.1:3002/login", env: { ...firebaseTestEnv, ...missingConfig, NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "false", NEXT_DIST_DIR: ".next-config-failure" }, reuseExistingServer: false, timeout: 120_000 },
});
