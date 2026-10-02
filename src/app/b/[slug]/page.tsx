import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { businesses, menuCategories, menuItems } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getTheme } from "@/lib/themes";
import { BusinessLanding } from "./BusinessLanding";
import { nanoid } from "nanoid";
import { analyticsEvents } from "@/db/schema";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function PublicBusinessPage({ params }: Props) {
  const { slug } = await params;

  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.slug, slug))
    .limit(1);

  if (!business) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center">
        <div className="max-w-md">
          <p className="text-sm uppercase tracking-wider text-slate-500">404</p>
          <h1 className="mt-2 text-3xl font-extrabold text-slate-950">Business not found</h1>
          <p className="mt-2 text-slate-600">
            The QR code you scanned doesn't match any active business. Please ask the
            business owner to verify their setup.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex h-10 items-center rounded-lg bg-slate-950 px-5 text-sm font-medium text-white hover:bg-slate-900"
          >
            Back home
          </Link>
        </div>
      </main>
    );
  }

  // Track QR scan anonymously
  try {
    const h = await headers();
    const sessionId =
      h.get("x-session-id") ||
      // fallback cookie
      null;
    await db.insert(analyticsEvents).values({
      id: nanoid(),
      businessId: business.id,
      type: "qr_scan",
      sessionId,
      metadata: { ua: h.get("user-agent") || null, referer: h.get("referer") || null },
    });
  } catch (err) {
    console.error("track qr_scan failed", err);
  }

  const categories = await db
    .select()
    .from(menuCategories)
    .where(
      and(
        eq(menuCategories.businessId, business.id)
      )
    )
    .orderBy(asc(menuCategories.sortOrder));

  const items = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.businessId, business.id))
    .orderBy(asc(menuItems.sortOrder));

  return (
    <BusinessLanding
      business={{
        ...business,
        // strip sensitive wifi password from payload sent to client
        wifiPassword: business.wifiEnabled ? business.wifiPassword : null,
      }}
      categories={categories}
      items={items}
      theme={getTheme(business.theme)}
    />
  );
}