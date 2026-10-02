"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Business } from "@/db/schema";
import { Card, CardHeader } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Toaster, toast } from "@/components/ui/Toast";
import { Trash2, Copy, ExternalLink } from "lucide-react";
import { publicBusinessUrl } from "@/lib/utils";

export function SettingsClient({ business }: { business: Business }) {
  const router = useRouter();
  const url = publicBusinessUrl(business.slug);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  }

  async function destroy() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/businesses/${business.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Could not delete");
        setConfirming(false);
      } else {
        toast.success("Business deleted");
        router.push("/admin");
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Toaster />
      <div>
        <h1 className="text-2xl font-extrabold">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your business URL and dangerous actions.</p>
      </div>

      <Card>
        <CardHeader title="Public URL" />
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <span className="flex-1 truncate">{url}</span>
            <Button size="sm" variant="secondary" leftIcon={<Copy className="h-4 w-4" />} onClick={copy}>Copy</Button>
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium hover:bg-slate-50">
              <ExternalLink className="h-4 w-4" />
              Open
            </a>
          </div>
          <p className="text-xs text-slate-500">
            This is the link encoded in your QR. You can change Google URL, menu, Wi-Fi and more without changing this URL.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Danger zone" subtitle="Destructive actions" />
        <div className="p-5">
          {!confirming ? (
            <Button variant="secondary" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirming(true)}>
              Delete business
            </Button>
          ) : (
            <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-900">
                This will delete the business, all menu data, settings and analytics. This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button variant="danger" loading={deleting} onClick={destroy}>
                  Yes, delete permanently
                </Button>
                <Button variant="secondary" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}