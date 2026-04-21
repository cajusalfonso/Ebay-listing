import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Master product record keyed by EAN. One row per EAN — listings, images,
 * price-history and market-snapshots all reference it.
 *
 * `source_metadata` tracks which ProductSource populated which field
 * (e.g. `{ "title": "ebay_catalog", "brand": "icecat" }`) for audit.
 */
export const products = pgTable(
  'products',
  {
    ean: text('ean').primaryKey(),
    title: text('title').notNull(),
    brand: text('brand'),
    mpn: text('mpn'),
    description: text('description'),
    specs: jsonb('specs').$type<Record<string, string>>(),
    ebayCategoryId: text('ebay_category_id'),
    dataSource: text('data_source'),
    sourceMetadata: jsonb('source_metadata').$type<Record<string, string>>(),
    qualityScore: integer('quality_score'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('products_brand_idx').on(t.brand),
    index('products_category_idx').on(t.ebayCategoryId),
  ]
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
