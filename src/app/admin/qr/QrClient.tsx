"use client";

import { businessFontStack } from "@/lib/typography";
import React, { useEffect, useRef, useState } from "react";
import { Card, CardHeader, Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import {
  QrCode as QrIcon,
  Download,
  Copy,
  ExternalLink,
  Palette,
  CheckCircle2,
} from "lucide-react";
import QRCode from "qrcode";
import type { Business } from "@/lib/data/types";
import { PRINTABLE_THEMES, getPrintableTheme } from "@/lib/printable-themes";
import jsPDF from "jspdf";

export function QrClient({ business, publicUrl }: { business: Business; publicUrl: string }) {
  const [theme, setTheme] = useState<string>("classic");
  const [size, setSize] = useState<number>(512);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const printableRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    QRCode.toCanvas(canvasRef.current, publicUrl, {
      width: size,
      margin: 4,
      errorCorrectionLevel: "H",
      color: { dark: "#0f172a", light: "#ffffff" },
    }).catch(() => toast.error("QR generation failed"));
  }, [publicUrl, size]);

  async function downloadPng() {
    if (!canvasRef.current) return;
    const a = document.createElement("a");
    a.href = canvasRef.current.toDataURL("image/png");
    a.download = `${business.slug}-qr.png`;
    a.click();
  }

  async function downloadSvg() {
    const svg = await QRCode.toString(publicUrl, {
      type: "svg",
      margin: 4,
      errorCorrectionLevel: "H",
      color: { dark: "#0f172a", light: "#ffffff" },
    });
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${business.slug}-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyLink() {
    if (!navigator.clipboard?.writeText) { toast.error("Clipboard unavailable. Select the public URL and copy it manually."); return; }
    navigator.clipboard.writeText(publicUrl).then(
      () => toast.success("Public URL copied"),
      () => toast.error("Clipboard permission denied. Select the public URL and copy it manually.")
    );
  }

  async function downloadPrintablePng() {
    if (!printableRef.current) return;
    await document.fonts.ready;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(printableRef.current, {
      backgroundColor: getPrintableTheme(theme).bg,
      scale: 2,
      useCORS: true,
    });
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${business.slug}-printable.png`;
    a.click();
  }

  async function downloadPrintablePdf() {
    if (!printableRef.current) return;
    await document.fonts.ready;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(printableRef.current, {
      backgroundColor: getPrintableTheme(theme).bg,
      scale: 2,
      useCORS: true,
    });
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a5",
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(img, "PNG", 0, 0, pageWidth, pageHeight);
    pdf.save(`${business.slug}-printable.pdf`);
  }

  async function downloadPrintableSvg() {
    if (!printableRef.current) return;
    await document.fonts.ready;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(printableRef.current, {
      backgroundColor: getPrintableTheme(theme).bg,
      scale: 2,
      useCORS: true,
    });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><image width="${canvas.width}" height="${canvas.height}" href="${canvas.toDataURL("image/png")}"/></svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${business.slug}-printable.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Saved SVG with an embedded high-resolution card image");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-950">QR Codes</h1>
        <p className="mt-1 text-sm text-slate-500">
          Download a high-resolution QR for print or share the public link. Your QR always points to{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5">{publicUrl}</code>.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        {/* QR preview */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">{business.businessName}</p>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900">
              <ExternalLink className="h-3 w-3" />
              Preview
            </a>
          </div>
          <div className="mt-4 grid place-items-center rounded-2xl border border-slate-200 bg-white p-4">
            <canvas ref={canvasRef} className="h-72 w-72" />
          </div>

          <Field label="Resolution (for download)">
            <select
              value={size}
              onChange={(e) => setSize(parseInt(e.target.value, 10))}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
            >
              {[512, 1024, 2048, 4096].map((s) => (
                <option key={s} value={s}>{s}px ({(s / 96).toFixed(1)}&quot; @ 96dpi)</option>
              ))}
            </select>
          </Field>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button onClick={downloadPng} leftIcon={<Download className="h-4 w-4" />}>PNG</Button>
            <Button variant="secondary" onClick={downloadSvg} leftIcon={<Download className="h-4 w-4" />}>SVG</Button>
            <Button variant="secondary" onClick={copyLink} className="col-span-2" leftIcon={<Copy className="h-4 w-4" />}>Copy link</Button>
          </div>
        </Card>

        {/* Printable card designer */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Printable QR Card"
              subtitle="Choose a layout, preview and download"
              action={
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Palette className="h-3 w-3" />
                  Theme
                </div>
              }
            />
            <div className="p-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PRINTABLE_THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`relative rounded-xl border-2 p-2 text-left transition ${
                      theme === t.id ? "border-slate-950" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div
                      className="aspect-[3/4] rounded-lg"
                      style={{ background: t.bg }}
                    />
                    <p className="mt-2 text-xs font-medium">{t.name}</p>
                    {theme === t.id ? (
                      <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-slate-950" />
                    ) : null}
                  </button>
                ))}
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <PrintableCard ref={printableRef} business={business} publicUrl={publicUrl} themeId={theme} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Button onClick={downloadPrintablePng} leftIcon={<Download className="h-4 w-4" />}>PNG</Button>
                <Button variant="secondary" onClick={downloadPrintablePdf} leftIcon={<Download className="h-4 w-4" />}>PDF</Button>
                <Button variant="secondary" onClick={downloadPrintableSvg} leftIcon={<Download className="h-4 w-4" />}>SVG</Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// =============================================================
