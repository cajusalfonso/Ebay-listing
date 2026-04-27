import { sql } from 'drizzle-orm';
import { integer, numeric, pgTable, serial, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Per-user pricing strategy thresholds. Replaces the hardcoded constants
 * `minAbsoluteProfit: 10`, `minMarginPercent: 0.08`, etc. that lived in
 * `dashboard/actions.ts`. Mirrors the BuyBridge "Profitability Threshold
 * Settings" panel — same semantics, same defaults.
 *
 * One row per user. Defaults applied if no row exists (so existing accounts
 * don't silently break before they save anything).
 */
export const userPricingSettings = pgTable(
  'user_pricing_settings',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Minimum absolute profit per sale in EUR. Below this → list is blocked. */
    minProfitEur: numeric('min_profit_eur', { precision: 10, scale: 2 })
      .notNull()
      .default('10.00'),
    /** Minimum margin (profit / net revenue), 0–1. e.g. 0.08 = 8 %. */
    minMarginPercent: numeric('min_margin_percent', { precision: 6, scale: 4 })
      .notNull()
      .default('0.0800'),
    /** Minimum ROI (profit / COGS), 0–1. e.g. 0.08 = 8 %. */
    minRoiPercent: numeric('min_roi_percent', { precision: 6, scale: 4 })
      .notNull()
      .default('0.0800'),
    /** Multiplier for the exploratory price when there are no competitors. */
    targetMarginMultiplier: numeric('target_margin_multiplier', { precision: 6, scale: 4 })
      .notNull()
      .default('1.2500'),
    /** EUR amount to undercut the cheapest competitor by when listing. */
    undercutAmountEur: numeric('undercut_amount_eur', { precision: 10, scale: 2 })
      .notNull()
      .default('0.50'),
    /** Default eBay category fee percent if taxonomy lookup fails. e.g. 0.12 = 12 %. */
    categoryFeePercent: numeric('category_fee_percent', { precision: 6, scale: 4 })
      .notNull()
      .default('0.1200'),
    /** VAT rate applied to gross→net conversion. e.g. 0.19 = 19 %. */
    vatRate: numeric('vat_rate', { precision: 6, scale: 4 }).notNull().default('0.1900'),
    /** Reserve held back per sale for expected returns. e.g. 0.03 = 3 %. */
    returnReservePercent: numeric('return_reserve_percent', { precision: 6, scale: 4 })
      .notNull()
      .default('0.0300'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('user_pricing_settings_user_unique').on(t.userId)]
);

export type UserPricingSettings = typeof userPricingSettings.$inferSelect;
export type NewUserPricingSettings = typeof userPricingSettings.$inferInsert;
