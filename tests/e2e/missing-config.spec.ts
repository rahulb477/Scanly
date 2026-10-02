import { test, expect } from "@playwright/test";

test("missing client/server configuration yields actionable errors, not HTML/Network error", async ({ page, request }) => {
  const diagnostics: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") diagnostics.push(message.text()); });
  await page.goto("http://127.0.0.1:3002/login");
  await expect(page.locator('main p[role="alert"]')).toContainText("Firebase configuration missing");
  expect(diagnostics.some((message) => message.includes("NEXT_PUBLIC_FIREBASE_API_KEY"))).toBe(true);
  const response = await request.get("http://127.0.0.1:3002/api/health");
  expect(response.status()).toBe(503);
  expect(response.headers()["content-type"]).toContain("application/json");
  expect((await response.json()).error).toContain("Server Firebase configuration missing");
});
