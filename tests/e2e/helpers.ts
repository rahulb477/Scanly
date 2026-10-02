import { expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";

export const password = "Secure123!";
export async function createFixture(suffix: string) {
  if (process.env.FIREBASE_PROJECT_ID !== "demo-scanly" || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error("Only demo Firebase emulator fixtures are allowed.");
  const email = `browser-${suffix}@example.test`;
  const auth = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-emulator-only-key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const identity = await auth.json();
  if (!auth.ok) throw new Error(`Auth emulator fixture failed: ${identity.error?.message}`);
  const headers = { Authorization: `Bearer ${identity.idToken}`, "Content-Type": "application/json", Origin: "http://127.0.0.1:3001" };
  const response = await fetch("http://127.0.0.1:3001/api/businesses", { method: "POST", headers, body: JSON.stringify({ businessName: `Browser Cafe ${suffix}`, category: "Café & Bakery" }) });
  const result = await response.json();
  if (!response.ok) throw new Error(`Business fixture failed: ${result.error}`);
  return { email, uid: identity.localId as string, token: identity.idToken as string, business: result.business as { id: string; slug: string; businessName: string }, headers };
}
export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
export function smallPng() {
  const png = new PNG({ width: 20, height: 20 }); png.data.fill(180);
  return PNG.sync.write(png);
}


export function browserErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  return errors;
}
