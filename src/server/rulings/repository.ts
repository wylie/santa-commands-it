import { and, asc, count, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import { santaSettings } from '@/config/santa-settings';
import {
  isPersistedRulingDecision,
  serializeCreatedAt,
  type PersistedRulingDecision,
  type PublicRuling,
} from '@/utils/rulings';
import type {
  PublicCommandsDiscoveryRuling,
  PublicCommandsQuery,
} from '@/utils/publicCommands';
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

export type PublicRulingsDiscoveryResult = {
  rulings: PublicCommandsDiscoveryRuling[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

export type RulingsRepository = {
  createRuling(input: CreateRulingInput): Promise<PublicRuling>;
  createStoredRuling(input: CreateRulingInput): Promise<StoredRuling>;
  listRecentRulings(limit?: number): Promise<PublicRuling[]>;
  listPublicRulingsForDiscovery(
    query: PublicCommandsQuery,
  ): Promise<PublicRulingsDiscoveryResult>;
  getRulingByPublicId(publicId: string): Promise<PublicRuling | null>;
  getRulingReferenceByPublicId(
    publicId: string,
  ): Promise<RulingReference | null>;
};

type PublicRulingRow = {
  id: number;
  publicId: string;
  displayName: string;
  requestText: string;
  decision: PersistedRulingDecision;
  santaResponse: string;
  createdAt: Date | string;
};

export function mapRulingRowToPublicRuling(row: PublicRulingRow): PublicRuling {
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

function buildPublicDiscoveryWhere(query: PublicCommandsQuery): SQL {
  const conditions: SQL[] = [
    inArray(rulings.decision, ['approved', 'random-coal']),
    eq(rulings.visibility, 'public'),
  ];

  if (query.decision === 'approved') {
    conditions.push(eq(rulings.decision, 'approved'));
  }

  if (query.decision === 'coal') {
    conditions.push(eq(rulings.decision, 'random-coal'));
  }

  if (query.search) {
    const pattern = `%${query.search}%`;
    const searchCondition = or(
      ilike(rulings.displayName, pattern),
      ilike(rulings.requestText, pattern),
    );

    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  return and(...conditions) as SQL;
}

function mapDiscoveryRow(row: PublicRulingRow): PublicCommandsDiscoveryRuling {
  return mapRulingRowToPublicRuling(row);
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
          visibility: 'public',
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
        .where(
          and(
            inArray(rulings.decision, ['approved', 'random-coal']),
            eq(rulings.visibility, 'public'),
          ),
        )
        .orderBy(desc(rulings.createdAt), desc(rulings.id))
        .limit(limit);

      return rows.map(mapRulingRowToPublicRuling);
    },
    async listPublicRulingsForDiscovery(query) {
      const database = getDatabase();
      const where = buildPublicDiscoveryWhere(query);
      const offset = (query.page - 1) * query.pageSize;
      const orderBy =
        query.sort === 'oldest'
          ? [asc(rulings.createdAt), asc(rulings.id)]
          : [desc(rulings.createdAt), desc(rulings.id)];

      const [rows, [totalRow]] = await Promise.all([
        database
          .select({
            id: rulings.id,
            publicId: rulings.publicId,
            displayName: rulings.displayName,
            requestText: rulings.requestText,
            decision: rulings.decision,
            santaResponse: rulings.santaResponse,
            createdAt: rulings.createdAt,
          })
          .from(rulings)
          .where(where)
          .orderBy(...orderBy)
          .limit(query.pageSize)
          .offset(offset),
        database.select({ value: count() }).from(rulings).where(where),
      ]);
      const total = Number(totalRow?.value ?? 0);

      return {
        rulings: rows.map(mapDiscoveryRow),
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        page: query.page,
        pageSize: query.pageSize,
      };
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
            eq(rulings.visibility, 'public'),
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
            eq(rulings.visibility, 'public'),
          ),
        )
        .limit(1);

      return row ?? null;
    },
  };
}
