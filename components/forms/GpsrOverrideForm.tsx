'use client';

import { useState, useTransition } from 'react';
import { Check, X, Trash2, Plus } from 'lucide-react';
import type { GpsrOverrideRow } from '../../app/(app)/settings/gpsr-actions';

interface Props {
  existing: readonly GpsrOverrideRow[];
}

export function GpsrOverrideForm({ existing }: Props) {
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    startTransition(async () => {
      setFormError(null);
      setSuccess(null);
      const response = await fetch('/api/gpsr/upsert', {
        method: 'POST',
        body: formData,
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (json.ok) {
        setSuccess('Gespeichert.');
        // reset form
        const form = document.getElementById('gpsr-form') as HTMLFormElement | null;
        form?.reset();
      } else {
        setFormError(json.error ?? 'Unbekannter Fehler');
      }
    });
  };

  const handleDelete = (brand: string) => {
    if (!confirm(`Override für "${brand}" löschen?`)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('brand', brand);
      await fetch('/api/gpsr/delete', { method: 'POST', body: fd });
      // server revalidate will reload — but to be safe also refresh the page
      window.location.reload();
    });
  };

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">GPSR Hersteller-Overrides</h2>
        <p className="mt-1 text-xs text-gray-500">
          Wenn Icecat / eBay Catalog keinen vollständigen Hersteller-Kontakt liefern, wird diese
          Tabelle als Fallback benutzt. Pflicht nach EU GPSR für alle EU-Listings. Key ist der
          <code className="mx-1 rounded bg-gray-100 px-1">Brand</code>-Name — exakt wie von
          Icecat zurückgegeben (z.B. <code className="rounded bg-gray-100 px-1">Philips</code>).
        </p>
      </div>

      {existing.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-gray-500">
              <tr className="border-b border-gray-100">
                <th className="py-2 pr-4 font-medium">Brand</th>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Adresse</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {existing.map((row) => (
                <tr key={row.brand}>
                  <td className="py-2 pr-4 font-mono text-xs text-gray-900">{row.brand}</td>
                  <td className="py-2 pr-4 text-gray-700">{row.name ?? '—'}</td>
                  <td className="py-2 pr-4 text-xs text-gray-500">{row.address ?? '—'}</td>
                  <td className="py-2 pr-4 text-xs text-gray-500">{row.email ?? '—'}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(row.brand)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                    >
                      <Trash2 size={12} />
                      löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Keine Overrides gespeichert. Solange Icecat GPSR nicht komplett liefert, werden Listings
          im <span className="font-semibold">Compliance Gate</span> geblockt.
        </div>
      )}

      <form
        id="gpsr-form"
        onSubmit={(event) => {
          event.preventDefault();
          submit(new FormData(event.currentTarget));
        }}
        className="space-y-3 border-t border-gray-100 pt-4"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="brand" className="mb-1 block text-xs font-medium text-gray-700">
              Brand (Schlüssel)
            </label>
            <input
              id="brand"
              name="brand"
              type="text"
              required
              className="input"
              placeholder="Philips"
            />
          </div>
          <div>
            <label htmlFor="name" className="mb-1 block text-xs font-medium text-gray-700">
              Hersteller-Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              className="input"
              placeholder="Koninklijke Philips N.V."
            />
          </div>
        </div>
        <div>
          <label htmlFor="address" className="mb-1 block text-xs font-medium text-gray-700">
            Hersteller-Adresse
          </label>
          <input
            id="address"
            name="address"
            type="text"
            className="input"
            placeholder="High Tech Campus 5, 5656 AE Eindhoven, Niederlande"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-xs font-medium text-gray-700">
            Hersteller-Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="input"
            placeholder="compliance@philips.com"
          />
        </div>

        {formError ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            <X size={12} className="mr-1 inline" />
            {formError}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-md border border-brand-200 bg-brand-50 p-2 text-xs text-brand-700">
            <Check size={12} className="mr-1 inline" />
            {success}
          </div>
        ) : null}

        <div className="flex justify-end">
          <button type="submit" disabled={isPending} className="btn-primary">
            <Plus size={14} />
            {isPending ? 'Speichere…' : 'Override speichern'}
          </button>
        </div>
      </form>
    </div>
  );
}
