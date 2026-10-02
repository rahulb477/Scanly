"use client";

import { useMemo, useState } from "react";
import {
  Star,
  ChevronRight,
  MapPin,
  Wifi,
  Instagram,
  Facebook,
  Youtube,
  Globe,
  MessageCircle,
  Phone,
  Mail,
  Sparkles,
  ChevronLeft,
  X,
  Copy,
  Check,
  ExternalLink,
  Coffee,
  Menu as MenuIcon,
  ArrowLeft,
} from "lucide-react";
import type { Business, MenuCategory, MenuItem } from "@/db/schema";
import type { ThemePreset } from "@/lib/themes";
import { Button } from "@/components/ui/Button";
import { Toaster, toast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { buildWifiQrString } from "@/lib/utils";

type Props = {
  business: Business;
  categories: MenuCategory[];
  items: MenuItem[];
  theme: ThemePreset;
};

function safeUrl(u: string | null | undefined) {
  if (!u) return null;
  if (u.startsWith("http")) return u;
  return `https://${u}`;
}

export function BusinessLanding({ business, categories, items, theme }: Props) {
  const [view, setView] = useState<"home" | "menu" | "review" | "wifi">("home");
  const [showShare, setShowShare] = useState(false);

  const primary = business.primaryColor || theme.primary;
  const secondary = business.secondaryColor || theme.secondary;
  const background = business.backgroundColor || theme.background;
  const text = "#1c1917";

  const menuByCategory = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const it of items) {
      if (!map.has(it.categoryId)) map.set(it.categoryId, []);
      map.get(it.categoryId)!.push(it);
    }
    return map;
  }, [items]);

  const visibleItems = useMemo(
    () => items.filter((i) => i.available !== false),
    [items]
  );

  const orderedCategories = categories
    .filter((c) => menuByCategory.get(c.id)?.some((i) => i.available !== false))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div
      className="min-h-screen"
      style={{
        background,
        color: text,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <Toaster />

      {/* Top hero */}
      <header
        className="px-5 pt-8 pb-6"
        style={{
          background: `linear-gradient(160deg, ${primary} 0%, ${shade(primary, -25)} 100%)`,
        }}
      >
        <div className="mx-auto flex max-w-md items-center gap-4">
          {business.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.logo}
              alt={business.businessName}
              className="h-14 w-14 rounded-2xl object-cover border border-white/30 shadow-md"
            />
          ) : (
            <div
              className="grid h-14 w-14 place-items-center rounded-2xl text-2xl shadow-md"
              style={{ background: secondary, color: primary }}
            >
              {(business.category?.[0] || business.businessName[0] || "•").toUpperCase()}
            </div>
          )}
          <div className="flex-1 text-white">
            <p className="text-xs uppercase tracking-[0.18em] opacity-80">
              {business.category || "Local business"}
            </p>
            <h1 className="text-xl font-bold leading-tight">{business.businessName}</h1>
            {business.city ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs opacity-80">
                <MapPin className="h-3 w-3" />
                {[business.city, business.state].filter(Boolean).join(", ")}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-4 max-w-md px-5 pb-32">
        {view === "home" ? (
          <HomeView
            business={business}
            theme={theme}
            primary={primary}
            secondary={secondary}
            onOpenMenu={() => setView("menu")}
            onOpenReview={() => setView("review")}
            onOpenWifi={() => setView("wifi")}
          />
        ) : null}

        {view === "menu" ? (
          <MenuView
            business={business}
            categories={orderedCategories}
            items={visibleItems}
            onBack={() => setView("home")}
          />
        ) : null}

        {view === "review" ? (
          <ReviewView business={business} onBack={() => setView("home")} />
        ) : null}

        {view === "wifi" ? (
          <WifiView business={business} onBack={() => setView("home")} />
        ) : null}
      </main>

      {/* Floating share button */}
      <button
        onClick={() => setShowShare(true)}
        className="fixed bottom-5 right-5 z-30 inline-flex h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white shadow-lg"
        style={{ background: primary }}
      >
        <MessageCircle className="h-4 w-4" />
        Share
      </button>

      <Modal open={showShare} onClose={() => setShowShare(false)} title="Share this page">
        <SharePanel business={business} />
      </Modal>
    </div>
  );
}

