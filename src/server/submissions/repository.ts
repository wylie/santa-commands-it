import { and, count, desc, eq, gte, gt, sql } from 'drizzle-orm';

import { getDatabase } from '@/server/db/client';
import {
  rulings,
  submissionAttempts,
  submissionIdempotency,
} from '@/server/db/schema';
import { mapRulingRowToPublicRuling } from '@/server/rulings/repository';
import { getTestRunStore } from '@/server/testing/store';
import type { PublicRuling } from '@/utils/rulings';

export type CreateSubmissionRulingInput = {
  publicId: string;
  displayName: string;
  requestText: string;
  decision: 'approved' | 'random-coal';
  santaResponse: string;
  createdAt?: Date;
  clientKeyHash: string;
  idempotencyKey: string;
  normalizedName: string;
  normalizedRequest: string;
  expiresAt: Date;
};

export type SubmissionRepository = {
  countSubmissionAttemptsSince(
    clientKeyHash: string,
    since: Date,
  ): Promise<number>;
  recordSubmissionAttempt(clientKeyHash: string): Promise<void>;
  getRulingByIdempotencyKey(
    clientKeyHash: string,
    idempotencyKey: string,
    now: Date,
  ): Promise<PublicRuling | null>;
  hasActiveIdempotencyKey(
    clientKeyHash: string,
    idempotencyKey: string,
    now: Date,
  ): Promise<boolean>;
  findDuplicateRuling(
    clientKeyHash: string,
    normalizedName: string,
    normalizedRequest: string,
    since: Date,
  ): Promise<PublicRuling | null>;
  hasHiddenDuplicateRuling(
    clientKeyHash: string,
    normalizedName: string,
    normalizedRequest: string,
    since: Date,
  ): Promise<boolean>;
  createRulingWithIdempotency(
    input: CreateSubmissionRulingInput,
  ): Promise<PublicRuling>;
};

type PersistedRulingInsertRow = {
  id: number;
  publicId: string;
  displayName: string;
  requestText: string;
  decision: 'approved' | 'random-coal';
  santaResponse: string;
  isFeatured: boolean;
  createdAt: Date | string;
};

type PublicRulingSelectRow = PersistedRulingInsertRow;

type DatabaseErrorLike = {
  code?: unknown;
  column?: unknown;
};

function mapInsertedRowToPublicRuling(
  row: PersistedRulingInsertRow,
): PublicRuling {
  return mapRulingRowToPublicRuling({
    id: Number(row.id),
    publicId: row.publicId,
    displayName: row.displayName,
    requestText: row.requestText,
    decision: row.decision,
    santaResponse: row.santaResponse,
    isFeatured: row.isFeatured,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
  });
}

function asDatabaseError(value: unknown): DatabaseErrorLike | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as DatabaseErrorLike;
}

function isMissingFeaturedColumnError(error: unknown): boolean {
  const databaseError = asDatabaseError(error);

  return (
    databaseError?.code === '42703' && databaseError.column === 'is_featured'
  );
}

