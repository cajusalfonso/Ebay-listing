'use client';

import { useActionState } from 'react';
import { Upload } from 'lucide-react';
import {
  importManualEbayTokensAction,
  type CredentialsSaveResult,
} from '../../app/(app)/settings/actions';

const initialState: CredentialsSaveResult = { ok: true };

interface Props {
  ebayEnv: 'sandbox' | 'production';
}

/**
 * Escape hatch for the "eBay OAuth portal won't save my RuName URLs" bug.
 * The user goes to developer.ebay.com -> "Get a User Token Here" -> OAuth
 * radio -> Sign in to Sandbox for OAuth, copies the generated access +
 * refresh tokens, pastes them here. We store them encrypted in the same
 * table our OAuth callback would have written to, so the rest of the
 * pipeline is identical.
 */
export function EbayManualTokenForm({ ebayEnv }: Props) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: CredentialsSaveResult, formData: FormData) =>
      importManualEbayTokensAction(formData),
    initialState
  );

  return (
    <details className="card">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
        <Upload size={16} />
        Tokens manuell importieren (Fallback, wenn OAuth-Flow nicht funktioniert)
      </summary>

      <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
        <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-900">
          <p className="font-semibold">So generierst du die Tokens:</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>
              Öffne{' '}
              <a
                href="https://developer.ebay.com/my/auth?env=sandbox&index=0"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 underline"
              >
                developer.ebay.com – User Tokens
              </a>{' '}
              und wähle die App <strong>Medici Bot</strong>
            </li>
            <li>
              Scroll zu <strong>„Get a User Token Here"</strong>, wähle{' '}
              <strong>OAuth (new security)</strong>
            </li>
            <li>
              Klick <strong>„Sign in to Sandbox for OAuth"</strong> → Sandbox-Login
            </li>
            <li>
              Nach dem Login erscheinen <strong>User Token</strong> (Access) und darunter
              <strong> Refresh Token</strong>. Beide kopieren und hier einfügen.
            </li>
          </ol>
        </div>

        <form action={formAction} className="space-y-3">
          <input type="hidden" name="ebayEnv" value={ebayEnv} />

          <div>
            <label
              htmlFor="accessToken"
              className="block text-sm font-medium text-gray-700"
            >
              Access Token (User Token)
            </label>
            <textarea
              id="accessToken"
              name="accessToken"
              required
              rows={4}
              className="input mt-1 w-full font-mono text-xs"
              placeholder="v^1.1#i^1#I^3#f^0#p^3#..."
            />
          </div>

          <div>
            <label
              htmlFor="refreshToken"
              className="block text-sm font-medium text-gray-700"
            >
              Refresh Token
            </label>
            <textarea
              id="refreshToken"
              name="refreshToken"
              required
              rows={4}
              className="input mt-1 w-full font-mono text-xs"
              placeholder="v^1.1#i^1#r^1#..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="accessTokenExpiresInSeconds"
                className="block text-xs font-medium text-gray-600"
              >
                Access-Gültigkeit (Sekunden, default 7200 = 2h)
              </label>
              <input
                type="number"
                id="accessTokenExpiresInSeconds"
                name="accessTokenExpiresInSeconds"
                min="60"
                className="input mt-1 w-full"
                placeholder="7200"
              />
            </div>
            <div>
              <label
                htmlFor="refreshTokenExpiresInSeconds"
                className="block text-xs font-medium text-gray-600"
              >
                Refresh-Gültigkeit (Sekunden, default 47260800 = 18 Monate)
              </label>
              <input
                type="number"
                id="refreshTokenExpiresInSeconds"
                name="refreshTokenExpiresInSeconds"
                min="60"
                className="input mt-1 w-full"
                placeholder="47260800"
              />
            </div>
          </div>

          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? 'Speichere …' : 'Tokens importieren'}
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
