import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { priceComparisons } from '../../db/schema';
import type { ProductQuery, SerpApiProvider } from './serpApiProvider';
import type { PriceComparisonOffer, PriceComparisonSnapshot } from './types';

const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;

function cheapest(
  offers: readonly PriceComparisonOffer[],
  country: 'DE' | 'FR'
): PriceComparisonOffer | null {
  let min: PriceComparisonOffer | null = null;
  for (const o of offers) {
    if (o.country !== country) continue;
    if (min === null || o.priceEur < min.priceEur) min = o;
  }
  return min;
}

function sortByPrice(offers: readonly PriceComparisonOffer[]): PriceComparisonOffer[] {
  return [...offers].sort((a, b) => a.priceEur - b.priceEur);
}

/**
 * Fetch a price comparison for an EAN. DB-cached per (ean, country) with
 * a 24h TTL so repeated previews of the same product don't burn the user's
 * SerpAPI quota. Cache is global (not per-user) — prices are market-level.
 */
export async function getPriceComparison(
  query: ProductQuery,
  provider: SerpApiProvider,
  db: Database
): Promise<PriceComparisonSnapshot> {
  const { ean } = query;
  const now = Date.now();
  const threshold = new Date(now - CACHE_TTL_MS);

  // Read cached rows for both countries. A row per country so DE can be
  // cached fresh while FR is stale (we'll refetch both to keep it simple —
  // SerpAPI returns both in parallel anyway).
  const cachedRows = await db.select().from(priceComparisons).where(eq(priceComparisons.ean, ean));
  const freshDe = cachedRows.find((r) => r.country === 'DE' && r.fetchedAt > threshold);
  const freshFr = cachedRows.find((r) => r.country === 'FR' && r.fetchedAt > threshold);

  if (freshDe && freshFr) {
    const offers = sortByPrice([
      ...(freshDe.results as readonly PriceComparisonOffer[]),
      ...(freshFr.results as readonly PriceComparisonOffer[]),
    ]);
    const fetchedAt = new Date(Math.min(freshDe.fetchedAt.getTime(), freshFr.fetchedAt.getTime()));
    return {
      ean,
      offers,
      cheapestDe: cheapest(offers, 'DE'),
      cheapestFr: cheapest(offers, 'FR'),
      source: 'cache',
      fetchedAt,
    };
  }

  // Live fetch — provider handles DE + FR in parallel internally.
  const liveOffers = await provider.fetchForProduct(query);
  const deOffers = liveOffers.filter((o) => o.country === 'DE');
  const frOffers = liveOffers.filter((o) => o.country === 'FR');

  // Upsert each country row. Separate upserts so a partial success (DE ok,
  // FR empty) still caches the DE data correctly.
  await Promise.all(
    (['DE', 'FR'] as const).map(async (country) => {
      const slice = country === 'DE' ? deOffers : frOffers;
      await db
        .insert(priceComparisons)
        .values({
          ean,
          country,
          results: slice,
          fetchedAt: new Date(now),
        })
        .onConflictDoUpdate({
          target: [priceComparisons.ean, priceComparisons.country],
          set: { results: slice, fetchedAt: new Date(now) },
        });
    })
  );

  const combined = sortByPrice(liveOffers);
  return {
    ean,
    offers: combined,
    cheapestDe: cheapest(combined, 'DE'),
    cheapestFr: cheapest(combined, 'FR'),
    source: 'live',
    fetchedAt: new Date(now),
  };
}