export function createDatabaseSubmissionRepository(): SubmissionRepository {
  return {
    async countSubmissionAttemptsSince(clientKeyHash, since) {
      const database = getDatabase();
      const [result] = await database
        .select({
          value: count(),
        })
        .from(submissionAttempts)
        .where(
          and(
            eq(submissionAttempts.clientKeyHash, clientKeyHash),
            gte(submissionAttempts.createdAt, since),
          ),
        );

      return Number(result?.value ?? 0);
    },
    async recordSubmissionAttempt(clientKeyHash) {
      const database = getDatabase();
      await database.insert(submissionAttempts).values({
        clientKeyHash,
      });
    },
    async getRulingByIdempotencyKey(clientKeyHash, idempotencyKey, now) {
      const database = getDatabase();
      const [row] = await database
        .select({
          id: rulings.id,
          publicId: rulings.publicId,
          displayName: rulings.displayName,
          requestText: rulings.requestText,
          decision: rulings.decision,
          santaResponse: rulings.santaResponse,
          isFeatured: rulings.isFeatured,
          createdAt: rulings.createdAt,
        })
        .from(submissionIdempotency)
        .innerJoin(rulings, eq(submissionIdempotency.rulingId, rulings.id))
        .where(
          and(
            eq(submissionIdempotency.clientKeyHash, clientKeyHash),
            eq(submissionIdempotency.idempotencyKey, idempotencyKey),
            gt(submissionIdempotency.expiresAt, now),
            eq(rulings.visibility, 'public'),
          ),
        )
        .limit(1);

      return row ? mapInsertedRowToPublicRuling(row) : null;
    },
    async hasActiveIdempotencyKey(clientKeyHash, idempotencyKey, now) {
      const database = getDatabase();
      const [row] = await database
        .select({
          id: submissionIdempotency.id,
        })
        .from(submissionIdempotency)
        .where(
          and(
            eq(submissionIdempotency.clientKeyHash, clientKeyHash),
            eq(submissionIdempotency.idempotencyKey, idempotencyKey),
            gt(submissionIdempotency.expiresAt, now),
          ),
        )
        .limit(1);

      return Boolean(row);
    },
    async findDuplicateRuling(
      clientKeyHash,
      normalizedName,
      normalizedRequest,
      since,
    ) {
      const database = getDatabase();
      const [row] = await database
        .select({
          id: rulings.id,
          publicId: rulings.publicId,
          displayName: rulings.displayName,
          requestText: rulings.requestText,
          decision: rulings.decision,
          santaResponse: rulings.santaResponse,
          isFeatured: rulings.isFeatured,
          createdAt: rulings.createdAt,
        })
        .from(submissionIdempotency)
        .innerJoin(rulings, eq(submissionIdempotency.rulingId, rulings.id))
        .where(
          and(
            eq(submissionIdempotency.clientKeyHash, clientKeyHash),
            eq(submissionIdempotency.normalizedName, normalizedName),
            eq(submissionIdempotency.normalizedRequest, normalizedRequest),
            gte(submissionIdempotency.createdAt, since),
            eq(rulings.visibility, 'public'),
          ),
        )
        .orderBy(desc(submissionIdempotency.createdAt))
        .limit(1);

      return row ? mapInsertedRowToPublicRuling(row) : null;
    },
    async hasHiddenDuplicateRuling(
      clientKeyHash,
      normalizedName,
      normalizedRequest,
      since,
    ) {
      const database = getDatabase();
      const [row] = await database
        .select({
          id: submissionIdempotency.id,
        })
        .from(submissionIdempotency)
        .innerJoin(rulings, eq(submissionIdempotency.rulingId, rulings.id))
        .where(
          and(
            eq(submissionIdempotency.clientKeyHash, clientKeyHash),
            eq(submissionIdempotency.normalizedName, normalizedName),
            eq(submissionIdempotency.normalizedRequest, normalizedRequest),
            gte(submissionIdempotency.createdAt, since),
            eq(rulings.visibility, 'hidden'),
          ),
        )
        .orderBy(desc(submissionIdempotency.createdAt))
        .limit(1);

      return Boolean(row);
    },
    async createRulingWithIdempotency(input) {
      const database = getDatabase();
      let created;

      try {
        created = await database.execute(sql<PersistedRulingInsertRow>`
          WITH created_ruling AS (
            INSERT INTO rulings (
              public_id,
              display_name,
              request_text,
              decision,
              santa_response,
              visibility,
              is_featured,
              created_at
            )
            VALUES (
              ${input.publicId},
              ${input.displayName},
              ${input.requestText},
              ${input.decision}::ruling_decision,
              ${input.santaResponse},
              'public'::ruling_visibility,
              false,
              ${input.createdAt ?? new Date()}
            )
            RETURNING
              id,
              public_id,
              display_name,
              request_text,
              decision,
              santa_response,
              is_featured,
              created_at
          ),
          created_idempotency AS (
            INSERT INTO submission_idempotency (
              client_key_hash,
              idempotency_key,
              normalized_name,
              normalized_request,
              ruling_id,
              expires_at
            )
            SELECT
              ${input.clientKeyHash},
              ${input.idempotencyKey},
              ${input.normalizedName},
              ${input.normalizedRequest},
              created_ruling.id,
              ${input.expiresAt}
            FROM created_ruling
            RETURNING ruling_id
          )
          SELECT
            created_ruling.id AS "id",
            created_ruling.public_id AS "publicId",
            created_ruling.display_name AS "displayName",
            created_ruling.request_text AS "requestText",
            created_ruling.decision AS "decision",
            created_ruling.santa_response AS "santaResponse",
            created_ruling.is_featured AS "isFeatured",
            created_ruling.created_at AS "createdAt"
          FROM created_ruling
          INNER JOIN created_idempotency ON true
        `);
      } catch (error) {
        if (!isMissingFeaturedColumnError(error)) {
          throw error;
        }

        created = await database.execute(sql<PublicRulingSelectRow>`
          WITH created_ruling AS (
            INSERT INTO rulings (
              public_id,
              display_name,
              request_text,
              decision,
              santa_response,
              visibility,
              created_at
            )
            VALUES (
              ${input.publicId},
              ${input.displayName},
              ${input.requestText},
              ${input.decision}::ruling_decision,
              ${input.santaResponse},
              'public'::ruling_visibility,
              ${input.createdAt ?? new Date()}
            )
            RETURNING
              id,
              public_id,
              display_name,
              request_text,
              decision,
              santa_response,
              created_at
          ),
          created_idempotency AS (
            INSERT INTO submission_idempotency (
              client_key_hash,
              idempotency_key,
              normalized_name,
              normalized_request,
              ruling_id,
              expires_at
            )
            SELECT
              ${input.clientKeyHash},
              ${input.idempotencyKey},
              ${input.normalizedName},
              ${input.normalizedRequest},
              created_ruling.id,
              ${input.expiresAt}
            FROM created_ruling
            RETURNING ruling_id
          )
          SELECT
            created_ruling.id AS "id",
            created_ruling.public_id AS "publicId",
            created_ruling.display_name AS "displayName",
            created_ruling.request_text AS "requestText",
            created_ruling.decision AS "decision",
            created_ruling.santa_response AS "santaResponse",
            false AS "isFeatured",
            created_ruling.created_at AS "createdAt"
          FROM created_ruling
          INNER JOIN created_idempotency ON true
        `);
      }
      const [createdRuling] = created.rows as PersistedRulingInsertRow[];

      if (!createdRuling) {
        throw new Error('Ruling insert did not return a row.');
      }

      return mapInsertedRowToPublicRuling(createdRuling);
    },
  };
}

