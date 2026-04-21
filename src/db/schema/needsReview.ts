import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Parking lot for items that cannot be auto-published. Reason values include
 * `compliance_failed`, `data_missing`, `not_competitive`. `details` carries
 * the structured payload so a human reviewer can decide (e.g. which aspects
 * are missing, which blacklist pattern matched). `resolved_at` is set when
 * the issue is dealt with (either published manually or abandoned).
 *
 * `user_id` is nullable for legacy CLI records. Web queries MUST filter by it.
 */
export const needsReview = pgTable(
  'needs_review',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    ean: text('ean'),
    reason: text('reason').notNull(),
    details: jsonb('details'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [
    index('needs_review_user_idx').on(t.userId),
    index('needs_review_ean_idx').on(t.ean),
    index('needs_review_reason_idx').on(t.reason),
  ]
);

export type NeedsReviewRow = typeof needsReview.$inferSelect;
export type NewNeedsReviewRow = typeof needsReview.$inferInsert;
