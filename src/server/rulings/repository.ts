import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from 'drizzle-orm';
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
  listFeaturedRulings(limit?: number): Promise<PublicRuling[]>;
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
  isFeatured: boolean;
  featuredAt?: Date | string | null;
  createdAt: Date | string;
};

type LegacyPublicRulingRow = Omit<PublicRulingRow, 'isFeatured' | 'featuredAt'>;

type DatabaseErrorLike = {
  code?: unknown;
  column?: unknown;
  message?: unknown;
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
    isFeatured: row.isFeatured,
    createdAt: serializeCreatedAt(row.createdAt),
  };
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
    databaseError?.code === '42703' &&
    (databaseError.column === 'is_featured' ||
      databaseError.column === 'featured_at')
  );
}

function mapLegacyRulingRowToPublicRuling(
  row: LegacyPublicRulingRow,
): PublicRuling {
  return mapRulingRowToPublicRuling({
    ...row,
    isFeatured: false,
    featuredAt: null,
  });
}

function buildLegacyDiscoveryWhereClause(query: PublicCommandsQuery) {
  const conditions: SQL[] = [
    sql`${rulings.decision} in ('approved'::ruling_decision, 'random-coal'::ruling_decision)`,
    sql`${rulings.visibility} = 'public'::ruling_visibility`,
  ];

  if (query.decision === 'approved') {
    conditions.push(sql`${rulings.decision} = 'approved'::ruling_decision`);
  }

  if (query.decision === 'coal') {
    conditions.push(sql`${rulings.decision} = 'random-coal'::ruling_decision`);
  }

  if (query.search) {
    const pattern = `%${query.search}%`;
    conditions.push(
      sql`(${rulings.displayName} ilike ${pattern} or ${rulings.requestText} ilike ${pattern})`,
    );
  }

  return sql`where ${sql.join(conditions, sql` and `)}`;
}

async function listLegacyRecentRulings(limit: number): Promise<PublicRuling[]> {
  const database = getDatabase();
  const result = await database.execute<LegacyPublicRulingRow>(sql`
    select
      id as "id",
      public_id as "publicId",
      display_name as "displayName",
      request_text as "requestText",
      decision as "decision",
      santa_response as "santaResponse",
      created_at as "createdAt"
    from rulings
    where decision in ('approved'::ruling_decision, 'random-coal'::ruling_decision)
      and visibility = 'public'::ruling_visibility
    order by created_at desc, id desc
    limit ${limit}
  `);

  return result.rows.map(mapLegacyRulingRowToPublicRuling);
}

