"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SALES_CHANNELS } from "@/lib/constants";

export function SettingsClient({
  userId,
  initialMarginThreshold,
  initialVatRate,
  initialChannelFees,
}: {
  userId: string;
  initialMarginThreshold: number;
  initialVatRate: number;
  initialChannelFees: Record<string, number>;
}) {
  const [marginThreshold, setMarginThreshold] = useState(
    initialMarginThreshold
  );
  const [vatRate, setVatRate] = useState(initialVatRate);
  const [channelFees, setChannelFees] =
    useState<Record<string, number>>(initialChannelFees);
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
      channel_fee_defaults: channelFees,
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

        <div>
          <label className="label">
            Standard-Kanalgebühr je Verkaufskanal (%)
          </label>
          <div className="space-y-2">
            {SALES_CHANNELS.map((channel) => (
              <div key={channel} className="flex items-center gap-3">
                <span className="w-32 text-sm text-slate-600">{channel}</span>
                <input
                  type="number"
                  step="0.1"
                  className="input"
                  value={channelFees[channel] ?? 0}
                  onChange={(e) =>
                    setChannelFees((f) => ({
                      ...f,
                      [channel]: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-loss">{error}</p>}
        {saved && <p className="text-sm text-profit">Gespeichert.</p>}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Speichern…" : "Speichern"}
        </button>
      </form>
    </div>
  );
}
