'use client';

import { useState, useTransition } from 'react';
import { Check, X, Save } from 'lucide-react';
import type { PricingSettings } from '../../lib/pricing-settings';

interface Props {
  current: PricingSettings;
}

interface SaveResult {
  ok: boolean;
  error?: string;
  message?: string;
}

function pct(v: number): string {
  return (v * 100).toFixed(2);
}

export function PricingSettingsForm({ current }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    startTransition(async () => {
      setError(null);
      setSuccess(null);
      const response = await fetch('/api/pricing-settings/save', {
        method: 'POST',
        body: formData,
      });
      const json = (await response.json()) as SaveResult;
      if (json.ok) {
        setSuccess(json.message ?? 'Gespeichert.');
      } else {
        setError(json.error ?? 'Unbekannter Fehler');
      }
    });
  };

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Profitability Thresholds</h2>
        <p className="mt-1 text-sm text-gray-500">
          Mindest-Profit-Anforderungen für Listings. Liegt ein Listing unter diesen Werten, wird
          der Publish geblockt (kommt in Needs-Review). Werte werden auch für die automatische
          Preis-Empfehlung verwendet.
        </p>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(new FormData(event.currentTarget));
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label
              htmlFor="minProfitEur"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Minimum Profit (€)
            </label>
            <input
              id="minProfitEur"
              name="minProfitEur"
              type="number"
              step="0.01"
              min="0"
              className="input"
              placeholder={current.minProfitEur.toFixed(2)}
            />
            <p className="mt-1 text-xs text-gray-400">
              Profit (€) = Net Sell − Net Buy − Fees
            </p>
          </div>
          <div>
            <label
              htmlFor="minRoiPercent"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Minimum ROI (%)
            </label>
            <input
              id="minRoiPercent"
              name="minRoiPercent"
              type="number"
              step="0.01"
              min="0"
              className="input"
              placeholder={pct(current.minRoiPercent)}
            />
            <p className="mt-1 text-xs text-gray-400">ROI (%) = (Profit / COGS) × 100</p>
          </div>
          <div>
            <label
              htmlFor="minMarginPercent"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Minimum Margin (%)
            </label>
            <input
              id="minMarginPercent"
              name="minMarginPercent"
              type="number"
              step="0.01"
              min="0"
              className="input"
              placeholder={pct(current.minMarginPercent)}
            />
            <p className="mt-1 text-xs text-gray-400">Margin (%) = Profit / Net Sell × 100</p>
          </div>
        </div>

        <details className="border-t border-gray-100 pt-4">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
            Erweiterte Pricing-Parameter
          </summary>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="targetMarginMultiplier"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Target Margin Multiplier
              </label>
              <input
                id="targetMarginMultiplier"
                name="targetMarginMultiplier"
                type="number"
                step="0.01"
                min="1"
                className="input"
                placeholder={current.targetMarginMultiplier.toFixed(2)}
              />
              <p className="mt-1 text-xs text-gray-400">
                COGS × dieser Wert = explorativer Preis bei „no competition"
              </p>
            </div>
            <div>
              <label
                htmlFor="undercutAmountEur"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Undercut (€)
              </label>
              <input
                id="undercutAmountEur"
                name="undercutAmountEur"
                type="number"
                step="0.01"
                min="0"
                className="input"
                placeholder={current.undercutAmountEur.toFixed(2)}
              />
              <p className="mt-1 text-xs text-gray-400">
                Differenz unter dem günstigsten Wettbewerber
              </p>
            </div>
            <div>
              <label
                htmlFor="categoryFeePercent"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                eBay Category Fee (%)
              </label>
              <input
                id="categoryFeePercent"
                name="categoryFeePercent"
                type="number"
                step="0.01"
                min="0"
                className="input"
                placeholder={pct(current.categoryFeePercent)}
              />
              <p className="mt-1 text-xs text-gray-400">Default-Provision wenn nicht ermittelt</p>
            </div>
            <div>
              <label
                htmlFor="vatRate"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                VAT-Rate (%)
              </label>
              <input
                id="vatRate"
                name="vatRate"
                type="number"
                step="0.01"
                min="0"
                className="input"
                placeholder={pct(current.vatRate)}
              />
              <p className="mt-1 text-xs text-gray-400">DE-Standard 19 %</p>
            </div>
            <div>
              <label
                htmlFor="returnReservePercent"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Return-Reserve (%)
              </label>
              <input
                id="returnReservePercent"
                name="returnReservePercent"
                type="number"
                step="0.01"
                min="0"
                className="input"
                placeholder={pct(current.returnReservePercent)}
              />
              <p className="mt-1 text-xs text-gray-400">
                Reserve pro Verkauf für erwartete Retouren
              </p>
            </div>
          </div>
        </details>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <X size={14} className="mr-1 inline" />
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-md border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700">
            <Check size={14} className="mr-1 inline" />
            {success}
          </div>
        ) : null}

        <p className="text-xs text-gray-400">
          Leere Felder = aktuelle Werte beibehalten. Aktuelle Werte stehen als Platzhalter.
        </p>

        <div className="flex justify-end">
          <button type="submit" disabled={isPending} className="btn-primary">
            <Save size={16} />
            {isPending ? 'Speichere…' : 'Thresholds speichern'}
          </button>
        </div>
      </form>
    </div>
  );
}
