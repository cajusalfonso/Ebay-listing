import { auth } from '../../../lib/auth';
import { CredentialsForm } from '../../../components/forms/CredentialsForm';
import { EbayConnectCard } from '../../../components/forms/EbayConnectCard';
import { EbayManualTokenForm } from '../../../components/forms/EbayManualTokenForm';
import { isEbayConnected } from '../../../lib/user-clients';
import { getCredentialsMaskedForUser } from './actions';

const ERROR_MESSAGES: Record<string, string> = {
  missing_credentials: 'Bitte zuerst App-ID, Cert-ID, Dev-ID und RuName speichern.',
  session_expired: 'Session abgelaufen — bitte neu einloggen.',
  csrf_state_mismatch: 'CSRF-State stimmt nicht überein. Flow erneut starten.',
  token_exchange_failed: 'Token-Exchange mit eBay fehlgeschlagen. Credentials prüfen.',
  missing_code_or_state: 'eBay-Callback kam ohne code oder state. Erneut versuchen.',
};

interface PageProps {
  searchParams: Promise<{ connected?: string; error?: string }>;
}

type LoadResult =
  | {
      ok: true;
      userId: number;
      existing: Awaited<ReturnType<typeof getCredentialsMaskedForUser>>;
      connection: { connected: boolean; accessExpiresAt: Date | null; refreshExpiresAt: Date | null };
    }
  | { ok: false; where: string; message: string; stack?: string | undefined };

async function loadPageData(): Promise<LoadResult> {
  let userId: number;
  try {
    const session = await auth();
    userId = Number.parseInt(session?.user?.id ?? '0', 10);
  } catch (error) {
    const e = error as Error;
    return { ok: false, where: 'auth()', message: e.message || String(e), stack: e.stack };
  }

  const ebayEnv: 'sandbox' | 'production' = 'sandbox';

  let existing: Awaited<ReturnType<typeof getCredentialsMaskedForUser>> = null;
  try {
    existing = await getCredentialsMaskedForUser(ebayEnv);
  } catch (error) {
    const e = error as Error;
    return {
      ok: false,
      where: 'getCredentialsMaskedForUser',
      message: e.message || String(e),
      stack: e.stack,
    };
  }

  let connection: {
    connected: boolean;
    accessExpiresAt: Date | null;
    refreshExpiresAt: Date | null;
  };
  try {
    connection = await isEbayConnected(userId, ebayEnv);
  } catch (error) {
    const e = error as Error;
    return {
      ok: false,
      where: 'isEbayConnected',
      message: e.message || String(e),
      stack: e.stack,
    };
  }

  return { ok: true, userId, existing, connection };
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const loaded = await loadPageData();
  const params = await searchParams;
  const ebayEnv: 'sandbox' | 'production' = 'sandbox';

  if (!loaded.ok) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-semibold text-red-700">Settings: Load-Fehler</h1>
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm">
          <div className="mb-2">
            <span className="font-semibold">Stelle:</span>{' '}
            <code className="font-mono text-xs">{loaded.where}</code>
          </div>
          <div className="mb-2">
            <span className="font-semibold">Message:</span>
            <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-xs text-red-900">
              {loaded.message}
            </pre>
          </div>
          {loaded.stack ? (
            <div>
              <span className="font-semibold">Stack:</span>
              <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded bg-white p-2 font-mono text-[10px] text-gray-800">
                {loaded.stack}
              </pre>
            </div>
          ) : null}
        </div>
        <div className="flex gap-2">
          <a href="/settings" className="btn-primary">
            Erneut laden
          </a>
          <a href="/auth/login" className="btn-secondary">
            Neu einloggen
          </a>
        </div>
      </div>
    );
  }

  const { existing, connection } = loaded;
  const connectedEnv = params.connected;
  const errorCode = params.error;
  const errorMessage = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? `Fehler: ${errorCode}`)
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Connect your eBay, Icecat, and Discord accounts. Secrets are encrypted with
          AES-256-GCM before being persisted — we never log them.
        </p>
      </div>

      {connectedEnv ? (
        <div className="rounded-md border border-brand-200 bg-brand-50 p-3 text-sm text-brand-700">
          ✓ eBay {connectedEnv} successfully connected.
        </div>
      ) : null}
      {errorMessage ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <CredentialsForm
        existing={
          existing ?? {
            hasEbayAppId: false,
            hasEbayCertId: false,
            hasEbayDevId: false,
            hasIcecatUser: false,
            hasIcecatPassword: false,
            hasDiscordWebhook: false,
            ebayRedirectUriName: '',
            merchantLocationKey: '',
          }
        }
      />

      <EbayConnectCard
        ebayEnv={ebayEnv}
        connected={connection.connected}
        accessExpiresAt={connection.accessExpiresAt}
        refreshExpiresAt={connection.refreshExpiresAt}
      />

      <EbayManualTokenForm ebayEnv={ebayEnv} />
    </div>
  );
}
