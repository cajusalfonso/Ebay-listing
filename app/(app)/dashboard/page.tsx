import { and, count, eq } from 'drizzle-orm';
import { auth } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { isEbayConnected } from '../../../lib/user-clients';
import { listings, needsReview } from '../../../src/db/schema';
import { CreateListingForm } from '../../../components/forms/CreateListingForm';

async function loadUserStats(userId: number) {
  const [liveRow] = await db
    .select({ total: count() })
    .from(listings)
    .where(and(eq(listings.userId, userId), eq(listings.status, 'published')));
  const [reviewRow] = await db
    .select({ total: count() })
    .from(needsReview)
    .where(eq(needsReview.userId, userId));
  return {
    liveListings: liveRow?.total ?? 0,
    needsReview: reviewRow?.total ?? 0,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = Number.parseInt(session?.user?.id ?? '0', 10);
  const name = session?.user?.name ?? session?.user?.email ?? 'there';

  const [stats, connection] = await Promise.all([
    loadUserStats(userId),
    isEbayConnected(userId, 'sandbox'),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Welcome back, {name}.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Active Listings
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats.liveListings}</p>
          <p className="mt-1 text-xs text-gray-400">Live on eBay.de</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            Needs Review
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{stats.needsReview}</p>
          <p className="mt-1 text-xs text-gray-400">Compliance or data-missing blocks</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
            eBay Sandbox
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {connection.connected ? '✓' : '—'}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {connection.connected ? 'Connected' : 'Not connected — go to Settings'}
          </p>
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Create Listing</h2>
        <CreateListingForm />
      </div>
    </div>
  );
}
