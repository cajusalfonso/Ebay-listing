import { sql } from 'drizzle-orm';
import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Auth.js v5 session storage. Rows are written by the DrizzleAdapter when
 * sessions are persisted (we use JWT by default, so this table is rarely
 * used, but keeping it ready for a switch to database sessions without
 * another migration).
 */
export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type Session = typeof sessions.$inferSelect;
