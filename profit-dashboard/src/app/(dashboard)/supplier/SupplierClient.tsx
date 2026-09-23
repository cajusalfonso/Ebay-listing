"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Supplier,
  ProductModel,
  ModelCategory,
  ModelCategoryLink,
  ModelSpec,
} from "@/lib/database.types";
import { SUPPLIER_PLATFORMS } from "@/lib/constants";
import {
  calcModelMargin,
  calcPriceComparison,
  groupModelsByName,
  formatEur,
  formatPercent,
} from "@/lib/calculations";

type SupplierForm = Omit<Supplier, "id" | "user_id" | "created_at">;
type ModelForm = Omit<ProductModel, "id" | "user_id" | "created_at">;

function emptySupplierForm(): SupplierForm {
  return {
    company_name: "",
    contact_person: "",
    email: "",
    phone: "",
    messenger: "",
    country: "",
    vat_id: "",
    address: "",
    platform: "",
    notes: "",
  };
}

function emptyModelForm(supplierId: string): ModelForm {
  return {
    supplier_id: supplierId,
    model: "",
    storage: "",
    color: "",
    purchase_price_net: 0,
    sale_price_gross: 0,
    purchase_date: new Date().toISOString().slice(0, 10),
    notes: "",
    spec: "EU",
  };
}

type SortField = "model" | "purchase_price_net" | "sale_price_gross" | "margin" | "supplier";

