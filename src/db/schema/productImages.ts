import { boolean, index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { products } from './products';

/**
 * One row per processed image. `licensed=true` restricts sources to
 * `ebay_catalog` and `icecat` — see Compliance Gate (Modul 2 step 5).
 * `ebay_eps_url` is filled after upload to eBay Picture Service so subsequent
 * relists reuse the URL instead of paying another EPS upload.
 */
export const productImages = pgTable(
  'product_images',
  {
    id: serial('id').primaryKey(),
    ean: text('ean')
      .notNull()
      .references(() => products.ean, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    source: text('source').notNull(),
    localPath: text('local_path').notNull(),
    ebayEpsUrl: text('ebay_eps_url'),
    ebayEpsUploadedAt: timestamp('ebay_eps_uploaded_at', { withTimezone: true }),
    width: integer('width'),
    height: integer('height'),
    licensed: boolean('licensed').notNull().default(false),
  },
  (t) => [index('product_images_ean_idx').on(t.ean)]
);

export type ProductImage = typeof productImages.$inferSelect;
export type NewProductImage = typeof productImages.$inferInsert;
