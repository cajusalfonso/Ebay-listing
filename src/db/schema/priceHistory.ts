import { sql } from 'drizzle-orm';
import { index, numeric, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { products } from './products';

/**
 * Append-only log of observed prices per EAN per source. Used for
 * Phase-2 price-monitoring trends and to detect sudden market shifts.
 * `source` values: `ebay_browse`, future: `kaufland_public`, `otto_public`, ...
 */
export const priceHistory = pgTable(
  'price_history',
  {
    id: serial('id').primaryKey(),
    ean: text('ean')
      .notNull()
      .references(() => products.ean, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('EUR'),
    capturedAt: timestamp('captured_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('price_history_ean_idx').on(t.ean),
    index('price_history_ean_captured_idx').on(t.ean, t.capturedAt),
  ]
);

export type PriceHistoryRow = typeof priceHistory.$inferSelect;
export type NewPriceHistoryRow = typeof priceHistory.$inferInsert;
