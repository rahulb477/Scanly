"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Business } from "@/db/schema";
import { Card, CardHeader, Field, Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Toaster, toast } from "@/components/ui/Toast";
import { Save, Eye as EyeVisible, EyeOff } from "lucide-react";

export function WifiForm({ business }: { business: Business }) {
  const router = useRouter();
  const [data, setData] = useState({
    wifiEnabled: business.wifiEnabled,
    wifiName: business.wifiName || "",
    wifiPassword: business.wifiPassword || "",
    wifiSecurity: (business.wifiSecurity || "WPA") as "WPA" | "WEP" | "Open",
  });
  const [showPwd, setShowPwd] = useState(false);
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
        toast.success("Wi-Fi settings saved");
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
        <h1 className="text-2xl font-extrabold text-slate-950">Wi-Fi Sharing</h1>
        <p className="mt-1 text-sm text-slate-500">
          Customers see a Wi-Fi card on your QR page with a scannable QR to join.
        </p>
      </div>

      <Card>
        <CardHeader title="Wi-Fi details" />
        <div className="space-y-4 p-5">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={data.wifiEnabled}
              onChange={(e) => set("wifiEnabled", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span className="text-sm font-medium text-slate-800">Show Wi-Fi on customer page</span>
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Network name (SSID)">
              <Input value={data.wifiName} onChange={(e) => set("wifiName", e.target.value)} placeholder="BAKE-Guest" />
            </Field>
            <Field label="Password">
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  value={data.wifiPassword}
                  onChange={(e) => set("wifiPassword", e.target.value)}
                  placeholder="welcome2025"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:bg-slate-100"
                  aria-label="Show password"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <EyeVisible className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <Field label="Security">
              <select
                className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                value={data.wifiSecurity}
                onChange={(e) => set("wifiSecurity", e.target.value as any)}
              >
                <option value="WPA">WPA / WPA2</option>
                <option value="WEP">WEP</option>
                <option value="Open">Open (no password)</option>
              </select>
            </Field>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving} leftIcon={<Save className="h-4 w-4" />}>Save</Button>
      </div>
    </div>
  );
}