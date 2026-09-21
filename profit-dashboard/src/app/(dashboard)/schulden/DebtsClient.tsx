"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Debt, DebtPayment } from "@/lib/database.types";
import { debtPaidAmount, debtRemaining, formatEur, summarizeDebts } from "@/lib/calculations";

type DebtForm = { label: string; total_amount: number; notes: string };
type PaymentForm = { payment_date: string; amount: number; note: string };

function emptyDebtForm(): DebtForm {
  return { label: "", total_amount: 0, notes: "" };
}

function emptyPaymentForm(): PaymentForm {
  return {
    payment_date: new Date().toISOString().slice(0, 10),
    amount: 0,
    note: "",
  };
}

export function DebtsClient({
  initialDebts,
  initialPayments,
  userId,
}: {
  initialDebts: Debt[];
  initialPayments: DebtPayment[];
  userId: string;
}) {
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  const [payments, setPayments] = useState<DebtPayment[]>(initialPayments);

  const [showDebtForm, setShowDebtForm] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [debtForm, setDebtForm] = useState<DebtForm>(emptyDebtForm());

  const [paymentDebtId, setPaymentDebtId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(emptyPaymentForm());

  const [expandedDebtId, setExpandedDebtId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const summary = useMemo(() => summarizeDebts(debts, payments), [debts, payments]);

  function openNewDebtForm() {
    setDebtForm(emptyDebtForm());
    setEditingDebtId(null);
    setShowDebtForm(true);
  }

  function openEditDebtForm(debt: Debt) {
    setDebtForm({
      label: debt.label,
      total_amount: debt.total_amount,
      notes: debt.notes,
    });
    setEditingDebtId(debt.id);
    setShowDebtForm(true);
  }

  async function handleSaveDebt(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (editingDebtId) {
      const { data, error } = await supabase
        .from("debts")
        .update(debtForm)
        .eq("id", editingDebtId)
        .select()
        .single();
      setSaving(false);
      if (error) return setError(error.message);
      setDebts((prev) => prev.map((d) => (d.id === editingDebtId ? data : d)));
    } else {
      const { data, error } = await supabase
        .from("debts")
        .insert({ ...debtForm, user_id: userId })
        .select()
        .single();
      setSaving(false);
      if (error) return setError(error.message);
      setDebts((prev) => [data, ...prev]);
    }

    setShowDebtForm(false);
    setEditingDebtId(null);
  }

  async function handleDeleteDebt(id: string) {
    if (!confirm("Schuld inkl. aller Zahlungen wirklich löschen?")) return;
    const { error } = await supabase.from("debts").delete().eq("id", id);
    if (error) return alert(error.message);
    setDebts((prev) => prev.filter((d) => d.id !== id));
    setPayments((prev) => prev.filter((p) => p.debt_id !== id));
  }

  function openPaymentForm(debtId: string) {
    setPaymentForm(emptyPaymentForm());
    setPaymentDebtId(debtId);
  }

  async function handleSavePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentDebtId) return;
    setSaving(true);
    setError(null);

    const { data, error } = await supabase
      .from("debt_payments")
      .insert({ ...paymentForm, debt_id: paymentDebtId, user_id: userId })
      .select()
      .single();

    setSaving(false);
    if (error) return setError(error.message);

    setPayments((prev) => [data, ...prev]);
    setPaymentDebtId(null);
    setExpandedDebtId(paymentDebtId);
  }

  async function handleDeletePayment(id: string) {
    if (!confirm("Zahlung wirklich löschen?")) return;
    const { error } = await supabase.from("debt_payments").delete().eq("id", id);
    if (error) return alert(error.message);
    setPayments((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Schulden</h1>
        <button onClick={openNewDebtForm} className="btn-primary">
          + Neue Schuld
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-sm text-slate-500 dark:text-slate-400">Gesamtschulden</p>
          <p className="mt-1 text-2xl font-bold">{formatEur(summary.totalDebt)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500 dark:text-slate-400">Bereits abbezahlt</p>
          <p className="mt-1 text-2xl font-bold text-profit">{formatEur(summary.totalPaid)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500 dark:text-slate-400">Noch offen</p>
          <p className="mt-1 text-2xl font-bold text-loss">{formatEur(summary.totalRemaining)}</p>
        </div>
      </div>

      {showDebtForm && (
        <div className="card">
          <form onSubmit={handleSaveDebt} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Bezeichnung (z.B. Gläubiger)</label>
              <input
                required
                className="input"
                value={debtForm.label}
                onChange={(e) => setDebtForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Gesamtbetrag (€)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={debtForm.total_amount}
                onChange={(e) =>
                  setDebtForm((f) => ({
                    ...f,
                    total_amount: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div>
              <label className="label">Notizen</label>
              <input
                className="input"
                value={debtForm.notes}
                onChange={(e) => setDebtForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {error && <p className="col-span-full text-sm text-loss">{error}</p>}

            <div className="col-span-full flex gap-2">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Speichern…" : editingDebtId ? "Änderungen speichern" : "Hinzufügen"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowDebtForm(false)}
              >
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {debts.map((debt) => {
          const paid = debtPaidAmount(debt.id, payments);
          const remaining = debtRemaining(debt, payments);
          const percentPaid =
            debt.total_amount > 0
              ? Math.min(100, Math.max(0, (paid / debt.total_amount) * 100))
              : 0;
          const debtPayments = payments
            .filter((p) => p.debt_id === debt.id)
            .sort((a, b) => b.payment_date.localeCompare(a.payment_date));

          return (
            <div key={debt.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{debt.label}</p>
                  {debt.notes && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{debt.notes}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    className="text-sm text-brand hover:underline"
                    onClick={() => openPaymentForm(debt.id)}
                  >
                    + Zahlung eintragen
                  </button>
                  <button
                    className="text-sm text-brand hover:underline"
                    onClick={() => openEditDebtForm(debt)}
                  >
                    Bearbeiten
                  </button>
                  <button
                    className="text-sm text-loss hover:underline"
                    onClick={() => handleDeleteDebt(debt.id)}
                  >
                    Löschen
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Gesamt</p>
                  <p className="font-medium">{formatEur(debt.total_amount)}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Bezahlt</p>
                  <p className="font-medium text-profit">{formatEur(paid)}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Offen</p>
                  <p className={`font-medium ${remaining <= 0 ? "text-profit" : "text-loss"}`}>
                    {formatEur(remaining)}
                  </p>
                </div>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-profit transition-all"
                  style={{ width: `${percentPaid}%` }}
                />
              </div>

              {paymentDebtId === debt.id && (
                <form
                  onSubmit={handleSavePayment}
                  className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-4"
                >
                  <div>
                    <label className="label">Datum</label>
                    <input
                      type="date"
                      required
                      className="input"
                      value={paymentForm.payment_date}
                      onChange={(e) =>
                        setPaymentForm((f) => ({ ...f, payment_date: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Betrag (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={paymentForm.amount}
                      onChange={(e) =>
                        setPaymentForm((f) => ({
                          ...f,
                          amount: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Notiz</label>
                    <input
                      className="input"
                      value={paymentForm.note}
                      onChange={(e) =>
                        setPaymentForm((f) => ({ ...f, note: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button type="submit" className="btn-primary" disabled={saving}>
                      Speichern
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setPaymentDebtId(null)}
                    >
                      Abbrechen
                    </button>
                  </div>
                </form>
              )}

              {debtPayments.length > 0 && (
                <div className="mt-3">
                  <button
                    className="text-sm text-slate-500 hover:underline dark:text-slate-400"
                    onClick={() =>
                      setExpandedDebtId((cur) => (cur === debt.id ? null : debt.id))
                    }
                  >
                    {expandedDebtId === debt.id
                      ? "Zahlungen ausblenden"
                      : `${debtPayments.length} Zahlung(en) anzeigen`}
                  </button>
                  {expandedDebtId === debt.id && (
                    <table className="data-table mt-2">
                      <thead>
                        <tr>
                          <th>Datum</th>
                          <th>Betrag</th>
                          <th>Notiz</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {debtPayments.map((p) => (
                          <tr key={p.id}>
                            <td>{p.payment_date}</td>
                            <td>{formatEur(p.amount)}</td>
                            <td>{p.note || "–"}</td>
                            <td>
                              <button
                                className="text-sm text-loss hover:underline"
                                onClick={() => handleDeletePayment(p.id)}
                              >
                                Löschen
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {debts.length === 0 && (
          <div className="card text-center text-slate-400">
            Noch keine Schulden erfasst.
          </div>
        )}
      </div>
    </div>
  );
}
