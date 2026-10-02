"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  QrCode,
  Sparkles,
  UtensilsCrossed,
  Share2,
  Wifi,
  Star,
  Palette,
  BarChart3,
  Settings,
  LogOut,
  Menu as MenuIcon,
  X,
  Plus,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Toaster, toast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Input, Field, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Business } from "@/db/schema";
import type { SessionUser } from "@/lib/auth";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/profile", label: "Business Profile", icon: Store },
  { href: "/admin/qr", label: "QR Codes", icon: QrCode },
  { href: "/admin/ai", label: "AI Review", icon: Sparkles },
  { href: "/admin/menu", label: "Digital Menu", icon: UtensilsCrossed },
  { href: "/admin/social", label: "Social Links", icon: Share2 },
  { href: "/admin/wifi", label: "Wi-Fi", icon: Wifi },
  { href: "/admin/google", label: "Google Review", icon: Star },
  { href: "/admin/appearance", label: "Appearance", icon: Palette },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({
  user,
  businesses,
  children,
}: {
  user: SessionUser;
  businesses: (Business & { memberRole?: string })[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(businesses[0]?.id || null);
  const [showCreate, setShowCreate] = useState(false);

  const active = businesses.find((b) => b.id === activeId) || businesses[0];

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster />
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
        <button onClick={() => setOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200">
          <MenuIcon className="h-4 w-4" />
        </button>
        <p className="text-sm font-bold text-slate-900">
          {active?.businessName || "Scanly Admin"}
        </p>
        <button onClick={logout} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200">
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 z-50 w-72 transform border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-14 items-center justify-between border-b border-slate-100 px-4">
            <Link href="/admin" className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-950 text-white">
                <QrCode className="h-4 w-4" />
              </div>
              <span className="text-sm font-bold text-slate-900">Scanly Admin</span>
            </Link>
            <button onClick={() => setOpen(false)} className="lg:hidden grid h-8 w-8 place-items-center rounded-lg border border-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Business switcher */}
          <div className="border-b border-slate-100 p-3">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Your businesses
            </p>
            <div className="mt-2 space-y-1">
              {businesses.length === 0 ? (
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4" />
                  Create your first business
                </button>
              ) : null}
              {businesses.map((b) => {
                const isActive = active?.id === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => {
                      setActiveId(b.id);
                      setOpen(false);
                      // navigate so server can read businessId from search
                      router.push(`/admin?businessId=${b.id}`);
                      router.refresh();
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
                      isActive
                        ? "bg-slate-950 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <div
                      className="grid h-7 w-7 place-items-center rounded-md text-[11px] font-bold"
                      style={{
                        background: isActive ? b.secondaryColor : b.primaryColor,
                        color: "white",
                      }}
                    >
                      {b.businessName[0]?.toUpperCase()}
                    </div>
                    <span className="flex-1 truncate">{b.businessName}</span>
                    <span className={cn("text-[10px] uppercase", isActive ? "text-white/60" : "text-slate-400")}>
                      {b.memberRole || "owner"}
                    </span>
                  </button>
                );
              })}
              {businesses.length > 0 ? (
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4" />
                  New business
                </button>
              ) : null}
            </div>
          </div>

          <nav className="px-3 py-3">
            {nav.map((item) => {
              const Icon = item.icon;
              const isCurrent = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href + (isCurrent ? "" : `?businessId=${active?.id || ""}`)}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "mt-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                    isCurrent
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-slate-100 p-3">
            <div className="mb-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-900">{user.name || user.email}</p>
              <p className="truncate">{user.email}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {active ? (
                <a
                  href={`/b/${active.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Live page
                </a>
              ) : null}
              <button
                onClick={logout}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay */}
        {open ? (
          <div
            className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
            onClick={() => setOpen(false)}
          />
        ) : null}

        <main className="min-h-screen p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      <CreateBusinessModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => {
          setActiveId(id);
          router.push(`/admin?businessId=${id}`);
          router.refresh();
        }}
      />
    </div>
  );
}

function CreateBusinessModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Café & Bakery");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessName: name, category }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed");
      } else {
        toast.success("Business created");
        onCreated(json.business.id);
        onClose();
        setName("");
      }
    } catch (err) {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create a business">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Business name" htmlFor="bname">
          <Input
            id="bname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="BAKE Café & Bakery"
            required
            maxLength={200}
          />
        </Field>
        <Field label="Category" htmlFor="bcat">
          <select
            id="bcat"
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {["Café & Bakery", "Restaurant", "Salon", "Hotel", "Retail", "Gym", "Other"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-slate-500">
          A unique public URL will be auto-generated like <code>/b/your-business</code>.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" loading={loading}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}