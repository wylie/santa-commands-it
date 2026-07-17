import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
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

export const rulingVisibilityEnum = pgEnum('ruling_visibility', [
  'public',
  'hidden',
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

export const ownerActivityActionEnum = pgEnum('owner_activity_action', [
  'login-success',
  'login-failure',
  'logout',
  'ruling-hidden',
  'ruling-restored',
  'ruling-deleted',
  'report-reviewed',
  'report-dismissed',
  'report-reopened',
  'report-actioned',
  'ruling-hidden-from-report',
  'related-reports-actioned',
]);

export const ownerActivityTargetTypeEnum = pgEnum(
  'owner_activity_target_type',
  ['auth', 'ruling', 'report'],
);

export const rulings = pgTable(
  'rulings',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    publicId: uuid('public_id').notNull().unique(),
    displayName: text('display_name').notNull(),
    requestText: text('request_text').notNull(),
    decision: rulingDecisionEnum('decision').notNull(),
    santaResponse: text('santa_response').notNull(),
    visibility: rulingVisibilityEnum('visibility').default('public').notNull(),
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    hiddenReason: text('hidden_reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('rulings_created_at_idx').on(table.createdAt),
    index('rulings_visibility_created_at_idx').on(
      table.visibility,
      table.createdAt,
    ),
    check(
      'rulings_display_name_length_check',
      sql`char_length(${table.displayName}) between 1 and 40`,
    ),
    check(
      'rulings_request_text_length_check',
      sql`char_length(${table.requestText}) between 1 and 500`,
    ),
    check(
      'rulings_hidden_reason_length_check',
      sql`${table.hiddenReason} is null or char_length(${table.hiddenReason}) <= 300`,
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
    publicId: text('public_id').notNull().unique(),
    rulingId: bigint('ruling_id', { mode: 'number' })
      .notNull()
      .references(() => rulings.id, {
        onDelete: 'cascade',
      }),
    clientKeyHash: text('client_key_hash').notNull(),
    reason: reportReasonEnum('reason').notNull(),
    note: text('note'),
    status: reportStatusEnum('status').default('open').notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionNote: text('resolution_note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('ruling_reports_public_id_idx').on(table.publicId),
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
    index('ruling_reports_ruling_status_created_idx').on(
      table.rulingId,
      table.status,
      table.createdAt,
    ),
    check(
      'ruling_reports_note_length_check',
      sql`${table.note} is null or char_length(${table.note}) <= 300`,
    ),
    check(
      'ruling_reports_resolution_note_length_check',
      sql`${table.resolutionNote} is null or char_length(${table.resolutionNote}) <= 500`,
    ),
  ],
);

export const workshopSessions = pgTable(
  'workshop_sessions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tokenHash: text('token_hash').notNull().unique(),
    csrfToken: text('csrf_token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('workshop_sessions_expires_at_idx').on(table.expiresAt)],
);

export const workshopLoginAttempts = pgTable(
  'workshop_login_attempts',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    clientKeyHash: text('client_key_hash').notNull(),
    successful: boolean('successful').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('workshop_login_attempts_client_created_idx').on(
      table.clientKeyHash,
      table.createdAt,
    ),
  ],
);

export const ownerActivity = pgTable(
  'owner_activity',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    action: ownerActivityActionEnum('action').notNull(),
    targetType: ownerActivityTargetTypeEnum('target_type').notNull(),
    targetPublicId: text('target_public_id'),
    relatedPublicId: text('related_public_id'),
    details: text('details'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('owner_activity_created_at_idx').on(table.createdAt),
    index('owner_activity_target_public_id_idx').on(table.targetPublicId),
    index('owner_activity_related_public_id_idx').on(table.relatedPublicId),
    check(
      'owner_activity_details_length_check',
      sql`${table.details} is null or char_length(${table.details}) <= 500`,
    ),
  ],
);
