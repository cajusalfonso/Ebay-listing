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

export default async function SettingsPage({ searchParams }: PageProps) {
  const session = await auth();
  const userId = Number.parseInt(session?.user?.id ?? '0', 10);
  const ebayEnv: 'sandbox' | 'production' = 'sandbox';

  const [existing, connection] = await Promise.all([
    getCredentialsMaskedForUser(ebayEnv),
    isEbayConnected(userId, ebayEnv),
  ]);

  const params = await searchParams;
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
