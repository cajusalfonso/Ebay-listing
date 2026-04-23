import { sql } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Per-user API credentials. All secret fields are AES-256-GCM encrypted with
 * the app-level `TOKEN_ENCRYPTION_KEY` (same key that protects ebay_tokens).
 * One row per (user, ebay_env) — users can have separate sandbox + production creds.
 *
 * GDPR note: deleting a user cascades and wipes all their credentials.
 */
export const userCredentials = pgTable(
  'user_credentials',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ebayEnv: text('ebay_env').notNull(),
    ebayAppIdEncrypted: text('ebay_app_id_encrypted'),
    ebayCertIdEncrypted: text('ebay_cert_id_encrypted'),
    ebayDevIdEncrypted: text('ebay_dev_id_encrypted'),
    ebayRedirectUriName: text('ebay_redirect_uri_name'),
    icecatUserEncrypted: text('icecat_user_encrypted'),
    icecatPasswordEncrypted: text('icecat_password_encrypted'),
    discordWebhookUrlEncrypted: text('discord_webhook_url_encrypted'),
    /** SerpAPI key for Google Shopping price comparison (DE + FR). */
    serpApiKeyEncrypted: text('serp_api_key_encrypted'),
    /** Merchant inventory location key registered in the user's eBay Seller Hub. */
    merchantLocationKey: text('merchant_location_key'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`)
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('user_credentials_user_env_unique').on(t.userId, t.ebayEnv)]
);

export type UserCredentials = typeof userCredentials.$inferSelect;
export type NewUserCredentials = typeof userCredentials.$inferInsert;
