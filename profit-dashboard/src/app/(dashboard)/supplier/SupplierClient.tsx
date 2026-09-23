"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Supplier, ProductModel } from "@/lib/database.types";
import { SUPPLIER_PLATFORMS } from "@/lib/constants";
import {
  calcModelMargin,
  cheapestModelIdsByVariant,
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
  };
}

type SortField = "model" | "purchase_price_net" | "sale_price_gross" | "margin" | "supplier";

export function SupplierClient({
  initialSuppliers,
  initialModels,
  paymentFeePercent,
  userId,
}: {
  initialSuppliers: Supplier[];
  initialModels: ProductModel[];
  paymentFeePercent: number;
  userId: string;
}) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [models, setModels] = useState<ProductModel[]>(initialModels);

  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(emptySupplierForm());

  const [showModelForm, setShowModelForm] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [modelForm, setModelForm] = useState<ModelForm>(
    emptyModelForm(initialSuppliers[0]?.id ?? "")
  );

  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [searchModel, setSearchModel] = useState("");
  const [sortField, setSortField] = useState<SortField>("model");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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

  const cheapestIds = useMemo(() => cheapestModelIdsByVariant(models), [models]);

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
    setEditingModelId(null);
    setShowModelForm(true);
  }

  function openEditModelForm(m: ProductModel) {
    const { id, user_id, created_at, ...rest } = m;
    setModelForm(rest);
    setEditingModelId(m.id);
    setShowModelForm(true);
  }

  async function handleSaveModel(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (editingModelId) {
      const { data, error } = await supabase
        .from("product_models")
        .update(modelForm)
        .eq("id", editingModelId)
        .select()
        .single();
      setSaving(false);
      if (error) return setError(error.message);
      setModels((prev) => prev.map((m) => (m.id === editingModelId ? data : m)));
    } else {
      const { data, error } = await supabase
        .from("product_models")
        .insert({ ...modelForm, user_id: userId })
        .select()
        .single();
      setSaving(false);
      if (error) return setError(error.message);
      setModels((prev) => [data, ...prev]);
    }

    setShowModelForm(false);
    setEditingModelId(null);
  }

  async function handleDeleteModel(id: string) {
    if (!confirm("Modell wirklich löschen?")) return;
    const { error } = await supabase.from("product_models").delete().eq("id", id);
    if (error) return alert(error.message);
    setModels((prev) => prev.filter((m) => m.id !== id));
  }

  // --- Filter + Sort ---

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      if (selectedSupplierId && m.supplier_id !== selectedSupplierId) return false;
      if (searchModel && !m.model.toLowerCase().includes(searchModel.toLowerCase()))
        return false;
      return true;
    });
  }, [models, selectedSupplierId, searchModel]);

  const sortedModels = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filteredModels].sort((a, b) => {
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
      // margin
      const marginA = calcModelMargin(a, paymentFeePercent).marginEur;
      const marginB = calcModelMargin(b, paymentFeePercent).marginEur;
      return (marginA - marginB) * dir;
    });
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
        <div className="flex gap-2">
          <button onClick={openNewSupplierForm} className="btn-secondary">
            + Neuer Supplier
          </button>
          <button onClick={() => openNewModelForm()} className="btn-primary">
            + Neues Modell
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-loss">{error}</p>}

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

      {/* Modelle-Tabelle */}
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
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th className="cursor-pointer select-none" onClick={() => toggleSort("model")}>
                Modell{sortIndicator("model")}
              </th>
              <th>Speicher</th>
              <th>Farbe</th>
              <th
                className="cursor-pointer select-none"
                onClick={() => toggleSort("purchase_price_net")}
              >
                EK netto{sortIndicator("purchase_price_net")}
              </th>
              <th
                className="cursor-pointer select-none"
                onClick={() => toggleSort("sale_price_gross")}
              >
                VK brutto{sortIndicator("sale_price_gross")}
              </th>
              <th>VK netto</th>
              <th className="cursor-pointer select-none" onClick={() => toggleSort("margin")}>
                Marge{sortIndicator("margin")}
              </th>
              <th>Marge nach Gebühren</th>
              <th
                className="cursor-pointer select-none"
                onClick={() => toggleSort("supplier")}
              >
                Supplier{sortIndicator("supplier")}
              </th>
              <th>EK-Datum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedModels.map((m) => {
              const margin = calcModelMargin(m, paymentFeePercent);
              const isCheapest = cheapestIds.has(m.id);
              const marginNegative = margin.marginEur < 0;
              return (
                <tr key={m.id} className={marginNegative ? "bg-loss-light dark:bg-red-950/40" : undefined}>
                  <td>{m.model}</td>
                  <td>{m.storage || "–"}</td>
                  <td>{m.color || "–"}</td>
                  <td className={isCheapest ? "font-semibold text-profit" : undefined}>
                    {formatEur(m.purchase_price_net)}
                    {isCheapest && (
                      <span
                        className="ml-1 rounded bg-profit-light px-1.5 py-0.5 text-xs text-profit dark:bg-green-950/40"
                        title="Günstigster EK für diese Variante"
                      >
                        günstigster EK
                      </span>
                    )}
                  </td>
                  <td>{formatEur(m.sale_price_gross)}</td>
                  <td>{formatEur(margin.vkNetto)}</td>
                  <td className={marginNegative ? "font-semibold text-loss" : ""}>
                    {formatEur(margin.marginEur)} ({formatPercent(margin.marginPercent)})
                  </td>
                  <td className={margin.marginAfterFeesEur < 0 ? "font-semibold text-loss" : ""}>
                    {formatEur(margin.marginAfterFeesEur)} (
                    {formatPercent(margin.marginAfterFeesPercent)})
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
            {sortedModels.length === 0 && (
              <tr>
                <td colSpan={11} className="py-6 text-center text-slate-400">
                  Keine Modelle gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-400">
          Marge nach Gebühren basiert auf der Standard-Zahlungsgebühr ({paymentFeePercent}%,
          einstellbar unter „Einstellungen"). Rote Zeilen = negative Marge.
        </p>
      </div>
    </div>
  );
}