// Printable card component (also rendered as DOM for html2canvas)
// =============================================================
type CardProps = { business: Business; publicUrl: string; themeId: string };

const PrintableCard = React.forwardRef<HTMLDivElement, CardProps>(
  function PrintableCard(
    { business, publicUrl, themeId }: CardProps,
    ref: React.Ref<HTMLDivElement>
  ) {
    const theme = getPrintableTheme(themeId);
    const [qrDataUrl, setQrDataUrl] = useState<string>("");

    useEffect(() => {
      QRCode.toDataURL(publicUrl, {
        width: 600,
        margin: 4,
        errorCorrectionLevel: "H",
        color: { dark: "#000", light: "#ffffff" },
      }).then(setQrDataUrl).catch(() => {});
    }, [publicUrl]);

    return (
      <div
        ref={ref}
        className="relative mx-auto"
        style={{
          background: theme.bg,
          color: theme.text,
          width: 420,
          height: 560,
          padding: 28,
          fontFamily: businessFontStack(business.font),
        }}
      >
        {/* Decorative corner illustration */}
        <CornerIllustration theme={theme} />

        <div className="relative flex h-full flex-col items-center text-center">
          {/* Logo or first letter */}
          {business.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.logo}
              alt={business.businessName}
              style={{
                height: 60,
                width: 60,
                objectFit: "cover",
                borderRadius: 14,
                marginBottom: 16,
              }}
            />
          ) : (
            <div
              style={{
                height: 60,
                width: 60,
                borderRadius: 14,
                background: theme.accent,
                color: theme.bg,
                display: "grid",
                placeItems: "center",
                fontSize: 24,
                fontWeight: 800,
                marginBottom: 16,
              }}
            >
              {business.businessName[0]?.toUpperCase()}
            </div>
          )}

          <p
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: theme.primary,
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            {business.businessName}
          </p>
          {business.tagline ? (
            <p style={{ fontSize: 12, color: theme.secondary, marginTop: 4 }}>{business.tagline}</p>
          ) : null}

          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: theme.primary, margin: 0 }}>
              Share Your Experience
            </p>
            <p style={{ fontSize: 11, color: theme.text, margin: "4px 0 0" }}>
              Help us grow with your valuable review
            </p>
            <div style={{ marginTop: 6, color: theme.accent, fontSize: 14 }}>
              ★★★★★
            </div>
          </div>

          {/* QR */}
          <div
            style={{
              marginTop: 18,
              padding: 10,
              borderRadius: 12,
              background: "#ffffff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt="QR code"
                style={{ width: 200, height: 200, display: "block" }}
              />
            ) : (
              <div style={{ width: 200, height: 200 }} />
            )}
          </div>

          <p
            style={{
              marginTop: 12,
              padding: "6px 14px",
              borderRadius: 999,
              fontSize: 11,
              letterSpacing: 2,
              fontWeight: 700,
              background: theme.primary,
              color: theme.bg,
            }}
          >
            SCAN & SHARE
          </p>

          <div style={{ marginTop: "auto", display: "flex", gap: 12, color: theme.secondary, fontSize: 11 }}>
            {business.googleReviewUrl ? <span>★ Review</span> : null}
            {business.menuEnabled ? <span>☕ Menu</span> : null}
            {business.wifiEnabled ? <span>📶 Wi-Fi</span> : null}
            {business.instagramUrl ? <span>◎ Instagram</span> : null}
          </div>
        </div>
      </div>
    );
  }
);

// forwardRef wrapper is no longer needed; component uses React.forwardRef directly.

function CornerIllustration({ theme }: { theme: ReturnType<typeof getPrintableTheme> }) {
  const color = theme.accent;
  if (theme.illustration === "leaf") {
    return (
      <svg
        viewBox="0 0 200 200"
        className="absolute -top-8 -left-8 h-32 w-32 opacity-50"
      >
        <path
          d="M10 90 C 50 30, 110 20, 180 50 C 160 110, 100 160, 30 160 Z"
          fill="none"
          stroke={color}
          strokeWidth="2"
        />
        <path d="M30 160 L 90 90" stroke={color} strokeWidth="2" />
      </svg>
    );
  }
  if (theme.illustration === "coffee") {
    return (
      <svg
        viewBox="0 0 200 200"
        className="absolute -top-6 -right-6 h-28 w-28 opacity-60"
      >
        <path
          d="M40 70 H130 a20 20 0 0 1 0 40 H40 Z"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
        />
        <path d="M150 80 q20 10 0 30" fill="none" stroke={color} strokeWidth="2.5" />
        <path d="M70 50 q-5 -10 0 -20" fill="none" stroke={color} strokeWidth="2" />
        <path d="M95 50 q-5 -10 0 -20" fill="none" stroke={color} strokeWidth="2" />
        <path d="M120 50 q-5 -10 0 -20" fill="none" stroke={color} strokeWidth="2" />
      </svg>
    );
  }
  return null;
}