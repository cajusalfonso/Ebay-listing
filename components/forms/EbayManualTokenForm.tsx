'use client';

import { useActionState } from 'react';
import { KeyRound } from 'lucide-react';
import {
  redeemAuthCodeAction,
  type CredentialsSaveResult,
} from '../../app/(app)/settings/actions';

const initialState: CredentialsSaveResult = { ok: true };

interface Props {
  ebayEnv: 'sandbox' | 'production';
}

/**
 * Escape hatch for when eBay's RuName OAuth config refuses to redirect
 * properly after consent. eBay still issues a valid authorization code in
 * the fallback Thank-You URL; the user pastes that URL (or the raw code)
 * here and we exchange it for a proper access + 18-month refresh token
 * pair via our existing `exchangeCodeForTokens` flow.
 */
export function EbayManualTokenForm({ ebayEnv }: Props) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: CredentialsSaveResult, formData: FormData) =>
      redeemAuthCodeAction(formData),
    initialState
  );

  return (
    <details className="card">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
        <KeyRound size={16} />
        Auth-Code manuell einlösen (wenn Connect-Flow im Thank-You-Page endet)
      </summary>

      <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
        <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-900">
          <p className="font-semibold">Ergebnis: 18 Monate gültige Verbindung.</p>
          <p className="mt-1">
            eBays Sandbox-Portal leitet nach dem Consent manchmal auf eine generische
            Thank-You-Page weiter, statt zurück zur App. Der Auth-Code steht aber
            trotzdem in der URL. Wir lösen ihn hier manuell ein und bekommen dadurch
            den richtigen <strong>18-Monats-Refresh-Token</strong> — danach läuft die
            App autonom, Access Token wird automatisch erneuert.
          </p>
          <p className="mt-2 font-semibold">Anleitung:</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>
              Oben auf <strong>„Connect eBay"</strong> klicken
            </li>
            <li>Bei eBay Sandbox einloggen, Consent bestätigen</li>
            <li>
              Wenn du auf der <strong>„Thank You"-Page</strong> landest: URL aus der
              Adresszeile kopieren (Cmd+L, Cmd+C, Cmd+V). Sie sieht so aus:
              <br />
              <code className="mt-1 inline-block rounded bg-white px-1 py-0.5 text-[10px]">
                https://auth2.sandbox.ebay.com/...?isAuthSuccessful=true&amp;state=...&amp;code=v^1.1#...&amp;expires_in=299
              </code>
            </li>
            <li>
              Die komplette URL <strong>oder nur den Code-Teil</strong> hier einfügen
              und innerhalb von <strong>5 Minuten</strong> einlösen (der Code läuft
              schnell ab)
            </li>
          </ol>
        </div>

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="ebayEnv" value={ebayEnv} />

          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700">
              Auth-Code oder komplette Thank-You-URL
            </label>
            <textarea
              id="code"
              name="code"
              required
              rows={4}
              className="input mt-1 w-full font-mono text-xs"
              placeholder="v^1.1#i^1#... — oder die komplette URL aus der Adresszeile"
            />
            <p className="mt-1 text-xs text-gray-500">
              Wir extrahieren automatisch den Code aus einer URL, falls du die ganze
              Zeile paste'st.
            </p>
          </div>

          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? 'Löse ein …' : 'Code einlösen'}
          </button>

          {state.message ? (
            <p className="text-sm text-brand-700">{state.message}</p>
          ) : null}
          {state.error ? (
            <p className="text-sm text-red-700">{state.error}</p>
          ) : null}
        </form>
      </div>
    </details>
  );
}
