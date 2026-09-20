"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SettingsClient({
  userId,
  initialMarginThreshold,
  initialVatRate,
}: {
  userId: string;
  initialMarginThreshold: number;
  initialVatRate: number;
}) {
  const [marginThreshold, setMarginThreshold] = useState(
    initialMarginThreshold
  );
  const [vatRate, setVatRate] = useState(initialVatRate);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const { error } = await supabase.from("settings").upsert({
      user_id: userId,
      margin_threshold_percent: marginThreshold,
      vat_rate_percent: vatRate,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-bold">Einstellungen</h1>

      <form onSubmit={handleSave} className="card space-y-5">
        <div>
          <label className="label">
            Margen-Warnschwelle (%) – rote Markierung darunter
          </label>
          <input
            type="number"
            step="0.5"
            className="input"
            value={marginThreshold}
            onChange={(e) =>
              setMarginThreshold(parseFloat(e.target.value) || 0)
            }
          />
        </div>

        <div>
          <label className="label">Umsatzsteuersatz (%)</label>
          <input
            type="number"
            step="0.5"
            className="input"
            value={vatRate}
            onChange={(e) => setVatRate(parseFloat(e.target.value) || 0)}
          />
        </div>

        <p className="text-xs text-slate-400">
          Werbekosten für Idealo, Geizhals & Co. (CPC) trägst du unter
          „Fixkosten" ein – Kategorie „Werbung", da sie pro Klick statt pro
          Bestellung anfallen.
        </p>

        {error && <p className="text-sm text-loss">{error}</p>}
        {saved && <p className="text-sm text-profit">Gespeichert.</p>}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Speichern…" : "Speichern"}
        </button>
      </form>
    </div>
  );
}
