import { test, expect } from "@playwright/test";
import { browserErrors, createFixture, login, password, smallPng } from "./helpers";
import jsQR from "jsqr";
import { PNG } from "pngjs";

const suffix = `${Date.now()}`;
let fixture: Awaited<ReturnType<typeof createFixture>>;
test.beforeAll(async () => { fixture = await createFixture(suffix); });

test("signup validates confirmation, saves a Firebase profile, onboards and logs out", async ({ page, context }) => {
  test.setTimeout(180_000);
  const errors = browserErrors(page);
  const email = `signup-${suffix}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Name", { exact: true }).fill("Browser Signup Owner");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill("different-password");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.locator('main p[role="alert"]')).toContainText("Passwords do not match");
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Welcome to Scanly" })).toBeVisible();
  await expect(page.getByText("Browser Signup Owner", { exact: true })).toBeVisible();
  const cookies = await context.cookies();
  expect(cookies.find((cookie) => cookie.name === "scanly_firebase_session")?.httpOnly).toBe(true);
  await page.getByRole("button", { name: "Create your first business" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").nth(0).fill(`New Business ${suffix}`);
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/onboarding\?businessId=/);
  await expect(page.getByRole("heading", { name: "Get your QR live in minutes" })).toBeVisible();
  for (let step = 1; step <= 11; step++) {
    await expect(page.getByText(`Step ${step} of 11`, { exact: true })).toBeVisible();
    const main = page.getByRole("main");
    if (step === 3) await main.getByRole("combobox").selectOption("Restaurant");
    if (step === 5) await main.getByRole("textbox").fill("https://search.google.com/local/writereview?placeid=ONBOARDING");
    if (step === 6) await main.getByRole("textbox").fill("https://maps.google.com/?q=Browser");
    await page.getByRole("button", { name: step === 11 ? "Finish setup" : "Save & continue", exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "All set!", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Go to QR Codes", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/qr\?businessId=/);
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await context.cookies()).find((cookie) => cookie.name === "scanly_firebase_session")).toBeUndefined();
  await page.goto("/dashboard"); await expect(page).toHaveURL(/\/login$/);
  expect(errors).toEqual([]);
});

test("invalid credentials and duplicate email have specific messages", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(fixture.email);
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator('main p[role="alert"]')).toContainText("Invalid email or password");
  await page.goto("/register");
  await page.getByLabel("Name", { exact: true }).fill("Duplicate");
  await page.getByLabel("Email", { exact: true }).fill(fixture.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.locator('main p[role="alert"]')).toContainText("An account with this email already exists");
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toHaveCount(0);
});

test("forgot password issues a real Firebase reset action", async ({ page }) => {
  await page.goto("/login"); await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(fixture.email);
  await page.getByRole("button", { name: "Send reset email" }).click();
  await expect(page.locator('main p[role="status"]')).toContainText("Password reset email sent");
  const actions = await (await fetch("http://127.0.0.1:9099/emulator/v1/projects/demo-scanly/oobCodes")).json();
  expect(actions.oobCodes.some((action: { email: string; requestType: string }) => action.email === fixture.email && action.requestType === "PASSWORD_RESET")).toBe(true);
});

test("a genuine transport failure is not mistaken for bad credentials", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(fixture.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.route("**/identitytoolkit.googleapis.com/**", (route) => route.abort("internetdisconnected"));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator('main p[role="alert"]')).toContainText("Unable to connect to Firebase");
});

test("every protected dashboard page and legacy admin alias handles auth correctly", async ({ page }) => {
  test.setTimeout(180_000); // Includes cold compilation of eleven retained feature routes.
  await page.goto("/dashboard/profile"); await expect(page).toHaveURL(/\/login$/);
  await login(page, fixture.email);
  const errors = browserErrors(page);
  const features = ["", "profile", "qr", "ai", "menu", "social", "wifi", "google", "appearance", "analytics", "settings"];
  for (const feature of features) {
    await page.goto(`/dashboard${feature ? `/${feature}` : ""}?businessId=${fixture.business.id}`);
    await expect(page.getByRole("button", { name: "Logout", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Unable to load this page" })).toHaveCount(0);
  }
  await page.goto(`/admin/profile?businessId=${fixture.business.id}`);
  await expect(page.getByRole("heading", { name: "Business Profile", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("business profile saves and actual Firebase Storage upload shows progress", async ({ page }) => {
  await login(page, fixture.email);
  await page.goto(`/dashboard/profile?businessId=${fixture.business.id}`);
  await page.route("**/v0/b/**", async (route) => { await new Promise((resolve) => setTimeout(resolve, 250)); await route.continue(); });
  await page.locator('input[type="file"]').first().setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: smallPng() });
  await expect(page.getByText(/Uploading image:/)).toBeVisible();
  await expect(page.getByText("Image uploaded. Save your profile to apply it.")).toBeVisible();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved", { exact: true })).toBeVisible();
  const response = await fetch(`http://127.0.0.1:3001/api/businesses/${fixture.business.id}`, { headers: fixture.headers });
  const data = await response.json(); expect(data.business.logo).toContain("/v0/b/");
  await page.goto(`/b/${fixture.business.slug}`);
  await expect(page.getByRole("img", { name: fixture.business.businessName, exact: true })).toBeVisible();
});

