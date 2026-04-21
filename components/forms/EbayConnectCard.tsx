import Link from 'next/link';
import { CheckCircle2, CircleAlert, Plug } from 'lucide-react';

interface EbayConnectCardProps {
  ebayEnv: 'sandbox' | 'production';
  connected: boolean;
  accessExpiresAt: Date | null;
  refreshExpiresAt: Date | null;
}

function formatRelative(date: Date | null): string {
  if (!date) return '—';
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return 'expired';
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return `${Math.floor(diffMs / 60_000)} min`;
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
}

export function EbayConnectCard({
  ebayEnv,
  connected,
  accessExpiresAt,
  refreshExpiresAt,
}: EbayConnectCardProps) {
  return (
    <div className="card">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            eBay Authorization {ebayEnv === 'sandbox' ? '🧪 Sandbox' : '🟢 Production'}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            After saving your eBay keys above, click Connect to grant the app access to your
            eBay account via OAuth. Tokens are AES-256-GCM encrypted at rest.
          </p>
        </div>
        {connected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <CheckCircle2 size={14} /> Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            <CircleAlert size={14} /> Not connected
          </span>
        )}
      </div>

      {connected ? (
        <dl className="mb-4 grid grid-cols-2 gap-4 rounded-md border border-gray-100 bg-gray-50 p-3 text-sm">
          <div>
            <dt className="text-xs text-gray-500">Access token expires in</dt>
            <dd className="font-medium text-gray-900">{formatRelative(accessExpiresAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Refresh token expires in</dt>
            <dd className="font-medium text-gray-900">{formatRelative(refreshExpiresAt)}</dd>
          </div>
        </dl>
      ) : null}

      <div className="flex items-center gap-3">
        <Link
          href={`/api/ebay/connect?env=${ebayEnv}`}
          className={connected ? 'btn-secondary' : 'btn-primary'}
        >
          <Plug size={16} />
          {connected ? 'Reconnect' : 'Connect eBay'}
        </Link>
        <p className="text-xs text-gray-500">
          Your RuName must redirect to <code className="rounded bg-gray-100 px-1">/api/ebay/callback</code>
        </p>
      </div>
    </div>
  );
}
