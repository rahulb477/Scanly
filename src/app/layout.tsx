import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Scanly — QR Customer Engagement SaaS",
  description:
    "Collect genuine customer feedback, generate AI-assisted review drafts, share digital menus, Wi-Fi and social links through a single QR code.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}