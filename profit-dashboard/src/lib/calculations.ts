import type {
  Order,
  FixedCost,
  BankTransaction,
  Debt,
  DebtPayment,
} from "@/lib/database.types";

export type OrderMargin = {
  revenue: number;
  purchasePriceEur: number;
  paymentFee: number;
  totalCosts: number;
  marginEur: number;
  marginPercent: number | null;
};

export function calcOrderMargin(order: Order): OrderMargin {
  const purchasePriceEur = order.purchase_price * (order.exchange_rate || 1);
  const revenue = order.is_return ? 0 : order.sale_price;
  const paymentFee = order.sale_price * (order.payment_fee_percent / 100);

  const totalCosts =
    purchasePriceEur +
    order.shipping_cost +
    paymentFee +
    order.other_costs +
    (order.is_return ? order.return_cost : 0);

  const marginEur = revenue - totalCosts;
  const marginPercent = revenue !== 0 ? (marginEur / revenue) * 100 : null;

  return {
    revenue,
    purchasePriceEur,
    paymentFee,
    totalCosts,
    marginEur,
    marginPercent,
  };
}

export function isBelowThreshold(
  margin: OrderMargin,
  thresholdPercent: number
): boolean {
  if (margin.marginPercent === null) return margin.marginEur < 0;
  return margin.marginPercent < thresholdPercent;
}

export type PeriodKey = "this-month" | "last-month" | "all" | "custom";

export function resolvePeriodRange(
  key: PeriodKey,
  custom?: { from: string; to: string }
): { from: Date; to: Date } {
  const now = new Date();

  if (key === "custom" && custom) {
    return { from: new Date(custom.from), to: new Date(custom.to) };
  }

  if (key === "this-month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { from, to };
  }

  if (key === "last-month") {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { from, to };
  }

  return { from: new Date(2000, 0, 1), to: new Date(2100, 0, 1) };
}

export function isDateInRange(dateStr: string, from: Date, to: Date): boolean {
  const d = new Date(dateStr);
  return d >= from && d <= to;
}

export function filterOrdersByPeriod(
  orders: Order[],
  from: Date,
  to: Date
): Order[] {
  return orders.filter((o) => isDateInRange(o.order_date, from, to));
}

/** Anzahl Monate (inkl. angebrochener) zwischen zwei Daten, mindestens 1. */
export function monthsBetween(from: Date, to: Date): number {
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth()) +
    1;
  return Math.max(1, months);
}

export function fixedCostsForPeriod(
  fixedCosts: FixedCost[],
  from: Date,
  to: Date
): number {
  let total = 0;
  for (const fc of fixedCosts) {
    const start = new Date(fc.start_date);
    if (fc.rhythm === "einmalig") {
      if (start >= from && start <= to) total += fc.amount;
      continue;
    }
    // monatlich: fuer jeden Monat im Zeitraum ab start_date einmal zaehlen
    const effectiveFrom = start > from ? start : from;
    if (effectiveFrom > to) continue;
    total += fc.amount * monthsBetween(effectiveFrom, to);
  }
  return total;
}

export function bankTransactionsForPeriod(
  txs: BankTransaction[],
  from: Date,
  to: Date
): BankTransaction[] {
  return txs.filter((t) => isDateInRange(t.tx_date, from, to));
}

export type DashboardTotals = {
  revenue: number;
  costs: number;
  profit: number;
  marginPercent: number | null;
};

export function summarizeOrders(orders: Order[]): DashboardTotals {
  let revenue = 0;
  let costs = 0;
  for (const o of orders) {
    const m = calcOrderMargin(o);
    revenue += m.revenue;
    costs += m.totalCosts;
  }
  const profit = revenue - costs;
  return {
    revenue,
    costs,
    profit,
    marginPercent: revenue !== 0 ? (profit / revenue) * 100 : null,
  };
}

export function vatReserve(profit: number, vatRatePercent: number): number {
  if (profit <= 0) return 0;
  return profit * (vatRatePercent / 100);
}

/** Einfache Hochrechnung: Gewinn/Tag bisher im laufenden Monat * Tage im Monat. */
export function forecastCurrentMonth(orders: Order[]): {
  projectedProfit: number;
  daysElapsed: number;
  daysInMonth: number;
} {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = now;
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0
  ).getDate();
  const daysElapsed = now.getDate();

  const monthOrders = filterOrdersByPeriod(orders, from, to);
  const { profit } = summarizeOrders(monthOrders);
  const perDay = daysElapsed > 0 ? profit / daysElapsed : 0;
  const projectedProfit = perDay * daysInMonth;

  return { projectedProfit, daysElapsed, daysInMonth };
}

