import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { ExternalLink, AlertTriangle } from 'lucide-react';
import { auth } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { listings, needsReview } from '../../../src/db/schema';

const STATUS_COLORS: Record<string, string> = {
  published: 'bg-brand-50 text-brand-700 border-brand-200',
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  paused: 'bg-amber-50 text-amber-700 border-amber-200',
  ended: 'bg-gray-100 text-gray-500 border-gray-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};

function formatEur(value: string | null): string {
  if (!value) return '—';
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num)) return '—';
  return `€${num.toFixed(2)}`;
}

function formatPercent(value: string | null): string {
  if (!value) return '—';
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num)) return '—';
  return `${(num * 100).toFixed(2)}%`;
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function listingUrl(env: string, id: string | null): string | null {
  if (!id) return null;
  return env === 'production'
    ? `https://www.ebay.de/itm/${id}`
    : `https://www.sandbox.ebay.de/itm/${id}`;
}

export default async function ListingsPage() {
  const session = await auth();
  const userId = Number.parseInt(session?.user?.id ?? '0', 10);

  const [activeListings, review] = await Promise.all([
    db
      .select()
      .from(listings)
      .where(eq(listings.userId, userId))
      .orderBy(desc(listings.createdAt))
      .limit(50),
    db
      .select()
      .from(needsReview)
      .where(eq(needsReview.userId, userId))
      .orderBy(desc(needsReview.createdAt))
      .limit(10),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Listings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your live + draft + failed eBay listings. Create new ones via the{' '}
          <Link href="/dashboard" className="text-brand-600 hover:underline">
            Dashboard
          </Link>
          .
        </p>
      </div>

      <div className="card p-0">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-900">
            All listings{' '}
            <span className="ml-1 font-normal text-gray-500">({activeListings.length})</span>
          </h2>
        </div>
        {activeListings.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">
            No listings yet. Run your first preview on the Dashboard.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-6 py-3 font-medium">EAN / SKU</th>
                  <th className="px-6 py-3 font-medium">Env</th>
                  <th className="px-6 py-3 font-medium">Price</th>
                  <th className="px-6 py-3 font-medium">Profit / Margin</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Created</th>
                  <th className="px-6 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeListings.map((l) => {
                  const url = listingUrl(l.ebayEnvironment, l.ebayListingId);
                  const statusClass = STATUS_COLORS[l.status] ?? STATUS_COLORS.draft;
                  return (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs text-gray-900">{l.ean}</div>
                        <div className="font-mono text-xs text-gray-500">{l.ebaySku}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-medium">
                          {l.ebayEnvironment === 'production' ? '🟢 prod' : '🧪 sandbox'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {formatEur(l.sellPriceGross)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-900">{formatEur(l.calculatedProfit)}</div>
                        <div className="text-xs text-gray-500">
                          {formatPercent(l.calculatedMargin)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass}`}
                        >
                          {l.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">{formatDate(l.createdAt)}</td>
                      <td className="px-6 py-4 text-right">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                          >
                            open <ExternalLink size={12} />
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {review.length > 0 ? (
        <div className="card p-0">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <AlertTriangle size={16} className="text-amber-500" />
              Needs Review{' '}
              <span className="ml-1 font-normal text-gray-500">({review.length})</span>
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Listings blocked by compliance gate or data-missing. Fix in Settings (GPSR
              overrides) or skip.
            </p>
          </div>
          <ul className="divide-y divide-gray-100">
            {review.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-4 px-6 py-3 text-sm">
                <div>
                  <div className="font-mono text-xs text-gray-900">{r.ean ?? '—'}</div>
                  <div className="mt-0.5 text-xs text-gray-500">{r.reason}</div>
                </div>
                <div className="text-xs text-gray-400">{formatDate(r.createdAt)}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
