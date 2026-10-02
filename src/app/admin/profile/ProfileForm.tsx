"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Business } from "@/db/schema";
import { Card, CardHeader, Field, Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Toaster, toast } from "@/components/ui/Toast";
import { Save, ImageIcon } from "lucide-react";

export function ProfileForm({ business }: { business: Business }) {
  const router = useRouter();
  const [data, setData] = useState({
    businessName: business.businessName,
    category: business.category || "",
    description: business.description || "",
    phone: business.phone || "",
    email: business.email || "",
    address: business.address || "",
    city: business.city || "",
    state: business.state || "",
    pincode: business.pincode || "",
    logo: business.logo || "",
    coverImage: business.coverImage || "",
    tagline: business.tagline || "",
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof data>(k: K, v: (typeof data)[K]) {
    setData((d) => ({ ...d, [k]: v }));
  }

  function readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function onUpload(field: "logo" | "coverImage", file: File) {
    if (file.size > 1_500_000) {
      toast.error("Image must be smaller than 1.5MB");
      return;
    }
    try {
      const dataUrl = await readFile(file);
      set(field, dataUrl as any);
      toast.success("Image ready (save to apply)");
    } catch {
      toast.error("Upload failed");
    }
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
      if (!res.ok) {
        toast.error(json.error || "Save failed");
      } else {
        toast.success("Profile saved");
        router.refresh();
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Toaster />
      <div>
        <h1 className="text-2xl font-extrabold text-slate-950">Business Profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Update basic information shown on the QR landing page.
        </p>
      </div>

      <Card>
        <CardHeader title="Identity" subtitle="Name, category and logo" />
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Field label="Business name">
            <Input value={data.businessName} onChange={(e) => set("businessName", e.target.value)} />
          </Field>
          <Field label="Category">
            <Input value={data.category} onChange={(e) => set("category", e.target.value)} placeholder="Café & Bakery" />
          </Field>
          <Field label="Tagline" hint="Shown on landing page">
            <Input value={data.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="Baked with love, shared with you" />
          </Field>
          <Field label="Description">
            <Textarea
              value={data.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              placeholder="Tell customers about your business"
            />
          </Field>

          <div className="md:col-span-2 grid grid-cols-2 gap-3">
            <ImageBox
              label="Logo"
              image={data.logo}
              onChange={(f) => onUpload("logo", f)}
              onClear={() => set("logo", "")}
            />
            <ImageBox
              label="Cover image"
              image={data.coverImage}
              onChange={(f) => onUpload("coverImage", f)}
              onClear={() => set("coverImage", "")}
              wide
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Contact" subtitle="Public contact info" />
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Field label="Phone"><Input value={data.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 90000 12345" /></Field>
          <Field label="Email"><Input type="email" value={data.email} onChange={(e) => set("email", e.target.value)} placeholder="hello@business.com" /></Field>
          <Field label="Address"><Input value={data.address} onChange={(e) => set("address", e.target.value)} placeholder="Shop 12, Lane, City" /></Field>
          <Field label="City"><Input value={data.city} onChange={(e) => set("city", e.target.value)} /></Field>
          <Field label="State"><Input value={data.state} onChange={(e) => set("state", e.target.value)} /></Field>
          <Field label="Pincode"><Input value={data.pincode} onChange={(e) => set("pincode", e.target.value)} /></Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving} leftIcon={<Save className="h-4 w-4" />}>
          Save profile
        </Button>
      </div>
    </div>
  );
}

function ImageBox({
  label,
  image,
  onChange,
  onClear,
  wide,
}: {
  label: string;
  image: string;
  onChange: (file: File) => void;
  onClear: () => void;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 ${wide ? "col-span-2" : ""}`}>
      <p className="text-xs font-medium text-slate-700">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-lg bg-white">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={label} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-5 w-5 text-slate-400" />
          )}
        </div>
        <div className="flex flex-1 items-center justify-end gap-2">
          <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50">
            Upload
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onChange(f);
              }}
            />
          </label>
          {image ? (
            <button onClick={onClear} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
              Remove
            </button>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Stored as base64. Max 1.5 MB.</p>
    </div>
  );
}