export function createTestSubmissionRepository(
  runId: string,
): SubmissionRepository {
  return {
    async countSubmissionAttemptsSince(clientKeyHash, since) {
      const threshold = since.getTime();

      return getTestRunStore(runId).submissionAttempts.filter(
        (attempt) =>
          attempt.clientKeyHash === clientKeyHash &&
          new Date(attempt.createdAt).getTime() >= threshold,
      ).length;
    },
    async recordSubmissionAttempt(clientKeyHash) {
      getTestRunStore(runId).submissionAttempts.push({
        clientKeyHash,
        createdAt: new Date().toISOString(),
      });
    },
    async getRulingByIdempotencyKey(clientKeyHash, idempotencyKey, now) {
      const store = getTestRunStore(runId);
      const idempotencyRecord = store.idempotencyRecords.find(
        (record) =>
          record.clientKeyHash === clientKeyHash &&
          record.idempotencyKey === idempotencyKey &&
          new Date(record.expiresAt).getTime() > now.getTime(),
      );

      if (!idempotencyRecord) {
        return null;
      }

      return (
        store.rulings.find(
          (ruling) =>
            ruling.publicId === idempotencyRecord.rulingPublicId &&
            ruling.visibility === 'public',
        ) ?? null
      );
    },
    async hasActiveIdempotencyKey(clientKeyHash, idempotencyKey, now) {
      const store = getTestRunStore(runId);

      return store.idempotencyRecords.some(
        (record) =>
          record.clientKeyHash === clientKeyHash &&
          record.idempotencyKey === idempotencyKey &&
          new Date(record.expiresAt).getTime() > now.getTime(),
      );
    },
    async findDuplicateRuling(
      clientKeyHash,
      normalizedName,
      normalizedRequest,
      since,
    ) {
      const store = getTestRunStore(runId);
      const threshold = since.getTime();
      const match = [...store.idempotencyRecords]
        .reverse()
        .find(
          (record) =>
            record.clientKeyHash === clientKeyHash &&
            record.normalizedName === normalizedName &&
            record.normalizedRequest === normalizedRequest &&
            new Date(record.createdAt).getTime() >= threshold,
        );

      if (!match) {
        return null;
      }

      return (
        store.rulings.find(
          (ruling) =>
            ruling.publicId === match.rulingPublicId &&
            ruling.visibility === 'public',
        ) ?? null
      );
    },
    async hasHiddenDuplicateRuling(
      clientKeyHash,
      normalizedName,
      normalizedRequest,
      since,
    ) {
      const store = getTestRunStore(runId);
      const threshold = since.getTime();
      const match = [...store.idempotencyRecords]
        .reverse()
        .find(
          (record) =>
            record.clientKeyHash === clientKeyHash &&
            record.normalizedName === normalizedName &&
            record.normalizedRequest === normalizedRequest &&
            new Date(record.createdAt).getTime() >= threshold,
        );

      if (!match) {
        return false;
      }

      return store.rulings.some(
        (ruling) =>
          ruling.publicId === match.rulingPublicId &&
          ruling.visibility === 'hidden',
      );
    },
    async createRulingWithIdempotency(input) {
      const store = getTestRunStore(runId);
      const createdAt = (input.createdAt ?? new Date()).toISOString();
      const ruling = {
        id: store.rulings.length + 1,
        publicId: input.publicId,
        displayName: input.displayName,
        requestText: input.requestText,
        decision: input.decision,
        santaResponse: input.santaResponse,
        isFeatured: false,
        featuredAt: null,
        createdAt,
        visibility: 'public' as const,
        hiddenAt: null,
        hiddenReason: null,
      };

      store.rulings.unshift(ruling);
      store.idempotencyRecords.push({
        clientKeyHash: input.clientKeyHash,
        idempotencyKey: input.idempotencyKey,
        normalizedName: input.normalizedName,
        normalizedRequest: input.normalizedRequest,
        rulingPublicId: input.publicId,
        createdAt,
        expiresAt: input.expiresAt.toISOString(),
      });

      return {
        publicId: ruling.publicId,
        displayName: ruling.displayName,
        requestText: ruling.requestText,
        decision: ruling.decision,
        santaResponse: ruling.santaResponse,
        isFeatured: ruling.isFeatured,
        createdAt: ruling.createdAt,
      };
    },
  };
}