// =============================================================
function HomeView({
  business,
  theme,
  primary,
  secondary,
  onOpenMenu,
  onOpenReview,
  onOpenWifi,
}: {
  business: Business;
  theme: ThemePreset;
  primary: string;
  secondary: string;
  onOpenMenu: () => void;
  onOpenReview: () => void;
  onOpenWifi: () => void;
}) {
  const phone = business.phone;
  const email = business.email;
  const hasGoogle = !!business.googleReviewUrl;

  return (
    <>
      {/* Main CTA card */}
      <section
        className="rounded-3xl bg-white p-5 shadow-lg animate-slide-up"
        style={{ borderTop: `4px solid ${primary}` }}
      >
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
          {business.tagline || "Share Your Experience"}
        </p>
        <h2 className="mt-1 text-xl font-extrabold text-slate-950">
          Help us grow with your valuable review
        </h2>
        <div className="mt-2 flex items-center gap-1 text-amber-500">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="h-4 w-4 fill-current" />
          ))}
          <span className="ml-1 text-xs text-slate-500">
            Takes less than a minute
          </span>
        </div>

        <div className="mt-5 space-y-2">
          {hasGoogle ? (
            <a
              href={safeUrl(business.googleReviewUrl) || "#"}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track(business.id, "google_review_click")}
              className="flex w-full items-center justify-between rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-900"
            >
              <span className="flex items-center gap-3">
                <Star className="h-5 w-5" />
                Leave a Google Review
              </span>
              <ChevronRight className="h-4 w-4" />
            </a>
          ) : null}

          {business.aiReviewEnabled ? (
            <button
              onClick={onOpenReview}
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold text-white"
              style={{ background: primary }}
            >
              <span className="flex items-center gap-3">
                <Sparkles className="h-5 w-5" />
                AI Review Assistant
              </span>
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </section>

      {/* Utility cards */}
      <h3 className="mt-7 mb-2 text-sm font-semibold text-slate-700">Explore</h3>
      <div className="grid grid-cols-2 gap-3">
        {business.menuEnabled ? (
          <UtilityTile
            onClick={onOpenMenu}
            icon={<MenuIcon className="h-5 w-5" />}
            title="Digital Menu"
            subtitle="Photos & prices"
            primary={primary}
            secondary={secondary}
          />
        ) : null}
        {business.wifiEnabled ? (
          <UtilityTile
            onClick={onOpenWifi}
            icon={<Wifi className="h-5 w-5" />}
            title="Connect to Wi-Fi"
            subtitle="Scan to join"
            primary={primary}
            secondary={secondary}
          />
        ) : null}
        {business.instagramUrl ? (
          <SocialTile
            href={safeUrl(business.instagramUrl)!}
            icon={<Instagram className="h-5 w-5" />}
            title="Instagram"
            subtitle="Follow us"
            onClick={() => track(business.id, "instagram_click")}
            primary={primary}
            secondary={secondary}
          />
        ) : null}
        {business.facebookUrl ? (
          <SocialTile
            href={safeUrl(business.facebookUrl)!}
            icon={<Facebook className="h-5 w-5" />}
            title="Facebook"
            subtitle="Like & share"
            onClick={() => track(business.id, "facebook_click")}
            primary={primary}
            secondary={secondary}
          />
        ) : null}
        {business.youtubeUrl ? (
          <SocialTile
            href={safeUrl(business.youtubeUrl)!}
            icon={<Youtube className="h-5 w-5" />}
            title="YouTube"
            subtitle="Watch videos"
            onClick={() => track(business.id, "youtube_click")}
            primary={primary}
            secondary={secondary}
          />
        ) : null}
        {business.websiteUrl ? (
          <SocialTile
            href={safeUrl(business.websiteUrl)!}
            icon={<Globe className="h-5 w-5" />}
            title="Website"
            subtitle="Visit site"
            onClick={() => track(business.id, "website_click")}
            primary={primary}
            secondary={secondary}
          />
        ) : null}
        {business.googleMapsUrl ? (
          <SocialTile
            href={safeUrl(business.googleMapsUrl)!}
            icon={<MapPin className="h-5 w-5" />}
            title="Directions"
            subtitle="Open in Maps"
            onClick={() => track(business.id, "directions_click")}
            primary={primary}
            secondary={secondary}
            full
          />
        ) : null}
      </div>

      {/* Contact */}
      {(phone || email || business.address) ? (
        <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">Contact & Location</h3>
          <div className="mt-3 space-y-2 text-sm">
            {phone ? (
              <a href={`tel:${phone}`} className="flex items-center gap-3 text-slate-700">
                <Phone className="h-4 w-4 text-slate-400" />
                {phone}
              </a>
            ) : null}
            {email ? (
              <a href={`mailto:${email}`} className="flex items-center gap-3 text-slate-700">
                <Mail className="h-4 w-4 text-slate-400" />
                {email}
              </a>
            ) : null}
            {business.address ? (
              <p className="flex items-start gap-3 text-slate-700">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                <span>{[business.address, business.city, business.state, business.pincode].filter(Boolean).join(", ")}</span>
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* About */}
      {business.description ? (
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">About</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{business.description}</p>
        </section>
      ) : null}

      <p className="mt-10 text-center text-[11px] text-slate-500">
        Powered by <span className="font-semibold text-slate-700">Scanly</span>
      </p>
    </>
  );
}

function UtilityTile({
  icon,
  title,
  subtitle,
  onClick,
  primary,
  secondary,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  primary: string;
  secondary: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:shadow-md"
    >
      <div
        className="grid h-10 w-10 place-items-center rounded-xl"
        style={{ background: secondary, color: primary }}
      >
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
    </button>
  );
}

function SocialTile({
  href,
  icon,
  title,
  subtitle,
  onClick,
  primary,
  secondary,
  full,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick?: () => void;
  primary: string;
  secondary: string;
  full?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={`group rounded-2xl border border-slate-200 bg-white p-4 transition hover:shadow-md ${
        full ? "col-span-2" : ""
      }`}
    >
      <div
        className="grid h-10 w-10 place-items-center rounded-xl"
        style={{ background: primary, color: secondary }}
      >
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
    </a>
  );
}

// =============================================================
function MenuView({
  business,
  categories,
  items,
  onBack,
}: {
  business: Business;
  categories: MenuCategory[];
  items: MenuItem[];
  onBack: () => void;
}) {
  React.useEffect(() => {
    track(business.id, "menu_view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [active, setActive] = useState<string | null>(categories[0]?.id || null);
  return (
    <div className="animate-fade-in pt-4">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <h2 className="text-2xl font-extrabold text-slate-950">Menu</h2>
      <p className="mt-1 text-sm text-slate-600">{business.businessName}</p>

      {/* Category tabs */}
      {categories.length ? (
        <div className="scrollbar-thin -mx-5 mt-5 flex gap-2 px-4 overflow-x-auto pb-2">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium border transition ${
                active === c.id
                  ? "bg-slate-950 text-white"
                  : "bg-white border-slate-200 text-slate-700"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      ) : null}

      {/* Items */}
      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            Menu coming soon.
          </p>
        ) : null}
        {categories
          .filter((c) => !active || c.id === active)
          .flatMap((c) =>
            items
              .filter((i) => i.categoryId === c.id)
              .map((item) => <MenuItemCard key={item.id} item={item} />)
          )}
      </div>
    </div>
  );
}

function MenuItemCard({ item }: { item: MenuItem }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-3xl">🍽️</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
          <p className="whitespace-nowrap text-sm font-bold text-slate-950">{item.price}</p>
        </div>
        {item.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description}</p>
        ) : null}
      </div>
    </div>
  );
}

// =============================================================
function ReviewView({ business, onBack }: { business: Business; onBack: () => void }) {
  React.useEffect(() => {
    track(business.id, "review_open");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [overall, setOverall] = useState<string | null>(null);
  const [staff, setStaff] = useState<string | null>(null);
  const [service, setService] = useState<string | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [factors, setFactors] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [language, setLanguage] = useState<"English" | "Hinglish" | "Hindi">("English");
  const [tone, setTone] = useState<"Natural" | "Friendly" | "Short" | "Detailed">("Natural");
  const [step, setStep] = useState(0);
  const [review, setReview] = useState<string>("");
  const [generating, setGenerating] = useState(false);

  const [availableItems, setAvailableItems] = useState<string[]>([]);
  React.useEffect(() => {
    if (!business.menuEnabled) return;
    fetch(`/api/menu/public?businessId=${business.id}`)
      .then((r) => r.json())
      .then((j) => setAvailableItems((j.items || []).map((it: any) => it.name)))
      .catch(() => {});
  }, [business.id, business.menuEnabled]);

  const stepStartTracked = React.useRef(false);
  React.useEffect(() => {
    if (!stepStartTracked.current) {
      stepStartTracked.current = true;
      track(business.id, "review_started");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasItems = availableItems.length > 0;
  // step indices when items are available: 0 overall, 1 staff, 2 service, 3 items, 4 factors, 5 comment, 6 language, 7 tone, 8 generate, 9 result
  // without items:                   0 overall, 1 staff, 2 service, 3 factors, 4 comment, 5 language, 6 tone, 7 generate, 8 result
  const itemsStep = 3;
  const factorsStep = hasItems ? 4 : 3;
  const commentStep = hasItems ? 5 : 4;
  const langStep = hasItems ? 6 : 5;
  const toneStep = hasItems ? 7 : 6;
  const generateStep = hasItems ? 8 : 7;
  const resultStep = hasItems ? 9 : 8;
  const totalSteps = hasItems ? 9 : 8;
  const progressMax = hasItems ? 8 : 7;

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessId: business.id,
          overallExperience: overall,
          staffExperience: staff,
          serviceExperience: service,
          selectedItems: items,
          positiveFactors: factors,
          customComment: comment,
          language,
          tone,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to generate");
      } else {
        setReview(json.review);
        setStep(resultStep);
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setGenerating(false);
    }
  }

  async function action(action: "regenerate" | "shorten" | "natural" | "translate" | "copy", target?: "English" | "Hinglish" | "Hindi") {
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/review", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessId: business.id,
          action,
          review,
          language: target || language,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed");
      } else {
        setReview(json.review);
        if (action === "copy") {
          toast.success("Review copied to clipboard");
        }
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="animate-fade-in pt-4">
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-slate-950">AI Review Assistant</h2>
        <span className="text-xs text-slate-500">
          Step {Math.min(step + 1, totalSteps + 1)} / {totalSteps + 1}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full bg-slate-900 transition-all"
          style={{ width: `${(Math.min(step, progressMax) / progressMax) * 100}%` }}
        />
      </div>

      <div className="mt-5 space-y-5">
        {step === 0 ? (
          <RatingQuestion
            title="How was your overall experience?"
            options={["Very Poor", "Poor", "Okay", "Good", "Amazing"]}
            value={overall}
            onChange={(v) => {
              setOverall(v);
              setStep(1);
            }}
          />
        ) : null}

        {step === 1 ? (
          <RatingQuestion
            title="How was the staff?"
            options={["Very Poor", "Poor", "Okay", "Good", "Excellent"]}
            value={staff}
            onChange={(v) => {
              setStaff(v);
              setStep(2);
            }}
          />
        ) : null}

        {step === 2 ? (
          <RatingQuestion
            title="How was the service?"
            options={["Slow", "Average", "Good", "Excellent"]}
            value={service}
            onChange={(v) => {
              setService(v);
              setStep(itemsStep);
            }}
          />
        ) : null}

        {hasItems && step === itemsStep ? (
          <MultiQuestion
            title="What did you try?"
            subtitle="Pick the items you ordered"
            options={availableItems}
            value={items}
            onChange={setItems}
            onNext={() => setStep(factorsStep)}
          />
        ) : null}

        {step === factorsStep ? (
          <MultiQuestion
            title="What did you like?"
            subtitle="Pick all that apply"
            options={["Taste", "Quality", "Service", "Staff", "Ambience", "Price", "Cleanliness", "Speed", "Other"]}
            value={factors}
            onChange={setFactors}
            onNext={() => setStep(commentStep)}
          />
        ) : null}

        {step === commentStep ? (
          <CommentQuestion
            title="Anything you'd like to add? (optional)"
            value={comment}
            onChange={setComment}
            onNext={() => setStep(langStep)}
          />
        ) : null}

        {step === langStep ? (
          <ChoiceQuestion
            title="Choose a language"
            options={["English", "Hinglish", "Hindi"]}
            value={language}
            onChange={(v) => {
              setLanguage(v as any);
              setStep(toneStep);
            }}
          />
        ) : null}

        {step === toneStep ? (
          <ChoiceQuestion
            title="Choose a tone"
            options={["Natural", "Friendly", "Short", "Detailed"]}
            value={tone}
            onChange={(v) => {
              setTone(v as any);
              setStep(generateStep);
            }}
          />
        ) : null}

        {step === generateStep ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-600">
              Based on your answers, we'll craft a review draft using <strong>only</strong>{" "}
              what you've told us.
            </p>
            <Button
              className="mt-5 w-full"
              size="lg"
              loading={generating}
              onClick={generate}
            >
              Generate Review
            </Button>
          </section>
        ) : null}

        {step === resultStep ? (
          <section className="animate-slide-up rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
              <Check className="h-3 w-3" /> Your Review is Ready
            </p>
            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              className="mt-4 w-full rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              rows={7}
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button onClick={() => action("copy")} leftIcon={<Copy className="h-4 w-4" />}>
                Copy Review
              </Button>
              <Button
                variant="secondary"
                onClick={() => action("regenerate")}
                loading={generating}
              >
                Regenerate
              </Button>
              <Button variant="secondary" onClick={() => action("shorten")} loading={generating}>
                Shorten
              </Button>
              <Button variant="secondary" onClick={() => action("natural")} loading={generating}>
                More Natural
              </Button>
            </div>
            <div className="mt-2">
              <p className="text-xs font-medium text-slate-700">Translate</p>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {(["English", "Hinglish", "Hindi"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => action("translate", l)}
                    className="h-9 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-xl bg-white p-4 text-xs text-slate-600 border border-slate-200">
              <p className="font-semibold text-slate-900">How to post your review</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Tap <strong>Copy Review</strong> above.</li>
                <li>Tap <strong>Open Google Reviews</strong> below.</li>
                <li>Paste the review into the text box.</li>
                <li>Choose your star rating and submit.</li>
              </ol>
            </div>

            {business.googleReviewUrl ? (
              <a
                href={safeUrl(business.googleReviewUrl)!}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track(business.id, "google_review_click")}
                className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white"
              >
                <ExternalLink className="h-4 w-4" />
                Open Google Reviews
              </a>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function RatingQuestion({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-base font-bold text-slate-950">{title}</h3>
      <div className="mt-4 space-y-2">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
              value === o
                ? "border-slate-900 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
            }`}
          >
            {o}
            <ChevronRight className="h-4 w-4 opacity-60" />
          </button>
        ))}
      </div>
    </section>
  );
}

function ChoiceQuestion({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-base font-bold text-slate-950">{title}</h3>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
              value === o
                ? "border-slate-900 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </section>
  );
}

function MultiQuestion({
  title,
  subtitle,
  options,
  value,
  onChange,
  onNext,
}: {
  title: string;
  subtitle?: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  onNext: () => void;
}) {
  function toggle(o: string) {
    if (value.includes(o)) onChange(value.filter((v) => v !== o));
    else onChange([...value, o]);
  }
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-base font-bold text-slate-950">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value.includes(o);
          return (
            <button
              key={o}
              onClick={() => toggle(o)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                active
                  ? "border-slate-900 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-800"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
      <Button onClick={onNext} className="mt-5 w-full" size="lg">
        Continue
      </Button>
    </section>
  );
}

function CommentQuestion({
  title,
  value,
  onChange,
  onNext,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-base font-bold text-slate-950">{title}</h3>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="Anything specific you'd like to add (optional)"
        className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
      />
      <Button onClick={onNext} className="mt-4 w-full" size="lg">
        Continue
      </Button>
    </section>
  );
}

// =============================================================
function WifiView({ business, onBack }: { business: Business; onBack: () => void }) {
  React.useEffect(() => {
    track(business.id, "wifi_view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [copied, setCopied] = useState<"name" | "password" | null>(null);
  const qrData = buildWifiQrString(
    business.wifiName || "",
    business.wifiPassword || "",
    business.wifiSecurity || "WPA"
  );

  const qrSvgUrl = `/api/wifi-qr?d=${encodeURIComponent(qrData)}`;

  async function copy(value: string, kind: "name" | "password") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      toast.success(`${kind === "name" ? "Network name" : "Password"} copied`);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <div className="animate-fade-in pt-4">
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-950 text-white">
          <Wifi className="h-7 w-7" />
        </div>
        <h2 className="mt-3 text-xl font-extrabold text-slate-950">Connect to Wi-Fi</h2>
        <p className="mt-1 text-sm text-slate-600">
          Scan this QR with your phone's camera to join instantly.
        </p>

        <div className="mx-auto mt-5 inline-block rounded-2xl border border-slate-200 bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSvgUrl} alt="Wi-Fi QR" className="h-44 w-44" />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 text-left">
          <InfoTile
            label="Network"
            value={business.wifiName || "—"}
            onCopy={() => business.wifiName && copy(business.wifiName, "name")}
            copied={copied === "name"}
          />
          <InfoTile
            label="Security"
            value={business.wifiSecurity || "WPA"}
          />
          {business.wifiPassword ? (
            <InfoTile
              label="Password"
              value={business.wifiPassword}
              onCopy={() => business.wifiPassword && copy(business.wifiPassword, "password")}
              copied={copied === "password"}
              full
              secret
            />
          ) : null}
        </div>

        <p className="mt-5 text-xs text-slate-500">
          Tip: open your camera and point it at the QR. Most modern phones will offer to join automatically.
        </p>
      </section>
    </div>
  );
}

function InfoTile({
  label,
  value,
  onCopy,
  copied,
  full,
  secret,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
  full?: boolean;
  secret?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 p-3 ${full ? "col-span-2" : ""}`}>
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-slate-900">{secret ? "•".repeat(Math.min(16, value.length)) : value}</p>
        {onCopy ? (
          <button
            onClick={onCopy}
            className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-200"
            aria-label="Copy"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SharePanel({ business }: { business: Business }) {
  const url =
    typeof window !== "undefined" ? window.location.href : business.googleReviewUrl || "";

  async function copyLink() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Share this business page with anyone.</p>
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
        <span className="truncate">{url}</span>
      </div>
      <Button onClick={copyLink} className="w-full" leftIcon={<Copy className="h-4 w-4" />}>
        Copy Link
      </Button>
      <div className="grid grid-cols-3 gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-slate-200 bg-white p-3 text-center text-xs font-medium"
        >
          WhatsApp
        </a>
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-slate-200 bg-white p-3 text-center text-xs font-medium"
        >
          X / Twitter
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent(business.businessName)}&body=${encodeURIComponent(url)}`}
          className="rounded-lg border border-slate-200 bg-white p-3 text-center text-xs font-medium"
        >
          Email
        </a>
      </div>
    </div>
  );
}

// =============================================================
// Helpers
// =============================================================

function shade(hex: string, percent: number) {
  try {
    const h = hex.replace("#", "");
    const num = parseInt(
      h.length === 3
        ? h
            .split("")
            .map((c) => c + c)
            .join("")
        : h,
      16
    );
    let r = (num >> 16) + Math.round((255 * percent) / 100);
    let g = ((num >> 8) & 0x00ff) + Math.round((255 * percent) / 100);
    let b = (num & 0x0000ff) + Math.round((255 * percent) / 100);
    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  } catch {
    return hex;
  }
}

async function track(businessId: string, type: string) {
  try {
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, type }),
      keepalive: true,
    });
  } catch {}
}

// React import for hooks
import React from "react";