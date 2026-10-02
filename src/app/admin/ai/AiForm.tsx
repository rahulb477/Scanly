"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Business } from "@/db/schema";
import { Card, CardHeader, Field, Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Toaster, toast } from "@/components/ui/Toast";
import { Save, Sparkles } from "lucide-react";

export function AiForm({ business }: { business: Business }) {
  const router = useRouter();
  const [data, setData] = useState({
    aiReviewEnabled: business.aiReviewEnabled,
    reviewEnabled: business.reviewEnabled,
    menuEnabled: business.menuEnabled,
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof data>(k: K, v: (typeof data)[K]) {
    setData((d) => ({ ...d, [k]: v }));
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
        toast.success("Saved");
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
        <h1 className="text-2xl font-extrabold">AI Review</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enable the conversational review assistant on your QR page.
        </p>
      </div>

      <Card>
        <CardHeader title="Feature toggles" />
        <div className="divide-y divide-slate-100">
          <Toggle
            title="Show reviews section"
            description="Master switch — turn off if you don't want any review flow."
            checked={data.reviewEnabled}
            onChange={(v) => set("reviewEnabled", v)}
          />
          <Toggle
            title="Enable AI Review Assistant"
            description="Customers answer a few quick questions and get a draft review to edit and post themselves."
            checked={data.aiReviewEnabled}
            onChange={(v) => set("aiReviewEnabled", v)}
          />
          <Toggle
            title="Show Digital Menu on customer page"
            description="Even with this off, menu can be enabled on the public page."
            checked={data.menuEnabled}
            onChange={(v) => set("menuEnabled", v)}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="How it works" subtitle="Honest, never fabricated" />
        <ul className="space-y-2 p-5 text-sm text-slate-600">
          <li>• Asks about overall, staff, language and tone.</li>
          <li>• Generates a draft using only the customer's own answers.</li>
          <li>• Customer edits, copies and posts on Google themselves.</li>
          <li>• Multi-language support: English, Hinglish, Hindi.</li>
        </ul>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving} leftIcon={<Save className="h-4 w-4" />}>Save</Button>
      </div>
    </div>
  );
}

function Toggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-5">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-sm text-slate-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${
          checked ? "bg-slate-950" : "bg-slate-300"
        }`}
        aria-label="Toggle"
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}