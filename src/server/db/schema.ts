import { sql } from 'drizzle-orm';
import {
  bigserial,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const rulingDecisionEnum = pgEnum('ruling_decision', [
  'approved',
  'random-coal',
]);

export const rulings = pgTable(
  'rulings',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    publicId: uuid('public_id').notNull().unique(),
    displayName: text('display_name').notNull(),
    requestText: text('request_text').notNull(),
    decision: rulingDecisionEnum('decision').notNull(),
    santaResponse: text('santa_response').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('rulings_created_at_idx').on(table.createdAt),
    check(
      'rulings_display_name_length_check',
      sql`char_length(${table.displayName}) between 1 and 40`,
    ),
    check(
      'rulings_request_text_length_check',
      sql`char_length(${table.requestText}) between 1 and 500`,
    ),
  ],
);
