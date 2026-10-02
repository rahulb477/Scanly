import { defineConfig } from "@playwright/test";
import { firebaseTestEnv } from "./scripts/firebase-test-env.mjs";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "flows.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 25_000 },
  use: {
    baseURL: "http://127.0.0.1:3001",
    headless: true,
    actionTimeout: 20_000,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ["--no-sandbox", "--disable-dev-shm-usage"] } : {},
  },
  reporter: "list",
  webServer: [
    { command: "npm run start -- --port 3001", url: "http://127.0.0.1:3001/login", env: { ...firebaseTestEnv, NEXT_DIST_DIR: ".next-e2e" }, reuseExistingServer: false, timeout: 120_000 },
  ],
});
