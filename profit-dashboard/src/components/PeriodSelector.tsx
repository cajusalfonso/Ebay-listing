"use client";

import type { PeriodKey } from "@/lib/calculations";

const OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "this-month", label: "Dieser Monat" },
  { key: "last-month", label: "Letzter Monat" },
  { key: "all", label: "Gesamt" },
  { key: "custom", label: "Benutzerdefiniert" },
];

export function PeriodSelector({
  value,
  onChange,
  customFrom,
  customTo,
  onCustomChange,
}: {
  value: PeriodKey;
  onChange: (key: PeriodKey) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-slate-300 bg-white p-1">
        {OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              value === opt.key
                ? "bg-brand text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {value === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="input"
            value={customFrom}
            onChange={(e) => onCustomChange(e.target.value, customTo)}
          />
          <span className="text-slate-400">–</span>
          <input
            type="date"
            className="input"
            value={customTo}
            onChange={(e) => onCustomChange(customFrom, e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
