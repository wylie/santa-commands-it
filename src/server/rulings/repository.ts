import { desc, inArray } from 'drizzle-orm';

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

export type RulingsRepository = {
  createRuling(input: CreateRulingInput): Promise<PublicRuling>;
  listRecentRulings(limit?: number): Promise<PublicRuling[]>;
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

      return mapRulingRowToPublicRuling(createdRuling);
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
  };
}
