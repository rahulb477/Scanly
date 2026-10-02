"use client";

import { authenticatedFetch } from "@/lib/firebase/authenticated-fetch";
import { uploadBusinessImage } from "@/lib/firebase/storage";
import { authErrorMessage } from "@/lib/firebase/errors";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Business } from "@/lib/data/types";
import { Card, CardHeader, Field, Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Store,
  Image as ImageIcon,
  Tag,
  MapPin,
  Star,
  Link as LinkIcon,
  Share2,
  Wifi,
  UtensilsCrossed,
  Palette,
  QrCode,
  PartyPopper,
} from "lucide-react";

const steps = [
  { key: "name", label: "Business name", icon: Store },
  { key: "logo", label: "Logo", icon: ImageIcon },
  { key: "category", label: "Category", icon: Tag },
  { key: "address", label: "Address", icon: MapPin },
  { key: "google", label: "Google Review URL", icon: Star },
  { key: "maps", label: "Google Maps URL", icon: MapPin },
  { key: "social", label: "Social media", icon: Share2 },
  { key: "wifi", label: "Wi-Fi details", icon: Wifi },
  { key: "menu", label: "Digital menu", icon: UtensilsCrossed },
  { key: "theme", label: "Theme", icon: Palette },
  { key: "qr", label: "Generate QR", icon: QrCode },
] as const;

