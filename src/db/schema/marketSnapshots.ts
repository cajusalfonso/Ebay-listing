import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { products } from './products';

/**
 * Point-in-time snapshot of eBay.de competitor landscape for an EAN.
 * Persisted because the pricing decision is derived from it — we need an
 * audit trail of *what the market looked like when we priced this listing*.
 */
export const marketSnapshots = pgTable(
  'market_snapshots',
  {
    id: serial('id').primaryKey(),
    ean: text('ean')
      .notNull()
      .references(() => products.ean, { onDelete: 'cascade' }),
    competitorCount: integer('competitor_count').notNull(),
    lowestPrice: numeric('lowest_price', { precision: 10, scale: 2 }),
    medianPrice: numeric('median_price', { precision: 10, scale: 2 }),
    snapshot: jsonb('snapshot').notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('market_snapshots_ean_idx').on(t.ean),
    index('market_snapshots_captured_at_idx').on(t.capturedAt),
  ]
);

export type MarketSnapshot = typeof marketSnapshots.$inferSelect;
export type NewMarketSnapshot = typeof marketSnapshots.$inferInsert;
