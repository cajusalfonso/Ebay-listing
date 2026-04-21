import { sql } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Per-user OAuth tokens from eBay. One row per (userId, ebayEnv) — users
 * can connect separate sandbox + production sessions. Tokens encrypted with
 * the app-level TOKEN_ENCRYPTION_KEY (same as user_credentials).
 *
 * Separate from the legacy `ebay_tokens` table (which was built for the
 * single-tenant CLI). The CLI keeps using `ebay_tokens`; the web app uses
 * this table. Business-logic modules consume the `TokenStore` interface so
 * they don't know which storage is in play.
 */
export const userEbayTokens = pgTable(
  'user_ebay_tokens',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ebayEnv: text('ebay_env').notNull(),
    accessTokenEncrypted: text('access_token_encrypted').notNull(),
    refreshTokenEncrypted: text('refresh_token_encrypted').notNull(),
    accessExpiresAt: timestamp('access_expires_at', { withTimezone: true }).notNull(),
    refreshExpiresAt: timestamp('refresh_expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('user_ebay_tokens_user_env_unique').on(t.userId, t.ebayEnv)]
);

export type UserEbayToken = typeof userEbayTokens.$inferSelect;
export type NewUserEbayToken = typeof userEbayTokens.$inferInsert;