export function OnboardingClient({ business }: { business: Business }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    businessName: business.businessName,
    logo: business.logo || "",
    category: business.category || "",
    phone: business.phone || "",
    email: business.email || "",
    address: business.address || "",
    city: business.city || "",
    state: business.state || "",
    pincode: business.pincode || "",
    googleReviewUrl: business.googleReviewUrl || "",
    googleMapsUrl: business.googleMapsUrl || "",
    instagramUrl: business.instagramUrl || "",
    facebookUrl: business.facebookUrl || "",
    youtubeUrl: business.youtubeUrl || "",
    whatsappUrl: business.whatsappUrl || "",
    websiteUrl: business.websiteUrl || "",
    wifiEnabled: business.wifiEnabled,
    wifiPublicSharingEnabled: business.wifiPublicSharingEnabled,
    wifiName: business.wifiName || "",
    wifiPassword: business.wifiPassword || "",
    wifiSecurity: (business.wifiSecurity || "WPA") as "WPA" | "WEP" | "Open",
    menuEnabled: business.menuEnabled,
    primaryColor: business.primaryColor,
    secondaryColor: business.secondaryColor,
    backgroundColor: business.backgroundColor,
    tagline: business.tagline || "",
  });
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function set<K extends keyof typeof data>(k: K, v: (typeof data)[K]) {
    setData((d) => ({ ...d, [k]: v }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await authenticatedFetch(`/api/businesses/${business.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Save failed");
        return false;
      }
      return true;
    } catch (error) {
      toast.error(authErrorMessage(error));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function next() {
    if (step < steps.length - 1) {
      const ok = await save();
      if (ok) {
        setStep(step + 1);
        router.refresh();
      }
    } else {
      const ok = await save();
      if (ok) {
        setDone(true);
        router.refresh();
      }
    }
  }

  async function back() {
    if (step > 0) setStep(step - 1);
  }

  if (done) {
    return <DoneStep businessId={business.id} />;
  }

  const StepIcon = steps[step].icon;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-slate-500">Setup wizard</p>
        <h1 className="text-2xl font-extrabold text-slate-950">Get your QR live in minutes</h1>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {steps.map((s, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <div
              key={s.key}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                current
                  ? "bg-slate-950 text-white"
                  : done
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {done ? <Check className="h-3 w-3" /> : <s.icon className="h-3 w-3" />}
              {i + 1}. {s.label}
            </div>
          );
        })}
      </div>

      {uploadProgress !== null ? <p role="status">Uploading logo: {uploadProgress}%</p> : null}
      <Card>
        <CardHeader
          title={steps[step].label}
          subtitle={`Step ${step + 1} of ${steps.length}`}
          action={
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-950 text-white">
              <StepIcon className="h-4 w-4" />
            </div>
          }
        />
        <div className="space-y-4 p-5">
          {step === 0 ? (
            <Field label="Business name" hint="Shown everywhere">
              <Input
                value={data.businessName}
                onChange={(e) => set("businessName", e.target.value)}
              />
            </Field>
          ) : null}

          {step === 1 ? (
            <div>
              <p className="text-sm text-slate-700">Upload your logo (PNG, JPG or WebP, max 5MB).</p>
              <div className="mt-3 flex items-center gap-3">
                <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-xl bg-slate-100">
                  {data.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.logo} alt="Logo" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-slate-400" />
                  )}
                </div>
                <div className="flex flex-1 items-center gap-2">
                  <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
                    Upload logo
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setUploadProgress(0);
                          try { set("logo", await uploadBusinessImage(business.id, "logos", f, setUploadProgress)); }
                          catch (error) { toast.error(authErrorMessage(error)); }
                          finally { setUploadProgress(null); }
                        }
                      }}
                    />
                  </label>
                  {data.logo ? (
                    <button onClick={() => set("logo", "")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <Field label="Category" hint="Helps you organise your business">
              <select
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                value={data.category}
                onChange={(e) => set("category", e.target.value)}
              >
                <option value="">Select…</option>
                {["Café & Bakery", "Restaurant", "Salon", "Hotel", "Retail", "Gym", "Other"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Address"><Input value={data.address} onChange={(e) => set("address", e.target.value)} /></Field>
              <Field label="City"><Input value={data.city} onChange={(e) => set("city", e.target.value)} /></Field>
              <Field label="State"><Input value={data.state} onChange={(e) => set("state", e.target.value)} /></Field>
              <Field label="Pincode"><Input value={data.pincode} onChange={(e) => set("pincode", e.target.value)} /></Field>
              <Field label="Phone"><Input value={data.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
              <Field label="Email"><Input type="email" value={data.email} onChange={(e) => set("email", e.target.value)} /></Field>
            </div>
          ) : null}

          {step === 4 ? (
            <Field
              label="Google Review URL"
              hint="From your Google Business Profile dashboard"
            >
              <Input
                value={data.googleReviewUrl}
                onChange={(e) => set("googleReviewUrl", e.target.value)}
                placeholder="https://search.google.com/local/writereview?placeid=…"
              />
            </Field>
          ) : null}

          {step === 5 ? (
            <Field label="Google Maps URL" hint="For Directions button">
              <Input
                value={data.googleMapsUrl}
                onChange={(e) => set("googleMapsUrl", e.target.value)}
                placeholder="https://maps.google.com/?q=Your+Business"
              />
            </Field>
          ) : null}

          {step === 6 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Instagram"><Input value={data.instagramUrl} onChange={(e) => set("instagramUrl", e.target.value)} /></Field>
              <Field label="Facebook"><Input value={data.facebookUrl} onChange={(e) => set("facebookUrl", e.target.value)} /></Field>
              <Field label="YouTube"><Input value={data.youtubeUrl} onChange={(e) => set("youtubeUrl", e.target.value)} /></Field>
              <Field label="WhatsApp"><Input value={data.whatsappUrl} onChange={(e) => set("whatsappUrl", e.target.value)} /></Field>
              <Field label="Website"><Input value={data.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} /></Field>
            </div>
          ) : null}

          {step === 7 ? (
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={data.wifiEnabled}
                  onChange={(e) => set("wifiEnabled", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                <span className="text-sm font-medium">Show Wi-Fi on customer page</span>
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input type="checkbox" checked={data.wifiPublicSharingEnabled} onChange={(e) => set("wifiPublicSharingEnabled", e.target.checked)} />
                I authorize publishing these guest Wi-Fi credentials to anyone opening the customer Wi-Fi card.
              </label>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Network name"><Input value={data.wifiName} onChange={(e) => set("wifiName", e.target.value)} /></Field>
                <Field label="Password"><Input value={data.wifiPassword} onChange={(e) => set("wifiPassword", e.target.value)} /></Field>
                <Field label="Security">
                  <select
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    value={data.wifiSecurity}
                    onChange={(e) => set("wifiSecurity", e.target.value as "WPA" | "WEP" | "Open")}
                  >
                    <option value="WPA">WPA / WPA2</option>
                    <option value="WEP">WEP</option>
                    <option value="Open">Open</option>
                  </select>
                </Field>
              </div>
            </div>
          ) : null}

          {step === 8 ? (
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={data.menuEnabled}
                  onChange={(e) => set("menuEnabled", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                <span className="text-sm font-medium">Show digital menu on customer page</span>
              </label>
              <p className="text-sm text-slate-500">
                You can add items and categories from the <strong>Digital Menu</strong> tab in the admin.
              </p>
            </div>
          ) : null}

          {step === 9 ? (
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Primary color">
                <div className="flex gap-2">
                  <input type="color" value={data.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} className="h-11 w-12 rounded-lg border border-slate-300" />
                  <Input value={data.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} />
                </div>
              </Field>
              <Field label="Secondary color">
                <div className="flex gap-2">
                  <input type="color" value={data.secondaryColor} onChange={(e) => set("secondaryColor", e.target.value)} className="h-11 w-12 rounded-lg border border-slate-300" />
                  <Input value={data.secondaryColor} onChange={(e) => set("secondaryColor", e.target.value)} />
                </div>
              </Field>
              <Field label="Background">
                <div className="flex gap-2">
                  <input type="color" value={data.backgroundColor} onChange={(e) => set("backgroundColor", e.target.value)} className="h-11 w-12 rounded-lg border border-slate-300" />
                  <Input value={data.backgroundColor} onChange={(e) => set("backgroundColor", e.target.value)} />
                </div>
              </Field>
              <Field label="Tagline" hint="Optional">
                <Input value={data.tagline} onChange={(e) => set("tagline", e.target.value)} />
              </Field>
            </div>
          ) : null}

          {step === 10 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 text-center">
              <PartyPopper className="mx-auto h-10 w-10 text-emerald-600" />
              <p className="mt-3 text-lg font-bold">Your QR Code is Ready!</p>
              <p className="mt-1 text-sm text-slate-600">
                Continue to the dashboard to download your QR in PNG, SVG or PDF.
              </p>
            </div>
          ) : null}
        </div>
      </Card>

      <div className="flex justify-between">
        <Button variant="secondary" onClick={back} disabled={step === 0} leftIcon={<ArrowLeft className="h-4 w-4" />}>
          Back
        </Button>
        <Button onClick={next} loading={saving} disabled={uploadProgress !== null} rightIcon={<ArrowRight className="h-4 w-4" />}>
          {step === steps.length - 1 ? "Finish setup" : "Save & continue"}
        </Button>
      </div>
    </div>
  );
}

function DoneStep({ businessId }: { businessId: string }) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-md text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100">
        <Check className="h-8 w-8 text-emerald-700" />
      </div>
      <h1 className="mt-4 text-2xl font-extrabold">All set!</h1>
      <p className="mt-2 text-slate-600">
        Your business is ready. Head over to the QR Codes page to download and print your QR.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button onClick={() => router.push(`/dashboard/qr?businessId=${businessId}`)}>Go to QR Codes</Button>
        <Button variant="secondary" onClick={() => router.push(`/dashboard?businessId=${businessId}`)}>Dashboard</Button>
      </div>
    </div>
  );
}