"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Business } from "@/db/schema";
import { Card, CardHeader, Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Toaster, toast } from "@/components/ui/Toast";
import { Save } from "lucide-react";
import { THEME_PRESETS, getTheme } from "@/lib/themes";

export function AppearanceForm({ business }: { business: Business }) {
  const router = useRouter();
  const [data, setData] = useState({
    theme: business.theme || "coffee",
    primaryColor: business.primaryColor || "#7c2d12",
    secondaryColor: business.secondaryColor || "#d6a86c",
    backgroundColor: business.backgroundColor || "#fbf6ee",
    font: business.font || "Inter",
    cardStyle: business.cardStyle || "rounded",
    buttonStyle: business.buttonStyle || "solid",
    tagline: business.tagline || "",
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof data>(k: K, v: (typeof data)[K]) {
    setData((d) => ({ ...d, [k]: v }));
  }

  function applyPreset(id: string) {
    const p = getTheme(id);
    setData((d) => ({
      ...d,
      theme: id,
      primaryColor: p.primary,
      secondaryColor: p.secondary,
      backgroundColor: p.background,
      font: p.font,
    }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${business.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) toast.error(json.error || "Save failed");
      else {
        toast.success("Theme saved");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Toaster />
      <div>
        <h1 className="text-2xl font-extrabold">Appearance</h1>
        <p className="mt-1 text-sm text-slate-500">
          Customize colors, fonts and layout. Customers will see this on the QR landing page.
        </p>
      </div>

      <Card>
        <CardHeader title="Presets" subtitle="Click to apply, then fine-tune" />
        <div className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-4">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p.id)}
              className={`rounded-2xl border-2 p-3 text-left transition ${
                data.theme === p.id ? "border-slate-950" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex h-12 rounded-lg" style={{ background: p.background }}>
                <div className="h-full w-1/2 rounded-l-lg" style={{ background: p.primary }} />
                <div className="h-full w-1/2 rounded-r-lg" style={{ background: p.secondary }} />
              </div>
              <p className="mt-2 text-xs font-semibold">{p.emoji} {p.name}</p>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Colors" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Primary">
              <div className="flex gap-2">
                <input type="color" value={data.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} className="h-11 w-12 rounded-lg border border-slate-300" />
                <Input value={data.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} />
              </div>
            </Field>
            <Field label="Secondary">
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
            <Field label="Font">
              <select className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" value={data.font} onChange={(e) => set("font", e.target.value)}>
                {["Inter", "Manrope", "Plus Jakarta Sans", "Lora", "DM Serif Display"].map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field label="Card style">
              <select className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" value={data.cardStyle} onChange={(e) => set("cardStyle", e.target.value)}>
                <option value="rounded">Rounded</option>
                <option value="square">Square</option>
                <option value="pill">Pill</option>
              </select>
            </Field>
            <Field label="Button style">
              <select className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" value={data.buttonStyle} onChange={(e) => set("buttonStyle", e.target.value)}>
                <option value="solid">Solid</option>
                <option value="outline">Outline</option>
                <option value="soft">Soft</option>
              </select>
            </Field>
            <Field label="Tagline" hint="Shown on customer page">
              <Input value={data.tagline} onChange={(e) => set("tagline", e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Live preview" subtitle={`/b/${business.slug}`} />
          <div
            className="m-5 rounded-2xl"
            style={{ background: data.backgroundColor, color: "#0f172a", padding: 20, fontFamily: data.font }}
          >
            <div
              className="rounded-xl p-4"
              style={{
                background: `linear-gradient(160deg, ${data.primaryColor} 0%, ${data.primaryColor} 100%)`,
                color: "white",
              }}
            >
              <p className="text-xs opacity-80">{business.category || "Local business"}</p>
              <p className="text-lg font-bold leading-tight">{business.businessName}</p>
            </div>
            <div
              className="mt-3 rounded-xl"
              style={{
                background: "white",
                padding: 16,
                borderRadius: data.cardStyle === "square" ? 4 : data.cardStyle === "pill" ? 24 : 16,
              }}
            >
              <p className="text-xs uppercase tracking-wider opacity-60">Share Your Experience</p>
              <p className="text-sm font-bold">{data.tagline || "Help us grow with your review"}</p>
              <button
                style={{
                  marginTop: 12,
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: data.buttonStyle === "outline" ? 12 : 10,
                  background: data.buttonStyle === "outline" ? "transparent" : data.primaryColor,
                  color: data.buttonStyle === "outline" ? data.primaryColor : "white",
                  border: data.buttonStyle === "outline" ? `1px solid ${data.primaryColor}` : "none",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Leave a Google Review
              </button>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving} leftIcon={<Save className="h-4 w-4" />}>Save theme</Button>
      </div>
    </div>
  );
}