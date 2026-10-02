import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";
import { apiErrorResponse, jsonBody } from "@/lib/api";

// POST prevents Wi-Fi passwords from appearing in URLs, browser history and logs.
export async function POST(request: NextRequest) {
  try {
    const { data } = z.strictObject({ data: z.string().min(1).max(2000).startsWith("WIFI:") }).parse(await jsonBody(request));
    const svg = await QRCode.toString(data, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } });
    return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow" } });
  } catch (error) { return apiErrorResponse(error); }
}
