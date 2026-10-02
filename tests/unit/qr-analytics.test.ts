import { describe, expect, it, vi } from "vitest";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { buildWifiQrString, publicBusinessUrl, slugify } from "@/lib/utils";
import { analyticsStartDate, dashboardSummary } from "@/lib/data/analytics-summary";
import { normalizedRange } from "@/lib/data/repository";
import type { AnalyticsEvent } from "@/lib/data/types";

describe("permanent QR URLs and actual analytics", () => {
  it("derives local/preview URLs from an origin, never a baked-in localhost fallback", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", ""); vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", ""); vi.stubEnv("VERCEL_URL", "");
    expect(publicBusinessUrl("coffee", "https://preview.example.test")).toBe("https://preview.example.test/b/coffee");
    expect(() => publicBusinessUrl("coffee")).toThrow("Application URL missing");
  });
  it("uses the configured HTTPS production origin and rejects invalid configuration", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://my-business.example.test");
    expect(publicBusinessUrl("coffee", "http://preview.example.test")).toBe("https://my-business.example.test/b/coffee");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://my-business.example.test"); expect(() => publicBusinessUrl("coffee")).toThrow("HTTPS");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://my-business.example.test/path"); expect(() => publicBusinessUrl("coffee")).toThrow("origin");
  });
  it("preserves legacy underscore slugs and allows local demo HTTP only", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3001");
    vi.stubEnv("NEXT_PUBLIC_USE_FIREBASE_EMULATORS", "true"); vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "demo-scanly");
    expect(publicBusinessUrl("legacy_cafe-a_b")).toBe("http://127.0.0.1:3001/b/legacy_cafe-a_b");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "real-project"); expect(() => publicBusinessUrl("coffee")).toThrow("HTTPS");
  });
  it("generates and actually decodes a QR to /b/slug, never a Google Review URL", async () => {
    const target = "https://business.example.test/b/coffee";
    const png = PNG.sync.read(await QRCode.toBuffer(target, { width: 512, margin: 4, errorCorrectionLevel: "H" }));
    expect(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data).toBe(target);
  });
  it("escapes Wi-Fi payload delimiters and omits passwords for open networks", async () => {
    const target = buildWifiQrString("Guest;Network", "password:with,delimiters", "WPA");
    expect(target).toContain("S:Guest\\;Network");
    expect(target).toContain("P:password\\:with\\,delimiters");
    const png = PNG.sync.read(await QRCode.toBuffer(target, { width: 512, margin: 4 }));
    expect(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data).toBe(target);
    expect(buildWifiQrString("Guest", "must-not-share", "Open")).toBe("WIFI:T:nopass;S:Guest;;");
  });
  it("normalizes ranges and counts each actual event without fabricated deltas", () => {
    const now = Date.UTC(2026, 9, 2, 12);
    const events = ["qr_scan", "qr_scan", "menu_view", "review_generated"].map((type, index) => ({ id: String(index), businessId: "b", type, createdAt: new Date(now), updatedAt: new Date(now), metadata: null, sessionId: null })) satisfies AnalyticsEvent[];
    const result = dashboardSummary(events, "7", now);
    expect(result.stats.qr_scan).toBe(2);
    expect(result.stats.wifi_view).toBe(0);
    expect(result.chartData.at(-1)).toEqual({ date: "10-02", Scans: 2, Clicks: 2 });
    expect(normalizedRange("invalid")).toBe("7");
    expect(slugify("Owner's New Café!")).toBe("owners-new-caf");
  });
  it("aligns Today/7-day queries with the same UTC calendar buckets shown in charts", () => {
    const now = Date.UTC(2026, 9, 2, 12);
    expect(analyticsStartDate("1", now)).toEqual(new Date("2026-10-02T00:00:00.000Z"));
    expect(analyticsStartDate("7", now)).toEqual(new Date("2026-09-26T00:00:00.000Z"));
    expect(analyticsStartDate("all", now)).toEqual(new Date(0));
  });
});
