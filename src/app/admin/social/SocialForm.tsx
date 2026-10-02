"use client";

import { authenticatedFetch } from "@/lib/firebase/authenticated-fetch";
import { authErrorMessage } from "@/lib/firebase/errors";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Business } from "@/lib/data/types";
import { Card, CardHeader, Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { Instagram, Facebook, Youtube, Globe, MessageCircle, Twitter, Save } from "lucide-react";

export function SocialForm({ business }: { business: Business }) {
  const router = useRouter();
  const [data, setData] = useState({
    instagramUrl: business.instagramUrl || "",
    facebookUrl: business.facebookUrl || "",
    youtubeUrl: business.youtubeUrl || "",
    websiteUrl: business.websiteUrl || "",
    whatsappUrl: business.whatsappUrl || "",
    twitterUrl: business.twitterUrl || "",
  });
  const [saving, setSaving] = useState(false);

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
      if (!res.ok) toast.error(json.error || "Save failed");
      else {
        toast.success("Social links saved");
        router.refresh();
      }
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-950">Social Links</h1>
        <p className="mt-1 text-sm text-slate-500">
          Add the URLs customers should be directed to. Empty fields are not shown.
        </p>
      </div>

      <Card>
        <CardHeader title="Links" subtitle="Use full URLs starting with https://" />
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Field label="Instagram" htmlFor="instagram">
            <div className="relative">
              <Instagram className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input id="instagram" value={data.instagramUrl} onChange={(e) => set("instagramUrl", e.target.value)} className="pl-9" placeholder="https://instagram.com/yourpage" />
            </div>
          </Field>
          <Field label="Facebook" htmlFor="facebook">
            <div className="relative">
              <Facebook className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input id="facebook" value={data.facebookUrl} onChange={(e) => set("facebookUrl", e.target.value)} className="pl-9" placeholder="https://facebook.com/yourpage" />
            </div>
          </Field>
          <Field label="YouTube" htmlFor="youtube">
            <div className="relative">
              <Youtube className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input id="youtube" value={data.youtubeUrl} onChange={(e) => set("youtubeUrl", e.target.value)} className="pl-9" placeholder="https://youtube.com/@yourpage" />
            </div>
          </Field>
          <Field label="Website" htmlFor="website">
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input id="website" value={data.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} className="pl-9" placeholder="https://yourwebsite.com" />
            </div>
          </Field>
          <Field label="WhatsApp" htmlFor="whatsapp">
            <div className="relative">
              <MessageCircle className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input id="whatsapp" value={data.whatsappUrl} onChange={(e) => set("whatsappUrl", e.target.value)} className="pl-9" placeholder="https://wa.me/919000012345" />
            </div>
          </Field>
          <Field label="X / Twitter" htmlFor="twitter">
            <div className="relative">
              <Twitter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input id="twitter" value={data.twitterUrl} onChange={(e) => set("twitterUrl", e.target.value)} className="pl-9" placeholder="https://x.com/yourpage" />
            </div>
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving} leftIcon={<Save className="h-4 w-4" />}>Save</Button>
      </div>
    </div>
  );
}