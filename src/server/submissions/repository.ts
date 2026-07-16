import { and, count, desc, eq, gte, gt } from 'drizzle-orm';

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
  findDuplicateRuling(
    clientKeyHash: string,
    normalizedName: string,
    normalizedRequest: string,
    since: Date,
  ): Promise<PublicRuling | null>;
  createRulingWithIdempotency(
    input: CreateSubmissionRulingInput,
  ): Promise<PublicRuling>;
};

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
          ruling: rulings,
        })
        .from(submissionIdempotency)
        .innerJoin(rulings, eq(submissionIdempotency.rulingId, rulings.id))
        .where(
          and(
            eq(submissionIdempotency.clientKeyHash, clientKeyHash),
            eq(submissionIdempotency.idempotencyKey, idempotencyKey),
            gt(submissionIdempotency.expiresAt, now),
          ),
        )
        .limit(1);

      return row ? mapRulingRowToPublicRuling(row.ruling) : null;
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
          ruling: rulings,
        })
        .from(submissionIdempotency)
        .innerJoin(rulings, eq(submissionIdempotency.rulingId, rulings.id))
        .where(
          and(
            eq(submissionIdempotency.clientKeyHash, clientKeyHash),
            eq(submissionIdempotency.normalizedName, normalizedName),
            eq(submissionIdempotency.normalizedRequest, normalizedRequest),
            gte(submissionIdempotency.createdAt, since),
          ),
        )
        .orderBy(desc(submissionIdempotency.createdAt))
        .limit(1);

      return row ? mapRulingRowToPublicRuling(row.ruling) : null;
    },
    async createRulingWithIdempotency(input) {
      const database = getDatabase();

      return database.transaction(async (transaction) => {
        const [createdRuling] = await transaction
          .insert(rulings)
          .values({
            publicId: input.publicId,
            displayName: input.displayName,
            requestText: input.requestText,
            decision: input.decision,
            santaResponse: input.santaResponse,
          })
          .returning();

        await transaction.insert(submissionIdempotency).values({
          clientKeyHash: input.clientKeyHash,
          idempotencyKey: input.idempotencyKey,
          normalizedName: input.normalizedName,
          normalizedRequest: input.normalizedRequest,
          rulingId: createdRuling.id,
          expiresAt: input.expiresAt,
        });

        return mapRulingRowToPublicRuling(createdRuling);
      });
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
          (ruling) => ruling.publicId === idempotencyRecord.rulingPublicId,
        ) ?? null
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
          (ruling) => ruling.publicId === match.rulingPublicId,
        ) ?? null
      );
    },
    async createRulingWithIdempotency(input) {
      const store = getTestRunStore(runId);
      const createdAt = new Date().toISOString();
      const ruling: PublicRuling = {
        publicId: input.publicId,
        displayName: input.displayName,
        requestText: input.requestText,
        decision: input.decision,
        santaResponse: input.santaResponse,
        createdAt,
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

      return ruling;
    },
  };
}
