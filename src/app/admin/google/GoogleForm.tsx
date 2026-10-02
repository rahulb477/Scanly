"use client";

import { authenticatedFetch } from "@/lib/firebase/authenticated-fetch";
import { authErrorMessage } from "@/lib/firebase/errors";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Business } from "@/lib/data/types";
import { Card, CardHeader, Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { Star, Save, ExternalLink, AlertCircle } from "lucide-react";

export function GoogleForm({ business }: { business: Business }) {
  const router = useRouter();
  const [data, setData] = useState({
    googleReviewUrl: business.googleReviewUrl || "",
    googlePlaceId: business.googlePlaceId || "",
    googleMapsUrl: business.googleMapsUrl || "",
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
        toast.success("Saved");
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
        <h1 className="text-2xl font-extrabold text-slate-950">Google Review</h1>
        <p className="mt-1 text-sm text-slate-500">
          This URL opens when customers tap Leave a Google Review. No reviews are auto-posted.
        </p>
      </div>

      <Card>
        <CardHeader title="Google Business Profile" />
        <div className="space-y-4 p-5">
          <Field
            label="Google Review URL"
            hint="From your GBP dashboard"
          >
            <Input
              value={data.googleReviewUrl}
              onChange={(e) => set("googleReviewUrl", e.target.value)}
              placeholder="https://search.google.com/local/writereview?placeid=…"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Google Place ID" hint="Optional">
              <Input
                value={data.googlePlaceId}
                onChange={(e) => set("googlePlaceId", e.target.value)}
                placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
              />
            </Field>
            <Field label="Google Maps URL" hint="For Directions">
              <Input
                value={data.googleMapsUrl}
                onChange={(e) => set("googleMapsUrl", e.target.value)}
                placeholder="https://maps.google.com/?q=Your+Business"
              />
            </Field>
          </div>

          {data.googleReviewUrl ? (
            <a
              href={data.googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              <Star className="h-4 w-4" />
              Test this link
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </Card>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertCircle className="mt-0.5 h-4 w-4" />
        <p>
          Scanly never creates or auto-submits reviews. Customers must tap the link and post themselves.
          We make the workflow easy, but the integrity of every review stays with the customer.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving} leftIcon={<Save className="h-4 w-4" />}>Save</Button>
      </div>
    </div>
  );
}