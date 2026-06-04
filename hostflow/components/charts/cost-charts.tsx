"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const euroFull = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function CurrencyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">{euroFull.format(payload[0].value)}</p>
    </div>
  );
}

export function PropertyCostChart({
  data,
}: {
  data: { name: string; cost: number; color: string }[];
}) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Keine Kosten in diesem Zeitraum.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 56)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" tickFormatter={(v) => euro.format(v)} fontSize={12} />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CurrencyTooltip />} cursor={{ fill: "transparent" }} />
        <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthTrendChart({
  data,
}: {
  data: { month: string; cost: number }[];
}) {
  const formatted = data.map((d) => {
    const [y, m] = d.month.split("-");
    return { label: `${m}.${y.slice(2)}`, cost: d.cost };
  });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={formatted} margin={{ left: 8, right: 8 }}>
        <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis tickFormatter={(v) => euro.format(v)} fontSize={12} width={56} />
        <Tooltip content={<CurrencyTooltip />} cursor={{ fill: "transparent" }} />
        <Bar dataKey="cost" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
      </BarChart>
    </ResponsiveContainer>
  );
}
