"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import type { Order, FixedCost, BankTransaction } from "@/lib/database.types";
import {
  resolvePeriodRange,
  filterOrdersByPeriod,
  bankTransactionsForPeriod,
  fixedCostsForPeriod,
  summarizeOrders,
  vatReserve,
  forecastCurrentMonth,
  groupMarginByField,
  profitByMonth,
  formatEur,
  formatPercent,
  type PeriodKey,
} from "@/lib/calculations";
import { PeriodSelector } from "@/components/PeriodSelector";
import { KpiCard } from "@/components/KpiCard";
import { exportToExcel, exportToPdf } from "@/lib/export";

const CHART_COLORS = ["#4f46e5", "#16a34a", "#f59e0b", "#dc2626", "#0ea5e9", "#a855f7"];

export function DashboardClient({
  orders,
  fixedCosts,
  bankTransactions,
  vatRate,
  marginThreshold,
}: {
  orders: Order[];
  fixedCosts: FixedCost[];
  bankTransactions: BankTransaction[];
  vatRate: number;
  marginThreshold: number;
}) {
  const [period, setPeriod] = useState<PeriodKey>("this-month");
  const [customFrom, setCustomFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10)
  );
  const [customTo, setCustomTo] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const { from, to } = resolvePeriodRange(period, {
    from: customFrom,
    to: customTo,
  });

  const periodOrders = useMemo(
    () => filterOrdersByPeriod(orders, from, to),
    [orders, from, to]
  );
  const periodBankTx = useMemo(
    () => bankTransactionsForPeriod(bankTransactions, from, to),
    [bankTransactions, from, to]
  );
  const periodFixedCosts = useMemo(
    () => fixedCostsForPeriod(fixedCosts, from, to),
    [fixedCosts, from, to]
  );

  const orderTotals = useMemo(() => summarizeOrders(periodOrders), [periodOrders]);

  const bankIncome = periodBankTx
    .filter((t) => t.type === "einnahme")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const bankExpense = periodBankTx
    .filter((t) => t.type === "ausgabe")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalRevenue = orderTotals.revenue + bankIncome;
  const totalCosts = orderTotals.costs + periodFixedCosts + bankExpense;
  const totalProfit = totalRevenue - totalCosts;
  const totalMarginPercent =
    totalRevenue !== 0 ? (totalProfit / totalRevenue) * 100 : null;

  const reserve = vatReserve(totalProfit, vatRate);
  const forecast = useMemo(() => forecastCurrentMonth(orders), [orders]);

  const byChannel = useMemo(
    () => groupMarginByField(periodOrders, "sales_channel"),
    [periodOrders]
  );
  const monthlyProfit = useMemo(() => profitByMonth(orders), [orders]);

  async function handleExportExcel() {
    await exportToExcel(
      [
        { Kennzahl: "Gesamtumsatz", Wert: totalRevenue },
        { Kennzahl: "Gesamtkosten", Wert: totalCosts },
        { Kennzahl: "Gesamtgewinn", Wert: totalProfit },
        { Kennzahl: "Marge %", Wert: totalMarginPercent ?? 0 },
        { Kennzahl: "USt-Rücklage", Wert: reserve },
        ...byChannel.map((c) => ({
          Kennzahl: `Gewinn – ${c.key}`,
          Wert: c.profit,
        })),
      ],
      "uebersicht"
    );
  }

  function handleExportPdf() {
    exportToPdf(
      "Gewinn-Übersicht Lumox.store",
      ["Kennzahl", "Wert"],
      [
        ["Gesamtumsatz", formatEur(totalRevenue)],
        ["Gesamtkosten", formatEur(totalCosts)],
        ["Gesamtgewinn", formatEur(totalProfit)],
        ["Marge", formatPercent(totalMarginPercent)],
        ["USt-Rücklage", formatEur(reserve)],
      ],
      "uebersicht"
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Übersicht</h1>
        <div className="flex gap-2">
          <button onClick={handleExportExcel} className="btn-secondary">
            Excel
          </button>
          <button onClick={handleExportPdf} className="btn-secondary">
            PDF
          </button>
        </div>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Gesamtumsatz" value={formatEur(totalRevenue)} />
        <KpiCard label="Gesamtkosten" value={formatEur(totalCosts)} />
        <KpiCard
          label="Gesamtgewinn"
          value={formatEur(totalProfit)}
          tone={totalProfit >= 0 ? "profit" : "loss"}
          sub={`Marge: ${formatPercent(totalMarginPercent)}`}
        />
        <KpiCard
          label={`USt-Rücklage (${vatRate}%)`}
          value={formatEur(reserve)}
          sub="vom Gewinn zurücklegen"
        />
      </div>

      <div className="card">
        <p className="text-sm text-slate-500">Prognose laufender Monat</p>
        <p
          className={`mt-1 text-lg font-semibold ${
            forecast.projectedProfit >= 0 ? "text-profit" : "text-loss"
          }`}
        >
          Bei aktuellem Tempo ca. {formatEur(forecast.projectedProfit)} Gewinn diesen Monat
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Basis: Tag {forecast.daysElapsed} von {forecast.daysInMonth}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold">Gewinn-Entwicklung (Bestellungen)</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyProfit}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatEur(v)} />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={false}
                  name="Gewinn"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold">Umsatz &amp; Gewinn pro Kanal</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byChannel.map((c) => ({ name: c.key, ...c }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatEur(v)} />
                <Legend />
                <Bar dataKey="revenue" fill={CHART_COLORS[0]} name="Umsatz" />
                <Bar dataKey="profit" fill={CHART_COLORS[1]} name="Gewinn" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Margen-Warnschwelle aktuell {marginThreshold}% – Bestellungen darunter
        werden in der Bestellungen-Tabelle rot markiert.
      </p>
    </div>
  );
}
