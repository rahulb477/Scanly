import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(req: NextRequest) {
  const d = req.nextUrl.searchParams.get("d");
  if (!d || d.length > 500) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  try {
    const svg = await QRCode.toString(d, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "H",
      color: { dark: "#0f172a", light: "#ffffff" },
    });
    return new NextResponse(svg, {
      headers: {
        "content-type": "image/svg+xml",
        "cache-control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}