test("menu category/item forms persist edits, availability and category cascade deletion", async ({ page }) => {
  await login(page, fixture.email);
  await page.goto(`/dashboard/menu?businessId=${fixture.business.id}`);
  await page.getByRole("button", { name: "Add category", exact: true }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("Browser Desserts");
  await dialog.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Browser Desserts", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").nth(0).fill("Chocolate Cake");
  await dialog.getByRole("textbox").nth(1).fill("4.50");
  await dialog.getByRole("textbox").nth(2).fill("Freshly baked");
  await dialog.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(page.getByText("Chocolate Cake", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("dialog").getByRole("textbox").nth(1).fill("5.50");
  await page.getByRole("dialog").getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("5.50", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Toggle availability", exact: true }).click();
  await expect(page.getByRole("button", { name: "Toggle availability", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => (await (await fetch(`http://127.0.0.1:3001/api/menu/public?businessId=${fixture.business.id}`)).json()).items.length).toBe(0);
  await page.getByRole("button", { name: "Toggle availability", exact: true }).click();
  await expect.poll(async () => (await (await fetch(`http://127.0.0.1:3001/api/menu/public?businessId=${fixture.business.id}`)).json()).items.length).toBe(1);
  page.once("dialog", (prompt) => prompt.accept());
  await page.getByRole("button", { name: "Delete category", exact: true }).click();
  await expect(page.getByText("Chocolate Cake", { exact: true })).toHaveCount(0);
  expect((await (await fetch(`http://127.0.0.1:3001/api/menu/public?businessId=${fixture.business.id}`)).json()).items).toEqual([]);
});

test("appearance form applies real self-hosted fonts, card shapes and CTA styles publicly", async ({ page }) => {
  const errors = browserErrors(page);
  await login(page, fixture.email);
  await page.goto(`/dashboard/appearance?businessId=${fixture.business.id}`);
  const selects = page.getByRole("main").getByRole("combobox");
  await selects.nth(0).selectOption("Lora");
  await selects.nth(1).selectOption("square");
  await selects.nth(2).selectOption("outline");
  await page.getByRole("button", { name: "Save theme", exact: true }).click();
  await expect(page.getByText("Theme saved", { exact: true })).toBeVisible();
  await page.goto(`/b/${fixture.business.slug}`);
  const customer = page.locator(".scanly-public");
  await expect(customer).toHaveCSS("font-family", /Lora Variable/);
  await expect(customer).toHaveAttribute("data-card-style", "square");
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => [...document.fonts].some((font) => font.family.replaceAll('"', '').replaceAll("'", "") === "Lora Variable" && font.status === "loaded"))).toBe(true);
  await page.getByRole("button", { name: "AI Review Assistant", exact: true }).click();
  await page.getByRole("button", { name: "Amazing", exact: true }).click();
  await page.getByRole("button", { name: "Excellent", exact: true }).click();
  await page.getByRole("button", { name: "Good", exact: true }).click();
  const next = page.getByRole("button", { name: "Continue", exact: true });
  await expect(next).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  expect(errors).toEqual([]);
});

test("QR canvas decodes to the customer page and stays stable after destination edits", async ({ page }) => {
  await login(page, fixture.email);
  await page.goto(`/dashboard/qr?businessId=${fixture.business.id}`);
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect.poll(async () => page.locator("canvas").first().evaluate((node) => (node as HTMLCanvasElement).width)).toBe(512);
  const source = await page.locator("canvas").first().evaluate((node) => (node as HTMLCanvasElement).toDataURL("image/png"));
  const png = PNG.sync.read(Buffer.from(source.split(",")[1], "base64"));
  const scanned = jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data;
  expect(scanned).toBe(`http://127.0.0.1:3001/b/${fixture.business.slug}`);
  // Exercise all five real download buttons, not only in-memory canvas generation.
  const { readFile } = await import("node:fs/promises");
  for (const [name, index, extension] of [["PNG", 0, "png"], ["SVG", 0, "svg"], ["PNG", 1, "png"], ["PDF", 0, "pdf"], ["SVG", 1, "svg"]] as const) {
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).nth(index).click();
    const download = await pending;
    expect(download.suggestedFilename()).toMatch(new RegExp(`\\.${extension}$`));
    const bytes = await readFile((await download.path())!);
    if (extension === "png") expect(PNG.sync.read(bytes).width).toBeGreaterThan(200);
    if (extension === "svg") expect(bytes.toString()).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    if (extension === "pdf") expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  }
  await fetch(`http://127.0.0.1:3001/api/businesses/${fixture.business.id}`, { method: "PATCH", headers: fixture.headers, body: JSON.stringify({ googleReviewUrl: "https://search.google.com/local/writereview?placeid=UPDATED" }) });
  await page.goto(scanned!);
  await expect(page.getByRole("heading", { name: fixture.business.businessName, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Leave a Google Review" })).toHaveAttribute("href", "https://search.google.com/local/writereview?placeid=UPDATED");
});

test("anonymous mobile customers can use menu, Wi-Fi QR, social, review, directions and analytics", async ({ page, context }) => {
  const headers = fixture.headers;
  await fetch(`http://127.0.0.1:3001/api/businesses/${fixture.business.id}`, { method: "PATCH", headers, body: JSON.stringify({ googleReviewUrl: "https://search.google.com/local/writereview?placeid=UPDATED", wifiEnabled: true, wifiPublicSharingEnabled: true, wifiName: "Browser Guest", wifiPassword: "Browser-Guest-Secret", instagramUrl: "https://instagram.com/browser", facebookUrl: "https://facebook.com/browser", youtubeUrl: "https://youtube.com/@browser", websiteUrl: "https://business.example.test", googleMapsUrl: "https://maps.google.com/?q=browser" }) });
  const category = await (await fetch("http://127.0.0.1:3001/api/menu/categories", { method: "POST", headers, body: JSON.stringify({ businessId: fixture.business.id, name: "Coffee" }) })).json();
  await fetch("http://127.0.0.1:3001/api/menu/items", { method: "POST", headers, body: JSON.stringify({ businessId: fixture.business.id, categoryId: category.id, name: "Browser Espresso", price: "$4" }) });
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = browserErrors(page);
  await page.goto(`/b/${fixture.business.slug}`);
  expect((await context.cookies()).some((cookie) => cookie.name === "scanly_firebase_session")).toBe(false);
  for (const [name, href] of [["Instagram", "https://instagram.com/browser"], ["Facebook", "https://facebook.com/browser"], ["YouTube", "https://youtube.com/@browser"], ["Website", "https://business.example.test/"], ["Directions", "https://maps.google.com/?q=browser"]]) await expect(page.getByRole("link", { name: new RegExp(name) })).toHaveAttribute("href", href);
  await page.getByRole("button", { name: /Digital Menu/ }).click();
  await expect(page.getByText("Browser Espresso", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: /Connect to Wi-Fi/ }).click();
  const wifiImage = page.getByRole("img", { name: "Wi-Fi QR" }); await expect(wifiImage).toBeVisible();
  const wifiPng = PNG.sync.read(Buffer.from((await wifiImage.getAttribute("src"))!.split(",")[1], "base64"));
  expect(jsQR(new Uint8ClampedArray(wifiPng.data), wifiPng.width, wifiPng.height)?.data).toContain("P:Browser-Guest-Secret");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "AI Review Assistant", exact: true }).click();
  await page.getByRole("button", { name: "Amazing", exact: true }).click();
  await page.getByRole("button", { name: "Excellent", exact: true }).click();
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.getByRole("button", { name: "Natural", exact: true }).click();
  await page.getByRole("button", { name: "Generate Review", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copy Review", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Google Reviews", exact: true })).toHaveAttribute("href", /placeid=UPDATED/);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy Review", exact: true }).click();
  await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toContain("experience");
  expect(errors).toEqual([]);
});
