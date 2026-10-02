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

export function publicBusinessUrl(slug: string) {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof process.env.VERCEL_URL === "string"
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  ).replace(/\/$/, "");
  return `${base}/b/${slug}`;
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
