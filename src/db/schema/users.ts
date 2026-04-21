import { sql } from 'drizzle-orm';
import { pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * App users. Each user is a tenant — their `user_credentials` row holds
 * their own eBay / Icecat / Discord secrets (AES-256-GCM encrypted). Passwords
 * hashed with bcrypt (cost 12) — see `app/(auth)/actions.ts`.
 */
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