export function SupplierClient({
  initialSuppliers,
  initialModels,
  initialCategories,
  initialCategoryLinks,
  paymentFeePercent,
  userId,
}: {
  initialSuppliers: Supplier[];
  initialModels: ProductModel[];
  initialCategories: ModelCategory[];
  initialCategoryLinks: ModelCategoryLink[];
  paymentFeePercent: number;
  userId: string;
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [models, setModels] = useState<ProductModel[]>(initialModels);
  const [categories, setCategories] = useState<ModelCategory[]>(initialCategories);
  const [categoryLinks, setCategoryLinks] =
    useState<ModelCategoryLink[]>(initialCategoryLinks);

  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(emptySupplierForm());

  const [showModelForm, setShowModelForm] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [modelForm, setModelForm] = useState<ModelForm>(
    emptyModelForm(initialSuppliers[0]?.id ?? "")
  );
  const [modelFormCategoryIds, setModelFormCategoryIds] = useState<string[]>([]);

  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [searchModel, setSearchModel] = useState("");
  const [specFilter, setSpecFilter] = useState<"all" | ModelSpec>("all");
  const [categoryFilterId, setCategoryFilterId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("model");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const supplierById = useMemo(() => {
    const map = new Map<string, Supplier>();
    suppliers.forEach((s) => map.set(s.id, s));
    return map;
  }, [suppliers]);

  const modelCountBySupplier = useMemo(() => {
    const map = new Map<string, number>();
    models.forEach((m) => map.set(m.supplier_id, (map.get(m.supplier_id) ?? 0) + 1));
    return map;
  }, [models]);

  const categoryIdsByModel = useMemo(() => {
    const map = new Map<string, string[]>();
    categoryLinks.forEach((l) => {
      const list = map.get(l.model_id) ?? [];
      list.push(l.category_id);
      map.set(l.model_id, list);
    });
    return map;
  }, [categoryLinks]);

  const priceComparison = useMemo(() => calcPriceComparison(models), [models]);

  // --- Supplier CRUD ---

  function openNewSupplierForm() {
    setSupplierForm(emptySupplierForm());
    setEditingSupplierId(null);
    setShowSupplierForm(true);
  }

  function openEditSupplierForm(s: Supplier) {
    const { id, user_id, created_at, ...rest } = s;
    setSupplierForm(rest);
    setEditingSupplierId(s.id);
    setShowSupplierForm(true);
  }

  async function handleSaveSupplier(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (editingSupplierId) {
      const { data, error } = await supabase
        .from("suppliers")
        .update(supplierForm)
        .eq("id", editingSupplierId)
        .select()
        .single();
      setSaving(false);
      if (error) return setError(error.message);
      setSuppliers((prev) => prev.map((s) => (s.id === editingSupplierId ? data : s)));
    } else {
      const { data, error } = await supabase
        .from("suppliers")
        .insert({ ...supplierForm, user_id: userId })
        .select()
        .single();
      setSaving(false);
      if (error) return setError(error.message);
      setSuppliers((prev) => [...prev, data]);
    }

    setShowSupplierForm(false);
    setEditingSupplierId(null);
  }

  async function handleDeleteSupplier(id: string) {
    const count = modelCountBySupplier.get(id) ?? 0;
    if (count > 0) {
      alert(
        `Dieser Supplier hat noch ${count} Modell(e). Lösche zuerst die Modelle, bevor du den Supplier löschst.`
      );
      return;
    }
    if (!confirm("Supplier wirklich löschen?")) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) return alert(error.message);
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    if (selectedSupplierId === id) setSelectedSupplierId(null);
  }

  // --- Model CRUD ---

  function openNewModelForm(supplierId?: string) {
    setModelForm(emptyModelForm(supplierId ?? selectedSupplierId ?? suppliers[0]?.id ?? ""));
    setModelFormCategoryIds([]);
    setEditingModelId(null);
    setShowModelForm(true);
  }

  function openEditModelForm(m: ProductModel) {
    const { id, user_id, created_at, ...rest } = m;
    setModelForm(rest);
    setModelFormCategoryIds(categoryIdsByModel.get(m.id) ?? []);
    setEditingModelId(m.id);
    setShowModelForm(true);
  }

  function toggleModelFormCategory(categoryId: string) {
    setModelFormCategoryIds((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  }

  async function syncModelCategories(modelId: string) {
    await supabase.from("model_category_links").delete().eq("model_id", modelId);

    if (modelFormCategoryIds.length === 0) {
      setCategoryLinks((prev) => prev.filter((l) => l.model_id !== modelId));
      return;
    }

    const { data, error } = await supabase
      .from("model_category_links")
      .insert(
        modelFormCategoryIds.map((categoryId) => ({
          model_id: modelId,
          category_id: categoryId,
          user_id: userId,
        }))
      )
      .select();

    if (error) {
      setError(error.message);
      return;
    }

    setCategoryLinks((prev) => [...prev.filter((l) => l.model_id !== modelId), ...(data ?? [])]);
  }

  async function handleSaveModel(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    let savedModelId: string | null = null;

    if (editingModelId) {
      const { data, error } = await supabase
        .from("product_models")
        .update(modelForm)
        .eq("id", editingModelId)
        .select()
        .single();
      if (error) {
        setSaving(false);
        return setError(error.message);
      }
      setModels((prev) => prev.map((m) => (m.id === editingModelId ? data : m)));
      savedModelId = editingModelId;
    } else {
      const { data, error } = await supabase
        .from("product_models")
        .insert({ ...modelForm, user_id: userId })
        .select()
        .single();
      if (error) {
        setSaving(false);
        return setError(error.message);
      }
      setModels((prev) => [data, ...prev]);
      savedModelId = data.id;
    }

    if (savedModelId) await syncModelCategories(savedModelId);

    setSaving(false);
    setShowModelForm(false);
    setEditingModelId(null);
  }

  async function handleDeleteModel(id: string) {
    if (!confirm("Modell wirklich löschen?")) return;
    const { error } = await supabase.from("product_models").delete().eq("id", id);
    if (error) return alert(error.message);
    setModels((prev) => prev.filter((m) => m.id !== id));
    setCategoryLinks((prev) => prev.filter((l) => l.model_id !== id));
  }

  // --- Kategorien-Verwaltung ---

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const { data, error } = await supabase
      .from("model_categories")
      .insert({ name: newCategoryName.trim(), user_id: userId })
      .select()
      .single();
    if (error) return setError(error.message);
    setCategories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setNewCategoryName("");
  }

  function startRenameCategory(c: ModelCategory) {
    setEditingCategoryId(c.id);
    setEditingCategoryName(c.name);
  }

  async function handleRenameCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCategoryId || !editingCategoryName.trim()) return;
    const { data, error } = await supabase
      .from("model_categories")
      .update({ name: editingCategoryName.trim() })
      .eq("id", editingCategoryId)
      .select()
      .single();
    if (error) return setError(error.message);
    setCategories((prev) =>
      prev
        .map((c) => (c.id === editingCategoryId ? data : c))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setEditingCategoryId(null);
    setEditingCategoryName("");
  }

  async function handleDeleteCategory(id: string) {
    if (
      !confirm(
        "Kategorie wirklich löschen? Die Zuordnung bei den Modellen wird entfernt, die Modelle selbst bleiben erhalten."
      )
    )
      return;
    const { error } = await supabase.from("model_categories").delete().eq("id", id);
    if (error) return alert(error.message);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setCategoryLinks((prev) => prev.filter((l) => l.category_id !== id));
    if (categoryFilterId === id) setCategoryFilterId(null);
  }

  // --- Filter + Sort + Gruppierung ---

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function toggleGroupCollapsed(name: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      if (selectedSupplierId && m.supplier_id !== selectedSupplierId) return false;
      if (searchModel && !m.model.toLowerCase().includes(searchModel.toLowerCase()))
        return false;
      if (specFilter !== "all" && m.spec !== specFilter) return false;
      if (categoryFilterId) {
        const ids = categoryIdsByModel.get(m.id) ?? [];
        if (!ids.includes(categoryFilterId)) return false;
      }
      return true;
    });
  }, [models, selectedSupplierId, searchModel, specFilter, categoryFilterId, categoryIdsByModel]);

  function sortModels(list: ProductModel[]): ProductModel[] {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortField === "model") return a.model.localeCompare(b.model) * dir;
      if (sortField === "purchase_price_net")
        return (a.purchase_price_net - b.purchase_price_net) * dir;
      if (sortField === "sale_price_gross")
        return (a.sale_price_gross - b.sale_price_gross) * dir;
      if (sortField === "supplier") {
        const nameA = supplierById.get(a.supplier_id)?.company_name ?? "";
        const nameB = supplierById.get(b.supplier_id)?.company_name ?? "";
        return nameA.localeCompare(nameB) * dir;
      }
      const marginA = calcModelMargin(a, paymentFeePercent).marginEur;
      const marginB = calcModelMargin(b, paymentFeePercent).marginEur;
      return (marginA - marginB) * dir;
    });
  }

  const groupedModels = useMemo(() => {
    const groups = groupModelsByName(filteredModels);
    const sortedGroups =
      sortField === "model" && sortDir === "desc" ? [...groups].reverse() : groups;
    return sortedGroups.map((g) => ({ ...g, items: sortModels(g.items) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredModels, sortField, sortDir, supplierById, paymentFeePercent]);

  const selectedSupplier = selectedSupplierId ? supplierById.get(selectedSupplierId) : null;

  function sortIndicator(field: SortField) {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Supplier &amp; Modelle</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowCategoryManager((v) => !v)} className="btn-secondary">
            🏷️ Kategorien
          </button>
          <button onClick={openNewSupplierForm} className="btn-secondary">
            + Neuer Supplier
          </button>
          <button onClick={() => openNewModelForm()} className="btn-primary">
            + Neues Modell
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-loss">{error}</p>}

      {/* Kategorien-Verwaltung */}
      {showCategoryManager && (
        <div className="card">
          <h2 className="mb-3 font-semibold">Kategorien verwalten</h2>
          <form onSubmit={handleAddCategory} className="mb-4 flex flex-wrap gap-2">
            <input
              className="input w-64"
              placeholder="Neue Kategorie, z.B. Topseller"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
            />
            <button type="submit" className="btn-primary">
              Hinzufügen
            </button>
          </form>

          {categories.length === 0 && (
            <p className="text-sm text-slate-400">Noch keine Kategorien angelegt.</p>
          )}

          <ul className="space-y-2">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                {editingCategoryId === c.id ? (
                  <form onSubmit={handleRenameCategory} className="flex flex-1 gap-2">
                    <input
                      className="input"
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      autoFocus
                    />
                    <button type="submit" className="btn-primary px-3 py-1">
                      Speichern
                    </button>
                    <button
                      type="button"
                      className="btn-secondary px-3 py-1"
                      onClick={() => setEditingCategoryId(null)}
                    >
                      Abbrechen
                    </button>
                  </form>
                ) : (
                  <>
                    <span>{c.name}</span>
                    <div className="flex gap-3">
                      <button
                        className="text-brand hover:underline"
                        onClick={() => startRenameCategory(c)}
                      >
                        Umbenennen
                      </button>
                      <button
                        className="text-loss hover:underline"
                        onClick={() => handleDeleteCategory(c.id)}
                      >
                        Löschen
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Supplier-Formular */}
      {showSupplierForm && (
        <div className="card">
          <form
            onSubmit={handleSaveSupplier}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div>
              <label className="label">Firmenname</label>
              <input
                required
                className="input"
                value={supplierForm.company_name}
                onChange={(e) =>
                  setSupplierForm((f) => ({ ...f, company_name: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Ansprechpartner</label>
              <input
                className="input"
                value={supplierForm.contact_person}
                onChange={(e) =>
                  setSupplierForm((f) => ({ ...f, contact_person: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">E-Mail</label>
              <input
                type="email"
                className="input"
                value={supplierForm.email}
                onChange={(e) => setSupplierForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Telefon / WhatsApp</label>
              <input
                className="input"
                value={supplierForm.phone}
                onChange={(e) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Discord / Telegram</label>
              <input
                className="input"
                value={supplierForm.messenger}
                onChange={(e) =>
                  setSupplierForm((f) => ({ ...f, messenger: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Land</label>
              <input
                className="input"
                value={supplierForm.country}
                onChange={(e) => setSupplierForm((f) => ({ ...f, country: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">USt-IdNr.</label>
              <input
                className="input"
                value={supplierForm.vat_id}
                onChange={(e) => setSupplierForm((f) => ({ ...f, vat_id: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Adresse</label>
              <input
                className="input"
                value={supplierForm.address}
                onChange={(e) => setSupplierForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Plattform</label>
              <input
                list="supplier-platforms"
                className="input"
                value={supplierForm.platform}
                onChange={(e) =>
                  setSupplierForm((f) => ({ ...f, platform: e.target.value }))
                }
              />
              <datalist id="supplier-platforms">
                {SUPPLIER_PLATFORMS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label">Notizen</label>
              <input
                className="input"
                value={supplierForm.notes}
                onChange={(e) => setSupplierForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div className="col-span-full flex gap-2">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Speichern…" : editingSupplierId ? "Änderungen speichern" : "Hinzufügen"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowSupplierForm(false)}
              >
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modell-Formular */}
      {showModelForm && (
        <div className="card">
          <form
            onSubmit={handleSaveModel}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div>
              <label className="label">Supplier</label>
              <select
                required
                className="input"
                value={modelForm.supplier_id}
                onChange={(e) =>
                  setModelForm((f) => ({ ...f, supplier_id: e.target.value }))
                }
              >
                <option value="" disabled>
                  Bitte wählen…
                </option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.company_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Modell</label>
              <input
                required
                className="input"
                value={modelForm.model}
                onChange={(e) => setModelForm((f) => ({ ...f, model: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Speicher</label>
              <input
                className="input"
                placeholder="z.B. 256GB"
                value={modelForm.storage}
                onChange={(e) => setModelForm((f) => ({ ...f, storage: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Farbe</label>
              <input
                className="input"
                value={modelForm.color}
                onChange={(e) => setModelForm((f) => ({ ...f, color: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Spec</label>
              <select
                required
                className="input"
                value={modelForm.spec}
                onChange={(e) =>
                  setModelForm((f) => ({ ...f, spec: e.target.value as ModelSpec }))
                }
              >
                <option value="EU">EU</option>
                <option value="US">US</option>
              </select>
            </div>
            <div>
              <label className="label">EK netto (€)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={modelForm.purchase_price_net}
                onChange={(e) =>
                  setModelForm((f) => ({
                    ...f,
                    purchase_price_net: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div>
              <label className="label">VK brutto (€)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={modelForm.sale_price_gross}
                onChange={(e) =>
                  setModelForm((f) => ({
                    ...f,
                    sale_price_gross: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div>
              <label className="label">EK-Datum</label>
              <input
                type="date"
                className="input"
                value={modelForm.purchase_date}
                onChange={(e) =>
                  setModelForm((f) => ({ ...f, purchase_date: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Notizen</label>
              <input
                className="input"
                value={modelForm.notes}
                onChange={(e) => setModelForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {categories.length > 0 && (
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="label">Kategorien</label>
                <div className="flex flex-wrap gap-3">
                  {categories.map((c) => (
                    <label key={c.id} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={modelFormCategoryIds.includes(c.id)}
                        onChange={() => toggleModelFormCategory(c.id)}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {suppliers.length === 0 && (
              <p className="col-span-full text-sm text-loss">
                Leg zuerst einen Supplier an, bevor du ein Modell erfassen kannst.
              </p>
            )}

            <div className="col-span-full flex gap-2">
              <button
                type="submit"
                className="btn-primary"
                disabled={saving || suppliers.length === 0}
              >
                {saving ? "Speichern…" : editingModelId ? "Änderungen speichern" : "Hinzufügen"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowModelForm(false)}
              >
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Supplier-Tabelle */}
      <div className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">Supplier</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Firmenname</th>
              <th>Land</th>
              <th>Plattform</th>
              <th>Ansprechpartner</th>
              <th>Modelle</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr
                key={s.id}
                className={selectedSupplierId === s.id ? "bg-brand/5" : undefined}
              >
                <td>
                  <button
                    className="text-left font-medium text-brand hover:underline"
                    onClick={() =>
                      setSelectedSupplierId((cur) => (cur === s.id ? null : s.id))
                    }
                  >
                    {s.company_name}
                  </button>
                </td>
                <td>{s.country || "–"}</td>
                <td>{s.platform || "–"}</td>
                <td>{s.contact_person || "–"}</td>
                <td>{modelCountBySupplier.get(s.id) ?? 0}</td>
                <td className="whitespace-nowrap">
                  <button
                    className="mr-2 text-sm text-brand hover:underline"
                    onClick={() => openEditSupplierForm(s)}
                  >
                    Bearbeiten
                  </button>
                  <button
                    className="text-sm text-loss hover:underline"
                    onClick={() => handleDeleteSupplier(s.id)}
                  >
                    Löschen
                  </button>
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  Noch keine Supplier erfasst.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Supplier-Detailansicht */}
      {selectedSupplier && (
        <div className="card">
          <div className="flex items-start justify-between">
            <h2 className="font-semibold">{selectedSupplier.company_name}</h2>
            <button
              className="text-sm text-slate-400 hover:underline"
              onClick={() => setSelectedSupplierId(null)}
            >
              Filter zurücksetzen
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-slate-500 dark:text-slate-400">Ansprechpartner</p>
              <p>{selectedSupplier.contact_person || "–"}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">E-Mail</p>
              <p>{selectedSupplier.email || "–"}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Telefon / WhatsApp</p>
              <p>{selectedSupplier.phone || "–"}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Discord / Telegram</p>
              <p>{selectedSupplier.messenger || "–"}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Land</p>
              <p>{selectedSupplier.country || "–"}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">USt-IdNr.</p>
              <p>{selectedSupplier.vat_id || "–"}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Adresse</p>
              <p>{selectedSupplier.address || "–"}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Plattform</p>
              <p>{selectedSupplier.platform || "–"}</p>
            </div>
            {selectedSupplier.notes && (
              <div className="sm:col-span-2 lg:col-span-3">
                <p className="text-slate-500 dark:text-slate-400">Notizen</p>
                <p>{selectedSupplier.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modelle */}
      <div className="card overflow-x-auto">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Modelle</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input w-48"
              placeholder="Suche nach Modell…"
              value={searchModel}
              onChange={(e) => setSearchModel(e.target.value)}
            />
            <select
              className="input w-48"
              value={selectedSupplierId ?? ""}
              onChange={(e) => setSelectedSupplierId(e.target.value || null)}
            >
              <option value="">Alle Supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.company_name}
                </option>
              ))}
            </select>
            <select
              className="input w-32"
              value={specFilter}
              onChange={(e) => setSpecFilter(e.target.value as "all" | ModelSpec)}
            >
              <option value="all">Alle Specs</option>
              <option value="EU">EU</option>
              <option value="US">US</option>
            </select>
            {categories.length > 0 && (
              <select
                className="input w-48"
                value={categoryFilterId ?? ""}
                onChange={(e) => setCategoryFilterId(e.target.value || null)}
              >
                <option value="">Alle Kategorien</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="mb-2 flex gap-4 text-xs text-slate-400">
          <button onClick={() => toggleSort("model")} className="hover:underline">
            Modell{sortIndicator("model")}
          </button>
          <button
            onClick={() => toggleSort("purchase_price_net")}
            className="hover:underline"
          >
            EK{sortIndicator("purchase_price_net")}
          </button>
          <button
            onClick={() => toggleSort("sale_price_gross")}
            className="hover:underline"
          >
            VK{sortIndicator("sale_price_gross")}
          </button>
          <button onClick={() => toggleSort("margin")} className="hover:underline">
            Marge{sortIndicator("margin")}
          </button>
          <button onClick={() => toggleSort("supplier")} className="hover:underline">
            Supplier{sortIndicator("supplier")}
          </button>
        </div>

        {groupedModels.map((group) => {
          const collapsed = collapsedGroups.has(group.modelName);
          return (
            <div key={group.modelName} className="mb-4">
              <button
                className="mb-2 flex w-full items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-left text-sm font-semibold hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
                onClick={() => toggleGroupCollapsed(group.modelName)}
              >
                <span>{collapsed ? "▶" : "▼"}</span>
                {group.modelName}
                <span className="font-normal text-slate-400">
                  ({group.items.length})
                </span>
              </button>

              {!collapsed && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Speicher</th>
                      <th>Farbe</th>
                      <th>Spec</th>
                      <th>EK netto</th>
                      <th>VK brutto</th>
                      <th>VK netto</th>
                      <th>Marge</th>
                      <th>Marge nach Gebühren</th>
                      <th>Kategorien</th>
                      <th>Supplier</th>
                      <th>EK-Datum</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((m) => {
                      const margin = calcModelMargin(m, paymentFeePercent);
                      const comparison = priceComparison.get(m.id);
                      const marginNegative = margin.marginEur < 0;
                      const modelCategoryNames = (categoryIdsByModel.get(m.id) ?? [])
                        .map((id) => categories.find((c) => c.id === id)?.name)
                        .filter(Boolean);

                      return (
                        <tr
                          key={m.id}
                          className={
                            marginNegative ? "bg-loss-light dark:bg-red-950/40" : undefined
                          }
                        >
                          <td>{m.storage || "–"}</td>
                          <td>{m.color || "–"}</td>
                          <td>
                            <span
                              className={
                                m.spec === "EU"
                                  ? "rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                                  : "rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-950/50 dark:text-orange-300"
                              }
                            >
                              {m.spec}
                            </span>
                          </td>
                          <td>
                            {formatEur(m.purchase_price_net)}
                            {comparison?.isCheapest && comparison.groupSize > 1 && (
                              <span
                                className="ml-1 rounded bg-profit-light px-1.5 py-0.5 text-xs font-medium text-profit dark:bg-green-950/40"
                                title="Günstigster EK in dieser Vergleichsgruppe (gleiches Modell, Speicher, Spec)"
                              >
                                Bester Preis
                              </span>
                            )}
                            {comparison && !comparison.isCheapest && comparison.groupSize > 1 && (
                              <span className="ml-1 text-xs text-loss">
                                +{formatEur(comparison.diffFromCheapest)} teurer
                              </span>
                            )}
                          </td>
                          <td>{formatEur(m.sale_price_gross)}</td>
                          <td>{formatEur(margin.vkNetto)}</td>
                          <td className={marginNegative ? "font-semibold text-loss" : ""}>
                            {formatEur(margin.marginEur)} ({formatPercent(margin.marginPercent)})
                          </td>
                          <td
                            className={
                              margin.marginAfterFeesEur < 0 ? "font-semibold text-loss" : ""
                            }
                          >
                            {formatEur(margin.marginAfterFeesEur)} (
                            {formatPercent(margin.marginAfterFeesPercent)})
                          </td>
                          <td className="max-w-[10rem] truncate" title={modelCategoryNames.join(", ")}>
                            {modelCategoryNames.length > 0 ? modelCategoryNames.join(", ") : "–"}
                          </td>
                          <td>{supplierById.get(m.supplier_id)?.company_name ?? "–"}</td>
                          <td>{m.purchase_date}</td>
                          <td className="whitespace-nowrap">
                            <button
                              className="mr-2 text-sm text-brand hover:underline"
                              onClick={() => openEditModelForm(m)}
                            >
                              Bearbeiten
                            </button>
                            <button
                              className="text-sm text-loss hover:underline"
                              onClick={() => handleDeleteModel(m.id)}
                            >
                              Löschen
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}

        {groupedModels.length === 0 && (
          <p className="py-6 text-center text-slate-400">Keine Modelle gefunden.</p>
        )}

        <p className="mt-2 text-xs text-slate-400">
          Preisvergleich und "Bester Preis" gelten je Kombination aus Modell, Speicher und
          Spec (Farbe spielt dabei keine Rolle). Marge nach Gebühren basiert auf der
          Standard-Zahlungsgebühr ({paymentFeePercent}%, einstellbar unter „Einstellungen").
          Rote Zeilen = negative Marge.
        </p>
      </div>
    </div>
  );
}
