import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function sanitizeText(input: string | null | undefined, max = 5000) {
  if (!input) return "";
  return String(input)
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .slice(0, max);
}

export function publicBusinessUrl(slug: string, requestOrigin?: string) {
  if (!/^[a-z0-9_-]{1,120}$/.test(slug)) throw new Error("Invalid business slug.");
  const candidate = process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined) ||
    requestOrigin || (typeof window !== "undefined" ? window.location.origin : undefined) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  if (!candidate) throw new Error("Application URL missing. Set NEXT_PUBLIC_APP_URL to your actual production origin.");
  const url = new URL(candidate);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_APP_URL must be an HTTP(S) origin without a path, credentials, query or fragment.");
  }
  // A production-mode emulator build is still isolated local testing, not a live
  // Firebase project. Never relax HTTPS for a real project or a non-loopback host.
  const localEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true" &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.startsWith("demo-") === true &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:" && !localEmulator) throw new Error("Production QR codes require an HTTPS application URL.");
  return `${url.origin}/b/${slug}`;
}

export function buildWifiQrString(name: string, password: string, security: string) {
  const escape = (v: string) =>
    v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/"/g, '\\"').replace(/:/g, "\\:");

  const sec = (security || "WPA").toUpperCase();
  if (sec === "OPEN" || !password) {
    return `WIFI:T:nopass;S:${escape(name)};;`;
  }
  return `WIFI:T:${sec};S:${escape(name)};P:${escape(password)};;`;
}

export function isValidUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
