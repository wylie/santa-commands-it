import { and, desc, eq, inArray } from 'drizzle-orm';

import { santaSettings } from '@/config/santa-settings';
import {
  isPersistedRulingDecision,
  serializeCreatedAt,
  type PersistedRulingDecision,
  type PublicRuling,
} from '@/utils/rulings';
import { getDatabase } from '@/server/db/client';
import { rulings } from '@/server/db/schema';

export type CreateRulingInput = {
  publicId: string;
  displayName: string;
  requestText: string;
  decision: PersistedRulingDecision;
  santaResponse: string;
};

export type StoredRuling = {
  id: number;
  publicRuling: PublicRuling;
};

export type RulingReference = {
  id: number;
  publicId: string;
};

export type RulingsRepository = {
  createRuling(input: CreateRulingInput): Promise<PublicRuling>;
  createStoredRuling(input: CreateRulingInput): Promise<StoredRuling>;
  listRecentRulings(limit?: number): Promise<PublicRuling[]>;
  getRulingByPublicId(publicId: string): Promise<PublicRuling | null>;
  getRulingReferenceByPublicId(
    publicId: string,
  ): Promise<RulingReference | null>;
};

type RulingRow = typeof rulings.$inferSelect;

export function mapRulingRowToPublicRuling(row: RulingRow): PublicRuling {
  if (!isPersistedRulingDecision(row.decision)) {
    throw new Error('Only approved and random-coal rulings can be public.');
  }

  return {
    publicId: row.publicId,
    displayName: row.displayName,
    requestText: row.requestText,
    decision: row.decision,
    santaResponse: row.santaResponse,
    createdAt: serializeCreatedAt(row.createdAt),
  };
}

export function createDatabaseRulingsRepository(): RulingsRepository {
  return {
    async createRuling(input) {
      const storedRuling = await this.createStoredRuling(input);

      return storedRuling.publicRuling;
    },
    async createStoredRuling(input) {
      const database = getDatabase();
      const [createdRuling] = await database
        .insert(rulings)
        .values({
          publicId: input.publicId,
          displayName: input.displayName,
          requestText: input.requestText,
          decision: input.decision,
          santaResponse: input.santaResponse,
        })
        .returning();

      return {
        id: createdRuling.id,
        publicRuling: mapRulingRowToPublicRuling(createdRuling),
      };
    },
    async listRecentRulings(limit = santaSettings.recentRulings.visibleLimit) {
      const database = getDatabase();
      const rows = await database
        .select()
        .from(rulings)
        .where(inArray(rulings.decision, ['approved', 'random-coal']))
        .orderBy(desc(rulings.createdAt), desc(rulings.id))
        .limit(limit);

      return rows.map(mapRulingRowToPublicRuling);
    },
    async getRulingByPublicId(publicId: string) {
      const database = getDatabase();
      const [row] = await database
        .select()
        .from(rulings)
        .where(
          and(
            eq(rulings.publicId, publicId),
            inArray(rulings.decision, ['approved', 'random-coal']),
          ),
        )
        .limit(1);

      return row ? mapRulingRowToPublicRuling(row) : null;
    },
    async getRulingReferenceByPublicId(publicId: string) {
      const database = getDatabase();
      const [row] = await database
        .select({
          id: rulings.id,
          publicId: rulings.publicId,
        })
        .from(rulings)
        .where(
          and(
            eq(rulings.publicId, publicId),
            inArray(rulings.decision, ['approved', 'random-coal']),
          ),
        )
        .limit(1);

      return row ?? null;
    },
  };
}
