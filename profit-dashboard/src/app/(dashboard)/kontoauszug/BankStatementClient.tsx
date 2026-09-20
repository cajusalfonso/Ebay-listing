"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BankTransaction } from "@/lib/database.types";
import { parseBankCsv, type ParsedCsvRow } from "@/lib/csv";
import { formatEur } from "@/lib/calculations";

type PreviewRow = ParsedCsvRow & { type: "einnahme" | "ausgabe" };

export function BankStatementClient({
  initialTransactions,
  userId,
}: {
  initialTransactions: BankTransaction[];
  userId: string;
}) {
  const [transactions, setTransactions] =
    useState<BankTransaction[]>(initialTransactions);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [detected, setDetected] = useState<{
    date: string | null;
    amount: string | null;
    description: string | null;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const text = await file.text();
    const { rows, detectedColumns } = parseBankCsv(text);

    if (!detectedColumns.date || !detectedColumns.amount) {
      setError(
        "Konnte Datum- oder Betrag-Spalte nicht erkennen. Bitte CSV prüfen (Export aus Online-Banking)."
      );
    }

    setDetected(detectedColumns);
    setPreview(
      rows.map((r) => ({
        ...r,
        type: r.amount >= 0 ? "einnahme" : "ausgabe",
      }))
    );
  }

  function updateRowType(idx: number, type: "einnahme" | "ausgabe") {
    setPreview((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, type } : r))
    );
  }

  async function handleImport() {
    if (preview.length === 0) return;
    setImporting(true);
    setError(null);

    const payload = preview.map((r) => ({
      user_id: userId,
      tx_date: r.date,
      amount: r.amount,
      description: r.description,
      type: r.type,
    }));

    const { data, error } = await supabase
      .from("bank_transactions")
      .insert(payload)
      .select();

    setImporting(false);

    if (error) {
      setError(error.message);
      return;
    }

    setTransactions((prev) => [...(data ?? []), ...prev]);
    setPreview([]);
    setDetected(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDelete(id: string) {
    if (!confirm("Buchung wirklich löschen?")) return;
    const { error } = await supabase
      .from("bank_transactions")
      .delete()
      .eq("id", id);
    if (error) return alert(error.message);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Kontoauszug</h1>

      <div className="card">
        <label className="label">CSV-Datei hochladen (Export aus Online-Banking)</label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="block text-sm"
        />
        {detected && (
          <p className="mt-2 text-xs text-slate-500">
            Erkannt – Datum: {detected.date ?? "–"}, Betrag: {detected.amount ?? "–"}, Verwendungszweck:{" "}
            {detected.description ?? "–"}
          </p>
        )}
        {error && <p className="mt-2 text-sm text-loss">{error}</p>}
      </div>

      {preview.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">
              Vorschau ({preview.length} Zeilen)
            </h2>
            <button
              className="btn-primary"
              onClick={handleImport}
              disabled={importing}
            >
              {importing ? "Importiere…" : "In Übersicht übernehmen"}
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Verwendungszweck</th>
                <th>Betrag</th>
                <th>Einordnung</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.date || "–"}</td>
                  <td className="max-w-xs truncate">{row.description || "–"}</td>
                  <td>{formatEur(row.amount)}</td>
                  <td>
                    <select
                      className="input"
                      value={row.type}
                      onChange={(e) =>
                        updateRowType(
                          idx,
                          e.target.value as "einnahme" | "ausgabe"
                        )
                      }
                    >
                      <option value="einnahme">Einnahme</option>
                      <option value="ausgabe">Ausgabe</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">Gebuchte Kontoauszüge</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Verwendungszweck</th>
              <th>Betrag</th>
              <th>Typ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td>{t.tx_date}</td>
                <td className="max-w-xs truncate">{t.description || "–"}</td>
                <td
                  className={
                    t.type === "einnahme" ? "text-profit" : "text-loss"
                  }
                >
                  {formatEur(t.amount)}
                </td>
                <td>{t.type}</td>
                <td>
                  <button
                    className="text-sm text-loss hover:underline"
                    onClick={() => handleDelete(t.id)}
                  >
                    Löschen
                  </button>
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  Noch keine Kontoauszüge importiert.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
