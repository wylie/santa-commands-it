import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const rulingDecisionEnum = pgEnum('ruling_decision', [
  'approved',
  'random-coal',
]);

export const reportReasonEnum = pgEnum('report_reason', [
  'bullying',
  'hate',
  'personal-information',
  'inappropriate',
  'threats',
  'spam',
  'other',
]);

export const reportStatusEnum = pgEnum('report_status', [
  'open',
  'reviewed',
  'dismissed',
  'actioned',
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

export const submissionAttempts = pgTable(
  'submission_attempts',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    clientKeyHash: text('client_key_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('submission_attempts_client_created_idx').on(
      table.clientKeyHash,
      table.createdAt,
    ),
  ],
);

export const submissionIdempotency = pgTable(
  'submission_idempotency',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    clientKeyHash: text('client_key_hash').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    normalizedName: text('normalized_name').notNull(),
    normalizedRequest: text('normalized_request').notNull(),
    rulingId: bigint('ruling_id', { mode: 'number' })
      .notNull()
      .references(() => rulings.id, {
        onDelete: 'cascade',
      }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex('submission_idempotency_client_key_idx').on(
      table.clientKeyHash,
      table.idempotencyKey,
    ),
    index('submission_idempotency_duplicate_idx').on(
      table.clientKeyHash,
      table.normalizedName,
      table.normalizedRequest,
      table.createdAt,
    ),
    check(
      'submission_idempotency_key_length_check',
      sql`char_length(${table.idempotencyKey}) between 1 and 64`,
    ),
  ],
);

export const rulingReports = pgTable(
  'ruling_reports',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    rulingId: bigint('ruling_id', { mode: 'number' })
      .notNull()
      .references(() => rulings.id, {
        onDelete: 'cascade',
      }),
    clientKeyHash: text('client_key_hash').notNull(),
    reason: reportReasonEnum('reason').notNull(),
    note: text('note'),
    status: reportStatusEnum('status').default('open').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('ruling_reports_client_created_idx').on(
      table.clientKeyHash,
      table.createdAt,
    ),
    index('ruling_reports_ruling_client_created_idx').on(
      table.rulingId,
      table.clientKeyHash,
      table.createdAt,
    ),
    index('ruling_reports_status_created_idx').on(
      table.status,
      table.createdAt,
    ),
    check(
      'ruling_reports_note_length_check',
      sql`${table.note} is null or char_length(${table.note}) <= 300`,
    ),
  ],
);