export function groupMarginByField(
  orders: Order[],
  field: "sales_channel" | "supplier"
): { key: string; revenue: number; costs: number; profit: number }[] {
  const map = new Map<string, { revenue: number; costs: number }>();
  for (const o of orders) {
    const key = (o[field] || "–").trim() || "–";
    const m = calcOrderMargin(o);
    const cur = map.get(key) ?? { revenue: 0, costs: 0 };
    cur.revenue += m.revenue;
    cur.costs += m.totalCosts;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({
      key,
      revenue: v.revenue,
      costs: v.costs,
      profit: v.revenue - v.costs,
    }))
    .sort((a, b) => b.profit - a.profit);
}

export function profitByMonth(
  orders: Order[]
): { month: string; profit: number; revenue: number }[] {
  const map = new Map<string, { revenue: number; costs: number }>();
  for (const o of orders) {
    const d = new Date(o.order_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const m = calcOrderMargin(o);
    const cur = map.get(key) ?? { revenue: 0, costs: 0 };
    cur.revenue += m.revenue;
    cur.costs += m.totalCosts;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      profit: v.revenue - v.costs,
      revenue: v.revenue,
    }));
}

export type OwnerDashboardKpis = {
  nettoumsatz: number;
  bestellungen: number;
  durchschnittVerkaufspreis: number | null;
  rohertrag: number;
  rohertragsmargePercent: number | null;
  marketingkosten: number;
  cacJeBestellung: number | null;
  retourenquotePercent: number | null;
  deckungsbeitrag: number;
  overhead: number;
  nettoergebnis: number;
};

/** KPI-Set fuer das Owner-Dashboard (Nettoumsatz, Rohertrag, CAC, Deckungsbeitrag, ...). */
export function calcOwnerDashboardKpis(
  orders: Order[],
  fixedCosts: FixedCost[],
  from: Date,
  to: Date
): OwnerDashboardKpis {
  const periodOrders = filterOrdersByPeriod(orders, from, to);
  const bestellungen = periodOrders.length;

  let nettoumsatz = 0;
  let rohertrag = 0;
  let retournen = 0;

  for (const o of periodOrders) {
    const m = calcOrderMargin(o);
    nettoumsatz += m.revenue;
    rohertrag += m.revenue - m.purchasePriceEur;
    if (o.is_return || o.status === "retourniert") retournen += 1;
  }

  const orderTotals = summarizeOrders(periodOrders);

  const marketingkosten = fixedCostsForPeriod(
    fixedCosts.filter((fc) => fc.category === "Werbung"),
    from,
    to
  );
  const overhead = fixedCostsForPeriod(
    fixedCosts.filter((fc) => fc.category !== "Werbung"),
    from,
    to
  );

  const deckungsbeitrag = orderTotals.profit - marketingkosten;
  const nettoergebnis = deckungsbeitrag - overhead;

  return {
    nettoumsatz,
    bestellungen,
    durchschnittVerkaufspreis:
      bestellungen > 0 ? nettoumsatz / bestellungen : null,
    rohertrag,
    rohertragsmargePercent:
      nettoumsatz !== 0 ? (rohertrag / nettoumsatz) * 100 : null,
    marketingkosten,
    cacJeBestellung: bestellungen > 0 ? marketingkosten / bestellungen : null,
    retourenquotePercent:
      bestellungen > 0 ? (retournen / bestellungen) * 100 : null,
    deckungsbeitrag,
    overhead,
    nettoergebnis,
  };
}

export function debtPaidAmount(debtId: string, payments: DebtPayment[]): number {
  return payments
    .filter((p) => p.debt_id === debtId)
    .reduce((sum, p) => sum + p.amount, 0);
}

export function debtRemaining(debt: Debt, payments: DebtPayment[]): number {
  return debt.total_amount - debtPaidAmount(debt.id, payments);
}

export function summarizeDebts(
  debts: Debt[],
  payments: DebtPayment[]
): { totalDebt: number; totalPaid: number; totalRemaining: number } {
  const totalDebt = debts.reduce((sum, d) => sum + d.total_amount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  return { totalDebt, totalPaid, totalRemaining: totalDebt - totalPaid };
}

export function formatEur(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function formatPercent(value: number | null): string {
  if (value === null) return "–";
  return `${value.toFixed(1)}%`;
}
