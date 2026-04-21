'use client';

import { useActionState, useState } from 'react';
import { Check } from 'lucide-react';
import {
  saveCredentialsAction,
  type CredentialsSaveResult,
} from '../../app/(app)/settings/actions';

interface ExistingState {
  hasEbayAppId: boolean;
  hasEbayCertId: boolean;
  hasEbayDevId: boolean;
  hasIcecatUser: boolean;
  hasIcecatPassword: boolean;
  hasDiscordWebhook: boolean;
  ebayRedirectUriName: string;
  merchantLocationKey: string;
}

const initialState: CredentialsSaveResult = { ok: true };

function SecretField(props: {
  label: string;
  name: string;
  alreadySet: boolean;
  helpText?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor={props.name} className="text-sm font-medium text-gray-700">
          {props.label}
        </label>
        {props.alreadySet ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
            <Check size={12} /> gespeichert
          </span>
        ) : null}
      </div>
      <input
        id={props.name}
        name={props.name}
        type="password"
        autoComplete="off"
        className="input"
        placeholder={props.alreadySet ? 'Leerlassen zum Beibehalten' : '••••••••'}
      />
      {props.helpText ? <p className="mt-1 text-xs text-gray-500">{props.helpText}</p> : null}
    </div>
  );
}

export function CredentialsForm({ existing }: { existing: ExistingState }) {
  const [env, setEnv] = useState<'sandbox' | 'production'>('sandbox');
  const [state, formAction, isPending] = useActionState<CredentialsSaveResult, FormData>(
    async (_prev, formData) => saveCredentialsAction(formData),
    initialState
  );

  return (
    <form action={formAction} className="space-y-6">
      {/* eBay Env toggle */}
      <div className="card">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">eBay Environment</h2>
        <p className="mb-4 text-sm text-gray-500">
          Separate credentials for sandbox (testing) and production. Start with sandbox.
        </p>
        <div className="flex gap-2">
          {(['sandbox', 'production'] as const).map((e) => (
            <label
              key={e}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                env === e
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="ebayEnv"
                value={e}
                checked={env === e}
                onChange={() => {
                  setEnv(e);
                }}
                className="sr-only"
              />
              {e === 'sandbox' ? '🧪 Sandbox' : '🟢 Production'}
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">eBay API Credentials</h2>
        <p className="mb-4 text-sm text-gray-500">
          Get these from{' '}
          <a
            href="https://developer.ebay.com/my/keys"
            target="_blank"
            rel="noreferrer"
            className="text-brand-600 hover:underline"
          >
            developer.ebay.com/my/keys
          </a>
          . All values encrypted with AES-256-GCM before storage.
        </p>
        <div className="space-y-4">
          <SecretField
            label="eBay App ID (Client ID)"
            name="ebayAppId"
            alreadySet={existing.hasEbayAppId}
          />
          <SecretField
            label="eBay Cert ID (Client Secret)"
            name="ebayCertId"
            alreadySet={existing.hasEbayCertId}
          />
          <SecretField
            label="eBay Dev ID"
            name="ebayDevId"
            alreadySet={existing.hasEbayDevId}
          />
          <div>
            <label
              htmlFor="ebayRedirectUriName"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              eBay RuName (Redirect URI Name)
            </label>
            <input
              id="ebayRedirectUriName"
              name="ebayRedirectUriName"
              type="text"
              className="input"
              placeholder="YourCompany-YourApp-SBX-xxxxxxxxx-yyyyyyyy"
              defaultValue={existing.ebayRedirectUriName}
            />
            <p className="mt-1 text-xs text-gray-500">
              Nicht geheim — das ist ein Identifier, keine URL.
            </p>
          </div>
          <div>
            <label
              htmlFor="merchantLocationKey"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Merchant Location Key
            </label>
            <input
              id="merchantLocationKey"
              name="merchantLocationKey"
              type="text"
              className="input"
              placeholder="main"
              defaultValue={existing.merchantLocationKey}
            />
            <p className="mt-1 text-xs text-gray-500">
              Inventory-Location-Key aus eBay Seller Hub.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Icecat Open Catalog</h2>
        <p className="mb-4 text-sm text-gray-500">
          Free signup at{' '}
          <a
            href="https://icecat.biz"
            target="_blank"
            rel="noreferrer"
            className="text-brand-600 hover:underline"
          >
            icecat.biz
          </a>
          . Used to enrich product data with GPSR information.
        </p>
        <div className="space-y-4">
          <SecretField
            label="Icecat User"
            name="icecatUser"
            alreadySet={existing.hasIcecatUser}
          />
          <SecretField
            label="Icecat Password"
            name="icecatPassword"
            alreadySet={existing.hasIcecatPassword}
          />
        </div>
      </div>

      <div className="card">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Discord Notifications</h2>
        <p className="mb-4 text-sm text-gray-500">
          Optional webhook URL for listing publish notifications.
        </p>
        <SecretField
          label="Discord Webhook URL"
          name="discordWebhookUrl"
          alreadySet={existing.hasDiscordWebhook}
          helpText="Server → Channel Settings → Integrations → Webhooks → New Webhook"
        />
      </div>

      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}
      {state.ok && state.message ? (
        <div className="rounded-md border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700">
          {state.message}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className="btn-primary">
          {isPending ? 'Speichere…' : 'Speichern'}
        </button>
      </div>
    </form>
  );
}
