import { sql } from 'drizzle-orm';
import { jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Cached SerpAPI Google Shopping responses for price comparison. Keyed by
 * (ean, country) so DE and FR snapshots are stored independently. Rows
 * older than 24h are considered stale and re-fetched; we don't bother with
 * a cleanup job because stale rows are just overwritten on next access.
 */
export const priceComparisons = pgTable(
  'price_comparisons',
  {
    ean: text('ean').notNull(),
    country: text('country').notNull(),
    results: jsonb('results').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [primaryKey({ columns: [t.ean, t.country] })]
);

export type PriceComparison = typeof priceComparisons.$inferSelect;
export type NewPriceComparison = typeof priceComparisons.$inferInsert;