async function listLegacyPublicRulingsForDiscovery(
  query: PublicCommandsQuery,
): Promise<PublicRulingsDiscoveryResult> {
  if (query.featuredOnly) {
    return {
      rulings: [],
      total: 0,
      totalPages: 1,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  const database = getDatabase();
  const whereClause = buildLegacyDiscoveryWhereClause(query);
  const offset = (query.page - 1) * query.pageSize;
  const orderByClause =
    query.sort === 'oldest'
      ? sql`order by created_at asc, id asc`
      : sql`order by created_at desc, id desc`;

  const [rowsResult, totalResult] = await Promise.all([
    database.execute<LegacyPublicRulingRow>(sql`
      select
        id as "id",
        public_id as "publicId",
        display_name as "displayName",
        request_text as "requestText",
        decision as "decision",
        santa_response as "santaResponse",
        created_at as "createdAt"
      from rulings
      ${whereClause}
      ${orderByClause}
      limit ${query.pageSize}
      offset ${offset}
    `),
    database.execute<{ value: number | string }>(sql`
      select count(*)::int as "value"
      from rulings
      ${whereClause}
    `),
  ]);
  const total = Number(totalResult.rows[0]?.value ?? 0);

  return {
    rulings: rowsResult.rows.map(mapLegacyRulingRowToPublicRuling),
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    page: query.page,
    pageSize: query.pageSize,
  };
}

async function getLegacyRulingByPublicId(
  publicId: string,
): Promise<PublicRuling | null> {
  const database = getDatabase();
  const result = await database.execute<LegacyPublicRulingRow>(sql`
    select
      id as "id",
      public_id as "publicId",
      display_name as "displayName",
      request_text as "requestText",
      decision as "decision",
      santa_response as "santaResponse",
      created_at as "createdAt"
    from rulings
    where public_id = ${publicId}
      and decision in ('approved'::ruling_decision, 'random-coal'::ruling_decision)
      and visibility = 'public'::ruling_visibility
    limit 1
  `);
  const row = result.rows[0];

  return row ? mapLegacyRulingRowToPublicRuling(row) : null;
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

  if (query.featuredOnly) {
    conditions.push(eq(rulings.isFeatured, true));
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
      let createdRuling: typeof rulings.$inferSelect | undefined;

      try {
        [createdRuling] = await database
          .insert(rulings)
          .values({
            publicId: input.publicId,
            displayName: input.displayName,
            requestText: input.requestText,
            decision: input.decision,
            santaResponse: input.santaResponse,
            isFeatured: false,
            visibility: 'public',
          })
          .returning();
      } catch (error) {
        if (!isMissingFeaturedColumnError(error)) {
          throw error;
        }

        const legacyInsert = await database.execute<LegacyPublicRulingRow>(sql`
          insert into rulings (
            public_id,
            display_name,
            request_text,
            decision,
            santa_response,
            visibility
          )
          values (
            ${input.publicId},
            ${input.displayName},
            ${input.requestText},
            ${input.decision}::ruling_decision,
            ${input.santaResponse},
            'public'::ruling_visibility
          )
          returning
            id as "id",
            public_id as "publicId",
            display_name as "displayName",
            request_text as "requestText",
            decision as "decision",
            santa_response as "santaResponse",
            created_at as "createdAt"
        `);
        const legacyRow = legacyInsert.rows[0];

        if (!legacyRow) {
          throw new Error('Ruling insert did not return a row.', {
            cause: error,
          });
        }

        return {
          id: legacyRow.id,
          publicRuling: mapLegacyRulingRowToPublicRuling(legacyRow),
        };
      }

      return {
        id: createdRuling.id,
        publicRuling: mapRulingRowToPublicRuling(createdRuling),
      };
    },
    async listRecentRulings(limit = santaSettings.recentRulings.visibleLimit) {
      const database = getDatabase();
      try {
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
      } catch (error) {
        if (!isMissingFeaturedColumnError(error)) {
          throw error;
        }

        return listLegacyRecentRulings(limit);
      }
    },
    async listFeaturedRulings(limit = 3) {
      const database = getDatabase();
      try {
        const rows = await database
          .select()
          .from(rulings)
          .where(
            and(
              inArray(rulings.decision, ['approved', 'random-coal']),
              eq(rulings.visibility, 'public'),
              eq(rulings.isFeatured, true),
            ),
          )
          .orderBy(desc(rulings.featuredAt), desc(rulings.id))
          .limit(limit);

        return rows.map(mapRulingRowToPublicRuling);
      } catch (error) {
        if (!isMissingFeaturedColumnError(error)) {
          throw error;
        }

        return [];
      }
    },
    async listPublicRulingsForDiscovery(query) {
      const database = getDatabase();
      try {
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
              isFeatured: rulings.isFeatured,
              featuredAt: rulings.featuredAt,
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
      } catch (error) {
        if (!isMissingFeaturedColumnError(error)) {
          throw error;
        }

        return listLegacyPublicRulingsForDiscovery(query);
      }
    },
    async getRulingByPublicId(publicId: string) {
      const database = getDatabase();
      try {
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
      } catch (error) {
        if (!isMissingFeaturedColumnError(error)) {
          throw error;
        }

        return getLegacyRulingByPublicId(publicId);
      }
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
