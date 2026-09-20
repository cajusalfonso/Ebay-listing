"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { FixedCost } from "@/lib/database.types";
import { FIXED_COST_CATEGORIES, FIXED_COST_RHYTHMS } from "@/lib/constants";
import {
  formatEur,
  resolvePeriodRange,
  fixedCostsForPeriod,
  type PeriodKey,
} from "@/lib/calculations";
import { PeriodSelector } from "@/components/PeriodSelector";

type FormState = Omit<FixedCost, "id" | "user_id" | "created_at">;

function emptyForm(): FormState {
  return {
    label: "",
    category: "Sonstiges",
    amount: 0,
    rhythm: "monatlich",
    start_date: new Date().toISOString().slice(0, 10),
  };
}

export function FixedCostsClient({
  initialFixedCosts,
  userId,
}: {
  initialFixedCosts: FixedCost[];
  userId: string;
}) {
  const [items, setItems] = useState<FixedCost[]>(initialFixedCosts);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState<PeriodKey>("this-month");
  const [customFrom, setCustomFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10)
  );
  const [customTo, setCustomTo] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const supabase = createClient();

  const { from, to } = resolvePeriodRange(period, {
    from: customFrom,
    to: customTo,
  });
  const periodTotal = useMemo(
    () => fixedCostsForPeriod(items, from, to),
    [items, from, to]
  );

  function openNewForm() {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
  }

  function openEditForm(fc: FixedCost) {
    const { id, user_id, created_at, ...rest } = fc;
    setForm(rest);
    setEditingId(fc.id);
    setShowForm(true);
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (editingId) {
      const { data, error } = await supabase
        .from("fixed_costs")
        .update(form)
        .eq("id", editingId)
        .select()
        .single();
      setSaving(false);
      if (error) return setError(error.message);
      setItems((prev) => prev.map((i) => (i.id === editingId ? data : i)));
    } else {
      const { data, error } = await supabase
        .from("fixed_costs")
        .insert({ ...form, user_id: userId })
        .select()
        .single();
      setSaving(false);
      if (error) return setError(error.message);
      setItems((prev) => [data, ...prev]);
    }

    setShowForm(false);
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Kosten-Eintrag wirklich löschen?")) return;
    const { error } = await supabase.from("fixed_costs").delete().eq("id", id);
    if (error) return alert(error.message);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Kosten</h1>
        <button onClick={openNewForm} className="btn-primary">
          + Neue Kosten
        </button>
      </div>

      <PeriodSelector
        value={period}
        onChange={setPeriod}
        customFrom={customFrom}
        customTo={customTo}
        onCustomChange={(f, t) => {
          setCustomFrom(f);
          setCustomTo(t);
        }}
      />

      <div className="card inline-block">
        <p className="text-sm text-slate-500 dark:text-slate-400">Kosten im gewählten Zeitraum</p>
        <p className="text-2xl font-bold">{formatEur(periodTotal)}</p>
      </div>

      {showForm && (
        <div className="card">
          <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label">Bezeichnung</label>
              <input
                required
                className="input"
                value={form.label}
                onChange={(e) => updateField("label", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Kategorie</label>
              <select
                className="input"
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
              >
                {FIXED_COST_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Betrag (€)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={form.amount}
                onChange={(e) =>
                  updateField("amount", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <label className="label">Rhythmus</label>
              <select
                className="input"
                value={form.rhythm}
                onChange={(e) => updateField("rhythm", e.target.value)}
              >
                {FIXED_COST_RHYTHMS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">
                {form.rhythm === "monatlich" ? "Startdatum" : "Datum"}
              </label>
              <input
                type="date"
                className="input"
                value={form.start_date}
                onChange={(e) => updateField("start_date", e.target.value)}
              />
            </div>

            {error && <p className="col-span-full text-sm text-loss">{error}</p>}

            <div className="col-span-full flex gap-2">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Speichern…" : editingId ? "Änderungen speichern" : "Hinzufügen"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowForm(false)}
              >
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Bezeichnung</th>
              <th>Kategorie</th>
              <th>Betrag</th>
              <th>Rhythmus</th>
              <th>Start</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((fc) => (
              <tr key={fc.id}>
                <td>{fc.label}</td>
                <td>{fc.category}</td>
                <td>{formatEur(fc.amount)}</td>
                <td>{fc.rhythm}</td>
                <td>{fc.start_date}</td>
                <td className="whitespace-nowrap">
                  <button
                    className="mr-2 text-sm text-brand hover:underline"
                    onClick={() => openEditForm(fc)}
                  >
                    Bearbeiten
                  </button>
                  <button
                    className="text-sm text-loss hover:underline"
                    onClick={() => handleDelete(fc.id)}
                  >
                    Löschen
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  Noch keine Kosten erfasst.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
