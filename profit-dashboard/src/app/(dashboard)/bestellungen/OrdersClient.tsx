"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Order } from "@/lib/database.types";
import {
  SALES_CHANNELS,
  ORDER_STATUSES,
  CURRENCIES,
} from "@/lib/constants";
import {
  calcOrderMargin,
  isBelowThreshold,
  groupMarginByField,
  formatEur,
  formatPercent,
} from "@/lib/calculations";
import { exportToExcel, exportToPdf } from "@/lib/export";

type FormState = Omit<
  Order,
  "id" | "user_id" | "created_at" | "updated_at"
>;

function emptyForm(defaults: Record<string, number>): FormState {
  return {
    order_date: new Date().toISOString().slice(0, 10),
    product_name: "",
    sales_channel: "Shopify",
    supplier: "",
    sale_price: 0,
    purchase_price: 0,
    purchase_currency: "EUR",
    exchange_rate: 1,
    shipping_cost: 0,
    payment_fee_percent: 0,
    channel_fee_percent: defaults["Shopify"] ?? 0,
    other_costs: 0,
    status: "bestellt",
    is_return: false,
    return_cost: 0,
  };
}

export function OrdersClient({
  initialOrders,
  marginThreshold,
  channelFeeDefaults,
  userId,
}: {
  initialOrders: Order[];
  marginThreshold: number;
  channelFeeDefaults: Record<string, number>;
  userId: string;
}) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(channelFeeDefaults));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  function openNewForm() {
    setForm(emptyForm(channelFeeDefaults));
    setEditingId(null);
    setShowForm(true);
  }

  function openEditForm(order: Order) {
    const { id, user_id, created_at, updated_at, ...rest } = order;
    setForm(rest);
    setEditingId(order.id);
    setShowForm(true);
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleChannelChange(channel: string) {
    setForm((f) => ({
      ...f,
      sales_channel: channel,
      channel_fee_percent: channelFeeDefaults[channel] ?? f.channel_fee_percent,
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    if (editingId) {
      const { data, error } = await supabase
        .from("orders")
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq("id", editingId)
        .select()
        .single();

      setSaving(false);
      if (error) {
        setError(error.message);
        return;
      }
      setOrders((prev) => prev.map((o) => (o.id === editingId ? data : o)));
    } else {
      const { data, error } = await supabase
        .from("orders")
        .insert({ ...form, user_id: userId })
        .select()
        .single();

      setSaving(false);
      if (error) {
        setError(error.message);
        return;
      }
      setOrders((prev) => [data, ...prev]);
    }

    setShowForm(false);
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Bestellung wirklich löschen?")) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }

  const sums = useMemo(() => {
    let revenue = 0;
    let costs = 0;
    for (const o of orders) {
      const m = calcOrderMargin(o);
      revenue += m.revenue;
      costs += m.totalCosts;
    }
    return { revenue, costs, profit: revenue - costs };
  }, [orders]);

  const byChannel = useMemo(
    () => groupMarginByField(orders, "sales_channel"),
    [orders]
  );
  const bySupplier = useMemo(
    () => groupMarginByField(orders, "supplier"),
    [orders]
  );

  async function handleExportExcel() {
    const rows = orders.map((o) => {
      const m = calcOrderMargin(o);
      return {
        Datum: o.order_date,
        Produkt: o.product_name,
        Kanal: o.sales_channel,
        Lieferant: o.supplier,
        Status: o.status,
        Verkaufspreis: o.sale_price,
        Einkaufspreis: o.purchase_price,
        "Marge (€)": Number(m.marginEur.toFixed(2)),
        "Marge (%)": m.marginPercent !== null ? Number(m.marginPercent.toFixed(1)) : "",
      };
    });
    await exportToExcel(rows, "bestellungen");
  }

  function handleExportPdf() {
    const headers = ["Datum", "Produkt", "Kanal", "Marge €", "Marge %"];
    const rows = orders.map((o) => {
      const m = calcOrderMargin(o);
      return [
        o.order_date,
        o.product_name,
        o.sales_channel,
        formatEur(m.marginEur),
        formatPercent(m.marginPercent),
      ];
    });
    exportToPdf("Bestellungen", headers, rows, "bestellungen");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Bestellungen</h1>
        <div className="flex gap-2">
          <button onClick={handleExportExcel} className="btn-secondary">
            Excel
          </button>
          <button onClick={handleExportPdf} className="btn-secondary">
            PDF
          </button>
          <button onClick={openNewForm} className="btn-primary">
            + Neue Bestellung
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card">
          <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label">Datum</label>
              <input
                type="date"
                required
                className="input"
                value={form.order_date}
                onChange={(e) => updateField("order_date", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Produktname</label>
              <input
                required
                className="input"
                value={form.product_name}
                onChange={(e) => updateField("product_name", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Verkaufskanal</label>
              <select
                className="input"
                value={form.sales_channel}
                onChange={(e) => handleChannelChange(e.target.value)}
              >
                {SALES_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Lieferant</label>
              <input
                className="input"
                value={form.supplier}
                onChange={(e) => updateField("supplier", e.target.value)}
              />
            </div>

            <div>
              <label className="label">Verkaufspreis (€)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={form.sale_price}
                onChange={(e) =>
                  updateField("sale_price", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <label className="label">Einkaufspreis</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={form.purchase_price}
                onChange={(e) =>
                  updateField("purchase_price", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <label className="label">Einkaufswährung</label>
              <select
                className="input"
                value={form.purchase_currency}
                onChange={(e) => updateField("purchase_currency", e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {form.purchase_currency !== "EUR" && (
              <div>
                <label className="label">Wechselkurs (→ EUR)</label>
                <input
                  type="number"
                  step="0.0001"
                  className="input"
                  value={form.exchange_rate}
                  onChange={(e) =>
                    updateField("exchange_rate", parseFloat(e.target.value) || 0)
                  }
                />
              </div>
            )}

            <div>
              <label className="label">Versandkosten (€)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={form.shipping_cost}
                onChange={(e) =>
                  updateField("shipping_cost", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <label className="label">Zahlungsgebühr (%)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={form.payment_fee_percent}
                onChange={(e) =>
                  updateField(
                    "payment_fee_percent",
                    parseFloat(e.target.value) || 0
                  )
                }
              />
            </div>
            <div>
              <label className="label">Kanalgebühr / Provision (%)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={form.channel_fee_percent}
                onChange={(e) =>
                  updateField(
                    "channel_fee_percent",
                    parseFloat(e.target.value) || 0
                  )
                }
              />
            </div>
            <div>
              <label className="label">Sonstige Kosten (€)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={form.other_costs}
                onChange={(e) =>
                  updateField("other_costs", parseFloat(e.target.value) || 0)
                }
              />
            </div>

            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => updateField("status", e.target.value)}
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.is_return}
                  onChange={(e) => updateField("is_return", e.target.checked)}
                />
                Retoure
              </label>
            </div>
            {form.is_return && (
              <div>
                <label className="label">Retourkosten (€)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={form.return_cost}
                  onChange={(e) =>
                    updateField("return_cost", parseFloat(e.target.value) || 0)
                  }
                />
              </div>
            )}

            {error && (
              <p className="col-span-full text-sm text-loss">{error}</p>
            )}

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
              <th>Datum</th>
              <th>Produkt</th>
              <th>Kanal</th>
              <th>Lieferant</th>
              <th>Status</th>
              <th>Verkauf</th>
              <th>Einkauf</th>
              <th>Marge €</th>
              <th>Marge %</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const m = calcOrderMargin(o);
              const warn = isBelowThreshold(m, marginThreshold);
              return (
                <tr key={o.id} className={warn ? "bg-loss-light" : undefined}>
                  <td>{o.order_date}</td>
                  <td>{o.product_name}</td>
                  <td>{o.sales_channel}</td>
                  <td>{o.supplier || "–"}</td>
                  <td>
                    {o.status}
                    {o.is_return && (
                      <span className="ml-1 rounded bg-loss-light px-1.5 py-0.5 text-xs text-loss">
                        Retoure
                      </span>
                    )}
                  </td>
                  <td>{formatEur(o.sale_price)}</td>
                  <td>{formatEur(o.purchase_price)}</td>
                  <td className={warn ? "font-semibold text-loss" : ""}>
                    {formatEur(m.marginEur)}
                  </td>
                  <td className={warn ? "font-semibold text-loss" : ""}>
                    {formatPercent(m.marginPercent)}
                  </td>
                  <td className="whitespace-nowrap">
                    <button
                      className="mr-2 text-sm text-brand hover:underline"
                      onClick={() => openEditForm(o)}
                    >
                      Bearbeiten
                    </button>
                    <button
                      className="text-sm text-loss hover:underline"
                      onClick={() => handleDelete(o.id)}
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={10} className="py-6 text-center text-slate-400">
                  Noch keine Bestellungen erfasst.
                </td>
              </tr>
            )}
          </tbody>
          {orders.length > 0 && (
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={5}>Summe</td>
                <td colSpan={2}>Umsatz: {formatEur(sums.revenue)}</td>
                <td colSpan={2}>
                  Kosten: {formatEur(sums.costs)}
                </td>
                <td
                  className={sums.profit >= 0 ? "text-profit" : "text-loss"}
                >
                  Gewinn: {formatEur(sums.profit)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold">Marge nach Verkaufskanal</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Kanal</th>
                <th>Umsatz</th>
                <th>Gewinn</th>
              </tr>
            </thead>
            <tbody>
              {byChannel.map((row) => (
                <tr key={row.key}>
                  <td>{row.key}</td>
                  <td>{formatEur(row.revenue)}</td>
                  <td className={row.profit >= 0 ? "text-profit" : "text-loss"}>
                    {formatEur(row.profit)}
                  </td>
                </tr>
              ))}
              {byChannel.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-slate-400">
                    Keine Daten
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold">Marge nach Lieferant</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Lieferant</th>
                <th>Umsatz</th>
                <th>Gewinn</th>
              </tr>
            </thead>
            <tbody>
              {bySupplier.map((row) => (
                <tr key={row.key}>
                  <td>{row.key}</td>
                  <td>{formatEur(row.revenue)}</td>
                  <td className={row.profit >= 0 ? "text-profit" : "text-loss"}>
                    {formatEur(row.profit)}
                  </td>
                </tr>
              ))}
              {bySupplier.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-slate-400">
                    Keine Daten
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
