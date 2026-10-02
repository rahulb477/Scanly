"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Business, MenuCategory, MenuItem } from "@/db/schema";
import { Card, CardHeader, Field, Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Toaster, toast } from "@/components/ui/Toast";
import { Plus, Edit2, Trash2, Eye, EyeOff, ArrowUp, ArrowDown, ImageIcon } from "lucide-react";

export function MenuClient({
  business,
  categories,
  items,
}: {
  business: Business;
  categories: MenuCategory[];
  items: MenuItem[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [showCat, setShowCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [showItem, setShowItem] = useState(false);
  const [itemCatId, setItemCatId] = useState<string | null>(null);

  async function addCategory() {
    if (!newCatName.trim()) return;
    const res = await fetch(`/api/menu/categories`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ businessId: business.id, name: newCatName.trim() }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Failed");
    } else {
      toast.success("Category added");
      setNewCatName("");
      setShowCat(false);
      router.refresh();
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm("Delete this category and all its items?")) return;
    const res = await fetch(`/api/menu/categories/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed");
    } else {
      toast.success("Category deleted");
      router.refresh();
    }
  }

  async function toggleItem(id: string, available: boolean) {
    await fetch(`/api/menu/items/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ available: !available }),
    });
    router.refresh();
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;
    const res = await fetch(`/api/menu/items/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed");
    } else {
      toast.success("Item deleted");
      router.refresh();
    }
  }

  async function moveItem(id: string, direction: "up" | "down") {
    const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex((i) => i.id === id);
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= sorted.length) return;
    await Promise.all([
      fetch(`/api/menu/items/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sortOrder: sorted[swap].sortOrder }),
      }),
      fetch(`/api/menu/items/${sorted[swap].id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sortOrder: sorted[idx].sortOrder }),
      }),
    ]);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Toaster />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-950">Digital Menu</h1>
          <p className="mt-1 text-sm text-slate-500">
            Curate categories, items, prices and photos that customers see on the QR page.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCat(true)}>
            Add category
          </Button>
        </div>
      </div>

      {categories.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-sm text-slate-600">
            No categories yet. Start by adding your first category — Coffee, Pizza, Desserts…
          </p>
          <Button className="mt-4" onClick={() => setShowCat(true)} leftIcon={<Plus className="h-4 w-4" />}>
            Add category
          </Button>
        </Card>
      ) : null}

      <div className="space-y-6">
        {categories.map((cat) => {
          const catItems = items.filter((i) => i.categoryId === cat.id);
          return (
            <Card key={cat.id}>
              <CardHeader
                title={cat.name}
                subtitle={`${catItems.length} items`}
                action={
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      onClick={() => {
                        setItemCatId(cat.id);
                        setEditing(null);
                        setShowItem(true);
                      }}
                      leftIcon={<Plus className="h-4 w-4" />}
                    >
                      Add item
                    </Button>
                    <button
                      onClick={() => deleteCategory(cat.id)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete category"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                }
              />
              <div className="divide-y divide-slate-100">
                {catItems.length === 0 ? (
                  <p className="px-5 py-6 text-center text-sm text-slate-500">
                    No items yet in this category.
                  </p>
                ) : null}
                {catItems
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((it, idx) => (
                    <div key={it.id} className="flex items-center gap-3 p-4">
                      <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-lg bg-slate-100">
                        {it.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.image} alt={it.name} className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{it.name}</p>
                        <p className="truncate text-xs text-slate-500">{it.description || "—"}</p>
                      </div>
                      <p className="text-sm font-bold text-slate-900">{it.price}</p>
                      <div className="flex items-center gap-1">
                        <button onClick={() => moveItem(it.id, "up")} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Move up">
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => moveItem(it.id, "down")} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Move down">
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => toggleItem(it.id, it.available)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Toggle availability">
                          {it.available ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => {
                            setEditing(it);
                            setItemCatId(it.categoryId);
                            setShowItem(true);
                          }}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
                          aria-label="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => deleteItem(it.id)} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={showCat} onClose={() => setShowCat(false)} title="Add category">
        <div className="space-y-3">
          <Field label="Category name">
            <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Coffee" autoFocus />
          </Field>
          <Button onClick={addCategory} className="w-full" size="lg">Add</Button>
        </div>
      </Modal>

      <Modal
        open={showItem}
        onClose={() => {
          setShowItem(false);
          setEditing(null);
        }}
        title={editing ? "Edit item" : "Add item"}
        size="md"
      >
        <ItemForm
          businessId={business.id}
          categoryId={itemCatId || categories[0]?.id || ""}
          categories={categories}
          initial={editing}
          onClose={() => {
            setShowItem(false);
            setEditing(null);
          }}
        />
      </Modal>
    </div>
  );
}

function ItemForm({
  businessId,
  categoryId,
  categories,
  initial,
  onClose,
}: {
  businessId: string;
  categoryId: string;
  categories: MenuCategory[];
  initial: MenuItem | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [price, setPrice] = useState(initial?.price || "");
  const [image, setImage] = useState(initial?.image || "");
  const [catId, setCatId] = useState(initial?.categoryId || categoryId);
  const [loading, setLoading] = useState(false);

  function readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function upload(file: File) {
    if (file.size > 1_500_000) {
      toast.error("Image too large (max 1.5MB)");
      return;
    }
    const url = await readFile(file);
    setImage(url);
  }

  async function save() {
    if (!name.trim() || !price.trim()) {
      toast.error("Name and price are required");
      return;
    }
    setLoading(true);
    try {
      if (initial) {
        const res = await fetch(`/api/menu/items/${initial.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            price,
            image: image || null,
            categoryId: catId,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error || "Failed");
          return;
        }
      } else {
        const res = await fetch(`/api/menu/items`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            businessId,
            categoryId: catId,
            name,
            description,
            price,
            image: image || null,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error || "Failed");
          return;
        }
      }
      toast.success("Saved");
      onClose();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Category">
        <select
          className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
          value={catId}
          onChange={(e) => setCatId(e.target.value)}
        >
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price" hint="e.g. ₹220"><Input value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        <Field label="Image">
          <div className="flex items-center gap-2">
            <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium hover:bg-slate-50">
              Upload
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
            {image ? <button onClick={() => setImage("")} className="text-xs text-red-600">Remove</button> : null}
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="h-10 w-10 rounded object-cover" />
            ) : null}
          </div>
        </Field>
      </div>
      <Field label="Description"><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <Button onClick={save} loading={loading} className="w-full" size="lg">{initial ? "Save changes" : "Add item"}</Button>
    </div>
  );
}