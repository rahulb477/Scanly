import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/lora";
import "@fontsource/dm-serif-display/400.css";
import { Toaster } from "@/components/ui/Toast";
import { AuthProvider } from "@/components/auth/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scanly — QR Customer Engagement SaaS",
  description:
    "Collect genuine customer feedback, generate AI-assisted review drafts, share digital menus, Wi-Fi and social links through a single QR code.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased"><AuthProvider><Toaster />{children}</AuthProvider></body>
    </html>
  );
}