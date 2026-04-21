import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { marketSnapshots } from './marketSnapshots';
import { products } from './products';
import { users } from './users';

/**
 * eBay listing state. `ebay_sku` is our own stable SKU identifier sent to eBay
 * Inventory API; it must be globally unique in our DB to prevent accidental
 * double-publish. `ebay_offer_id` and `ebay_listing_id` are returned by eBay
 * and may be null until publish succeeds.
 *
 * Status lifecycle: draft → published → (paused | ended | failed).
 * Compliance blockers captured at pre-publish time — even for `failed` rows we
 * keep the reason in `compliance_blockers` for later review.
 */
export const listings = pgTable(
  'listings',
  {
    id: serial('id').primaryKey(),
    /**
     * Tenant owner. Nullable for legacy CLI records written before multi-tenancy;
     * new web-app writes always set it. All web queries MUST filter by user_id.
     */
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    ean: text('ean')
      .notNull()
      .references(() => products.ean, { onDelete: 'restrict' }),
    ebayEnvironment: text('ebay_environment').notNull(),
    ebaySku: text('ebay_sku').notNull(),
    ebayOfferId: text('ebay_offer_id'),
    ebayListingId: text('ebay_listing_id'),
    sellPriceGross: numeric('sell_price_gross', { precision: 10, scale: 2 }).notNull(),
    cogs: numeric('cogs', { precision: 10, scale: 2 }).notNull(),
    calculatedProfit: numeric('calculated_profit', { precision: 10, scale: 2 }),
    calculatedMargin: numeric('calculated_margin', { precision: 5, scale: 4 }),
    status: text('status').notNull().default('draft'),
    compliancePassed: boolean('compliance_passed').notNull().default(false),
    complianceBlockers: jsonb('compliance_blockers').$type<string[]>(),
    lastMarketSnapshotId: integer('last_market_snapshot_id').references(() => marketSnapshots.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex('listings_ebay_sku_unique').on(t.ebaySku),
    index('listings_user_idx').on(t.userId),
    index('listings_user_status_idx').on(t.userId, t.status),
    index('listings_ean_idx').on(t.ean),
    index('listings_status_idx').on(t.status),
    index('listings_environment_idx').on(t.ebayEnvironment),
  ]
);

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
