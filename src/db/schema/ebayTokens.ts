import { sql } from 'drizzle-orm';
import { pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Encrypted OAuth token storage. One row per environment (sandbox | production).
 * Both tokens are AES-256-GCM encrypted with key from env `TOKEN_ENCRYPTION_KEY`.
 *
 * Refresh logic: if `access_expires_at - now() < 5 min` → refresh via refresh token.
 * If refresh token is also expired → force re-auth via `pnpm setup:ebay-auth`.
 */
export const ebayTokens = pgTable(
  'ebay_tokens',
  {
    id: serial('id').primaryKey(),
    environment: text('environment').notNull(),
    accessTokenEncrypted: text('access_token_encrypted').notNull(),
    refreshTokenEncrypted: text('refresh_token_encrypted').notNull(),
    accessExpiresAt: timestamp('access_expires_at', { withTimezone: true }).notNull(),
    refreshExpiresAt: timestamp('refresh_expires_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('ebay_tokens_environment_unique').on(t.environment)]
);

export type EbayToken = typeof ebayTokens.$inferSelect;
export type NewEbayToken = typeof ebayTokens.$inferInsert;
