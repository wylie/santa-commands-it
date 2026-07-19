import { and, asc, count, desc, eq, gte, ilike, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import { securitySettings } from '@/config/security';
import { getDatabase } from '@/server/db/client';
import {
  ownerActivity,
  rulingReports,
  rulings,
  workshopLoginAttempts,
  workshopSessions,
} from '@/server/db/schema';
import type {
  DashboardTimeWindow,
  WorkshopDashboardRulingMetrics,
  WorkshopDashboardTrendRow,
} from '@/server/workshop/dashboard';
import type {
  TestReportRecord,
  TestStoredRuling,
} from '@/server/testing/store';
import { getTestRunStore } from '@/server/testing/store';
import { serializeCreatedAt } from '@/utils/rulings';
import type {
  OwnerActivityAction,
  OwnerActivityEntry,
  OwnerActivityTargetType,
  WorkshopDashboardMetrics,
  WorkshopRulingDetail,
  WorkshopRulingFilters,
  WorkshopRulingSummary,
} from '@/utils/workshop';
import { serializeOptionalTimestamp } from '@/utils/workshop';

export type WorkshopSessionRecord = {
  tokenHash: string;
  csrfToken: string;
  expiresAt: string;
};

export type CreateWorkshopSessionInput = {
  tokenHash: string;
  csrfToken: string;
  expiresAt: Date;
};

export type CreateOwnerActivityInput = {
  action: OwnerActivityAction;
  targetType: OwnerActivityTargetType;
  targetPublicId?: string | null;
  relatedPublicId?: string | null;
  details?: string | null;
};

export type ListWorkshopRulingsResult = {
  rulings: WorkshopRulingSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type WorkshopAuthRepository = {
  countFailedLoginAttemptsSince(
    clientKeyHash: string,
    since: Date,
  ): Promise<number>;
  recordLoginAttempt(clientKeyHash: string, successful: boolean): Promise<void>;
  clearFailedLoginAttempts(clientKeyHash: string): Promise<void>;
  createSession(input: CreateWorkshopSessionInput): Promise<void>;
  getSession(
    tokenHash: string,
    now: Date,
  ): Promise<WorkshopSessionRecord | null>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteExpiredSessions(now: Date): Promise<void>;
};

export type WorkshopRepository = {
  ping(): Promise<void>;
  getDashboardMetrics(): Promise<WorkshopDashboardMetrics>;
  getDashboardRulingMetrics(
    window: DashboardTimeWindow,
  ): Promise<WorkshopDashboardRulingMetrics>;
  getDashboardRulingTrend(
    window: DashboardTimeWindow,
  ): Promise<WorkshopDashboardTrendRow[]>;
  listRecentWorkshopRulings(limit?: number): Promise<WorkshopRulingSummary[]>;
  listWorkshopRulings(
    filters: WorkshopRulingFilters,
  ): Promise<ListWorkshopRulingsResult>;
  getWorkshopRulingByPublicId(
    publicId: string,
  ): Promise<WorkshopRulingDetail | null>;
  hideRuling(
    publicId: string,
    reason: string | null,
    now: Date,
  ): Promise<'not-found' | 'already-hidden' | WorkshopRulingDetail>;
  setRulingFeatured(
    publicId: string,
    featured: boolean,
    now: Date,
  ): Promise<
    | 'not-found'
    | 'hidden'
    | 'already-featured'
    | 'already-unfeatured'
    | WorkshopRulingDetail
  >;
  restoreRuling(
    publicId: string,
  ): Promise<'not-found' | 'already-public' | WorkshopRulingDetail>;
  deleteRuling(publicId: string): Promise<boolean>;
  createOwnerActivity(input: CreateOwnerActivityInput): Promise<void>;
  listRecentOwnerActivity(limit?: number): Promise<OwnerActivityEntry[]>;
  listOwnerActivityForRuling(
    publicId: string,
    limit?: number,
  ): Promise<OwnerActivityEntry[]>;
  listOwnerActivityForReport(
    publicId: string,
    limit?: number,
  ): Promise<OwnerActivityEntry[]>;
};

type WorkshopRulingRow = typeof rulings.$inferSelect & {
  reportCount: number;
  openReportCount: number;
  latestReportAt: Date | null;
};

function mapWorkshopRulingRow(row: WorkshopRulingRow): WorkshopRulingSummary {
  return {
    publicId: row.publicId,
    displayName: row.displayName,
    requestText: row.requestText,
    decision: row.decision,
    santaResponse: row.santaResponse,
    visibility: row.visibility,
    isFeatured: row.isFeatured,
    featuredAt: serializeOptionalTimestamp(row.featuredAt),
    hiddenAt: serializeOptionalTimestamp(row.hiddenAt),
    hiddenReason: row.hiddenReason,
    createdAt: serializeCreatedAt(row.createdAt),
    reportCount: Number(row.reportCount ?? 0),
    openReportCount: Number(row.openReportCount ?? 0),
    latestReportAt: serializeOptionalTimestamp(row.latestReportAt),
  };
}

function mapOwnerActivityRow(
  row: typeof ownerActivity.$inferSelect,
): OwnerActivityEntry {
  return {
    action: row.action,
    targetType: row.targetType,
    targetPublicId: row.targetPublicId,
    relatedPublicId: row.relatedPublicId,
    details: row.details,
    createdAt: serializeCreatedAt(row.createdAt),
  };
}

function buildWorkshopRulingWhere(filters: WorkshopRulingFilters) {
  const conditions: SQL[] = [];

  if (filters.decision !== 'all') {
    conditions.push(eq(rulings.decision, filters.decision));
  }

  if (filters.visibility !== 'all') {
    conditions.push(eq(rulings.visibility, filters.visibility));
  }

  if (filters.featured === 'featured') {
    conditions.push(eq(rulings.isFeatured, true));
  }

  if (filters.featured === 'not-featured') {
    conditions.push(eq(rulings.isFeatured, false));
  }

  if (filters.query) {
    const pattern = `%${filters.query}%`;
    const searchCondition = or(
      ilike(rulings.displayName, pattern),
      ilike(rulings.requestText, pattern),
      ilike(rulings.santaResponse, pattern),
      sql`${rulings.publicId}::text ilike ${pattern}`,
    );

    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  return conditions.length ? and(...conditions) : undefined;
}

function parseCount(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function isWithinTimeWindow(value: string, start: Date | null, end: Date) {
  const timestamp = new Date(value).getTime();

  return (
    timestamp < end.getTime() &&
    (start === null || timestamp >= start.getTime())
  );
}

function getTestBucketKey(
  value: string,
  bucketGranularity: DashboardTimeWindow['bucketGranularity'],
  timeZone: string,
) {
  if (bucketGranularity === 'day') {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(new Date(value))
      .replace(/\//g, '-');
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';

  return `${year}-${month}`;
}

export function createDatabaseWorkshopAuthRepository(): WorkshopAuthRepository {
  return {
    async countFailedLoginAttemptsSince(clientKeyHash, since) {
      const database = getDatabase();
      const [result] = await database
        .select({ value: count() })
        .from(workshopLoginAttempts)
        .where(
          and(
            eq(workshopLoginAttempts.clientKeyHash, clientKeyHash),
            eq(workshopLoginAttempts.successful, false),
            gte(workshopLoginAttempts.createdAt, since),
          ),
        );

      return Number(result?.value ?? 0);
    },
    async recordLoginAttempt(clientKeyHash, successful) {
      const database = getDatabase();

      await database.insert(workshopLoginAttempts).values({
        clientKeyHash,
        successful,
      });
    },
    async clearFailedLoginAttempts(clientKeyHash) {
      const database = getDatabase();

      await database
        .delete(workshopLoginAttempts)
        .where(
          and(
            eq(workshopLoginAttempts.clientKeyHash, clientKeyHash),
            eq(workshopLoginAttempts.successful, false),
          ),
        );
    },
    async createSession(input) {
      const database = getDatabase();

      await database.insert(workshopSessions).values({
        tokenHash: input.tokenHash,
        csrfToken: input.csrfToken,
        expiresAt: input.expiresAt,
      });
    },
    async getSession(tokenHash, now) {
      const database = getDatabase();
      const [session] = await database
        .select()
        .from(workshopSessions)
        .where(
          and(
            eq(workshopSessions.tokenHash, tokenHash),
            gte(workshopSessions.expiresAt, now),
          ),
        )
        .limit(1);

      if (!session) {
        return null;
      }

      return {
        tokenHash: session.tokenHash,
        csrfToken: session.csrfToken,
        expiresAt: serializeCreatedAt(session.expiresAt),
      };
    },
    async deleteSession(tokenHash) {
      const database = getDatabase();
      await database
        .delete(workshopSessions)
        .where(eq(workshopSessions.tokenHash, tokenHash));
    },
    async deleteExpiredSessions(now) {
      const database = getDatabase();
      await database
        .delete(workshopSessions)
        .where(sql`${workshopSessions.expiresAt} < ${now}`);
    },
  };
}

export function createDatabaseWorkshopRepository(): WorkshopRepository {
  return {
    async ping() {
      const database = getDatabase();
      await database.execute(sql`select 1`);
    },
    async getDashboardMetrics() {
      const database = getDatabase();
      const [
        totalRulings,
        approvedRulings,
        coalRulings,
        hiddenRulings,
        featuredRulings,
        openReports,
        reviewedReports,
        actionedReportsLast7Days,
        multiOpenRulings,
      ] = await Promise.all([
        database.select({ value: count() }).from(rulings),
        database
          .select({ value: count() })
          .from(rulings)
          .where(eq(rulings.decision, 'approved')),
        database
          .select({ value: count() })
          .from(rulings)
          .where(eq(rulings.decision, 'random-coal')),
        database
          .select({ value: count() })
          .from(rulings)
          .where(eq(rulings.visibility, 'hidden')),
        database
          .select({ value: count() })
          .from(rulings)
          .where(
            and(eq(rulings.isFeatured, true), eq(rulings.visibility, 'public')),
          ),
        database
          .select({ value: count() })
          .from(rulingReports)
          .where(eq(rulingReports.status, 'open')),
        database
          .select({ value: count() })
          .from(rulingReports)
          .where(eq(rulingReports.status, 'reviewed')),
        database
          .select({ value: count() })
          .from(rulingReports)
          .where(
            and(
              eq(rulingReports.status, 'actioned'),
              gte(
                rulingReports.resolvedAt,
                new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              ),
            ),
          ),
        database.execute(sql<{ value: string }>`
          select count(*)::text as value
          from (
            select ruling_id
            from ruling_reports
            where status = 'open'
            group by ruling_id
            having count(*) > 1
          ) grouped
        `),
      ]);

      return {
        totalRulings: Number(totalRulings[0]?.value ?? 0),
        approvedRulings: Number(approvedRulings[0]?.value ?? 0),
        coalRulings: Number(coalRulings[0]?.value ?? 0),
        hiddenRulings: Number(hiddenRulings[0]?.value ?? 0),
        featuredRulings: Number(featuredRulings[0]?.value ?? 0),
        openReports: Number(openReports[0]?.value ?? 0),
        reviewedReports: Number(reviewedReports[0]?.value ?? 0),
        actionedReportsLast7Days: Number(
          actionedReportsLast7Days[0]?.value ?? 0,
        ),
        rulingsWithMultipleOpenReports: Number(
          multiOpenRulings.rows[0]?.value ?? 0,
        ),
      };
    },
    async getDashboardRulingMetrics(window) {
      const database = getDatabase();

      if (!window.currentStart) {
        const result = await database.execute(sql<{
          currentTotalRulings: string;
          currentApprovedRulings: string;
          currentCoalRulings: string;
          currentPublicRulings: string;
          currentHiddenRulings: string;
          currentFeaturedRulings: string;
        }>`
          select
            count(*)::text as "currentTotalRulings",
            count(*) filter (where ${rulings.decision} = 'approved')::text as "currentApprovedRulings",
            count(*) filter (where ${rulings.decision} = 'random-coal')::text as "currentCoalRulings",
            count(*) filter (where ${rulings.visibility} = 'public')::text as "currentPublicRulings",
            count(*) filter (where ${rulings.visibility} = 'hidden')::text as "currentHiddenRulings",
            count(*) filter (
              where ${rulings.isFeatured} = true
                and ${rulings.visibility} = 'public'
            )::text as "currentFeaturedRulings"
          from ${rulings}
          where ${rulings.createdAt} < ${window.currentEnd}
        `);
        const row = result.rows[0] as
          | {
              currentTotalRulings: string;
              currentApprovedRulings: string;
              currentCoalRulings: string;
              currentPublicRulings: string;
              currentHiddenRulings: string;
              currentFeaturedRulings: string;
            }
          | undefined;

        return {
          current: {
            totalRulings: parseCount(row?.currentTotalRulings),
            approvedRulings: parseCount(row?.currentApprovedRulings),
            coalRulings: parseCount(row?.currentCoalRulings),
            publicRulings: parseCount(row?.currentPublicRulings),
            hiddenRulings: parseCount(row?.currentHiddenRulings),
            featuredRulings: parseCount(row?.currentFeaturedRulings),
          },
          previous: null,
        };
      }

      const previousStart = window.previousStart as Date;
      const previousEnd = window.previousEnd as Date;
      const result = await database.execute(sql<{
        currentTotalRulings: string;
        currentApprovedRulings: string;
        currentCoalRulings: string;
        currentPublicRulings: string;
        currentHiddenRulings: string;
        currentFeaturedRulings: string;
        previousTotalRulings: string;
        previousApprovedRulings: string;
        previousCoalRulings: string;
        previousPublicRulings: string;
        previousHiddenRulings: string;
        previousFeaturedRulings: string;
      }>`
        select
          count(*) filter (
            where ${rulings.createdAt} >= ${window.currentStart}
              and ${rulings.createdAt} < ${window.currentEnd}
          )::text as "currentTotalRulings",
          count(*) filter (
            where ${rulings.createdAt} >= ${window.currentStart}
              and ${rulings.createdAt} < ${window.currentEnd}
              and ${rulings.decision} = 'approved'
          )::text as "currentApprovedRulings",
          count(*) filter (
            where ${rulings.createdAt} >= ${window.currentStart}
              and ${rulings.createdAt} < ${window.currentEnd}
              and ${rulings.decision} = 'random-coal'
          )::text as "currentCoalRulings",
          count(*) filter (
            where ${rulings.createdAt} >= ${window.currentStart}
              and ${rulings.createdAt} < ${window.currentEnd}
              and ${rulings.visibility} = 'public'
          )::text as "currentPublicRulings",
          count(*) filter (
            where ${rulings.createdAt} >= ${window.currentStart}
              and ${rulings.createdAt} < ${window.currentEnd}
              and ${rulings.visibility} = 'hidden'
          )::text as "currentHiddenRulings",
          count(*) filter (
            where ${rulings.createdAt} >= ${window.currentStart}
              and ${rulings.createdAt} < ${window.currentEnd}
              and ${rulings.isFeatured} = true
              and ${rulings.visibility} = 'public'
          )::text as "currentFeaturedRulings",
          count(*) filter (
            where ${rulings.createdAt} >= ${previousStart}
              and ${rulings.createdAt} < ${previousEnd}
          )::text as "previousTotalRulings",
          count(*) filter (
            where ${rulings.createdAt} >= ${previousStart}
              and ${rulings.createdAt} < ${previousEnd}
              and ${rulings.decision} = 'approved'
          )::text as "previousApprovedRulings",
          count(*) filter (
            where ${rulings.createdAt} >= ${previousStart}
              and ${rulings.createdAt} < ${previousEnd}
              and ${rulings.decision} = 'random-coal'
          )::text as "previousCoalRulings",
          count(*) filter (
            where ${rulings.createdAt} >= ${previousStart}
              and ${rulings.createdAt} < ${previousEnd}
              and ${rulings.visibility} = 'public'
          )::text as "previousPublicRulings",
          count(*) filter (
            where ${rulings.createdAt} >= ${previousStart}
              and ${rulings.createdAt} < ${previousEnd}
              and ${rulings.visibility} = 'hidden'
          )::text as "previousHiddenRulings",
          count(*) filter (
            where ${rulings.createdAt} >= ${previousStart}
              and ${rulings.createdAt} < ${previousEnd}
              and ${rulings.isFeatured} = true
              and ${rulings.visibility} = 'public'
          )::text as "previousFeaturedRulings"
        from ${rulings}
      `);
      const row = result.rows[0] as
        | {
            currentTotalRulings: string;
            currentApprovedRulings: string;
            currentCoalRulings: string;
            currentPublicRulings: string;
            currentHiddenRulings: string;
            currentFeaturedRulings: string;
            previousTotalRulings: string;
            previousApprovedRulings: string;
            previousCoalRulings: string;
            previousPublicRulings: string;
            previousHiddenRulings: string;
            previousFeaturedRulings: string;
          }
        | undefined;

      return {
        current: {
          totalRulings: parseCount(row?.currentTotalRulings),
          approvedRulings: parseCount(row?.currentApprovedRulings),
          coalRulings: parseCount(row?.currentCoalRulings),
          publicRulings: parseCount(row?.currentPublicRulings),
          hiddenRulings: parseCount(row?.currentHiddenRulings),
          featuredRulings: parseCount(row?.currentFeaturedRulings),
        },
        previous: {
          totalRulings: parseCount(row?.previousTotalRulings),
          approvedRulings: parseCount(row?.previousApprovedRulings),
          coalRulings: parseCount(row?.previousCoalRulings),
          publicRulings: parseCount(row?.previousPublicRulings),
          hiddenRulings: parseCount(row?.previousHiddenRulings),
          featuredRulings: parseCount(row?.previousFeaturedRulings),
        },
      };
    },
    async getDashboardRulingTrend(window) {
      const database = getDatabase();
      const bucketSql =
        window.bucketGranularity === 'day'
          ? sql<string>`to_char(date_trunc('day', ${rulings.createdAt} at time zone ${window.timeZone}), 'YYYY-MM-DD')`
          : sql<string>`to_char(date_trunc('month', ${rulings.createdAt} at time zone ${window.timeZone}), 'YYYY-MM')`;
      const timeFilter = window.currentStart
        ? sql`where ${rulings.createdAt} >= ${window.currentStart}
            and ${rulings.createdAt} < ${window.currentEnd}`
        : sql`where ${rulings.createdAt} < ${window.currentEnd}`;
      const result = await database.execute(sql<{
        bucketKey: string;
        totalRulings: string;
        approvedRulings: string;
        coalRulings: string;
        publicRulings: string;
        hiddenRulings: string;
        featuredRulings: string;
      }>`
        select
          ${bucketSql} as "bucketKey",
          count(*)::text as "totalRulings",
          count(*) filter (where ${rulings.decision} = 'approved')::text as "approvedRulings",
          count(*) filter (where ${rulings.decision} = 'random-coal')::text as "coalRulings",
          count(*) filter (where ${rulings.visibility} = 'public')::text as "publicRulings",
          count(*) filter (where ${rulings.visibility} = 'hidden')::text as "hiddenRulings",
          count(*) filter (
            where ${rulings.isFeatured} = true
              and ${rulings.visibility} = 'public'
          )::text as "featuredRulings"
        from ${rulings}
        ${timeFilter}
        group by 1
        order by 1
      `);

      return result.rows.map((row) => {
        const typedRow = row as {
          bucketKey: string;
          totalRulings: string;
          approvedRulings: string;
          coalRulings: string;
          publicRulings: string;
          hiddenRulings: string;
          featuredRulings: string;
        };

        return {
          bucketKey: typedRow.bucketKey,
          totalRulings: parseCount(typedRow.totalRulings),
          approvedRulings: parseCount(typedRow.approvedRulings),
          coalRulings: parseCount(typedRow.coalRulings),
          publicRulings: parseCount(typedRow.publicRulings),
          hiddenRulings: parseCount(typedRow.hiddenRulings),
          featuredRulings: parseCount(typedRow.featuredRulings),
        };
      });
    },
    async listRecentWorkshopRulings(
      limit = securitySettings.workshop.search.recentRulingsLimit,
    ) {
      const database = getDatabase();
      const rows = await database
        .select({
          id: rulings.id,
          publicId: rulings.publicId,
          displayName: rulings.displayName,
          requestText: rulings.requestText,
          decision: rulings.decision,
          santaResponse: rulings.santaResponse,
          visibility: rulings.visibility,
          isFeatured: rulings.isFeatured,
          featuredAt: rulings.featuredAt,
          hiddenAt: rulings.hiddenAt,
          hiddenReason: rulings.hiddenReason,
          createdAt: rulings.createdAt,
          reportCount: count(rulingReports.id),
          openReportCount: sql<number>`sum(case when ${rulingReports.status} = 'open' then 1 else 0 end)`,
          latestReportAt: sql<Date | null>`max(${rulingReports.createdAt})`,
        })
        .from(rulings)
        .leftJoin(rulingReports, eq(rulingReports.rulingId, rulings.id))
        .groupBy(rulings.id)
        .orderBy(desc(rulings.createdAt), desc(rulings.id))
        .limit(limit);

      return rows.map((row) =>
        mapWorkshopRulingRow({
          ...row,
          reportCount: Number(row.reportCount ?? 0),
          openReportCount: Number(row.openReportCount ?? 0),
        }),
      );
    },
    async listWorkshopRulings(filters) {
      const database = getDatabase();
      const pageSize = securitySettings.workshop.search.pageSize;
      const page = Math.max(1, filters.page);
      const whereClause = buildWorkshopRulingWhere(filters);
      const offset = (page - 1) * pageSize;
      const orderDirection =
        filters.sort === 'oldest'
          ? [asc(rulings.createdAt), asc(rulings.id)]
          : [desc(rulings.createdAt), desc(rulings.id)];
      const [rows, totalRows] = await Promise.all([
        database
          .select({
            id: rulings.id,
            publicId: rulings.publicId,
            displayName: rulings.displayName,
            requestText: rulings.requestText,
            decision: rulings.decision,
            santaResponse: rulings.santaResponse,
            visibility: rulings.visibility,
            isFeatured: rulings.isFeatured,
            featuredAt: rulings.featuredAt,
            hiddenAt: rulings.hiddenAt,
            hiddenReason: rulings.hiddenReason,
            createdAt: rulings.createdAt,
            reportCount: count(rulingReports.id),
            openReportCount: sql<number>`sum(case when ${rulingReports.status} = 'open' then 1 else 0 end)`,
            latestReportAt: sql<Date | null>`max(${rulingReports.createdAt})`,
          })
          .from(rulings)
          .leftJoin(rulingReports, eq(rulingReports.rulingId, rulings.id))
          .where(whereClause)
          .groupBy(rulings.id)
          .orderBy(...orderDirection)
          .limit(pageSize)
          .offset(offset),
        database.select({ value: count() }).from(rulings).where(whereClause),
      ]);

      return {
        rulings: rows.map((row) =>
          mapWorkshopRulingRow({
            ...row,
            reportCount: Number(row.reportCount ?? 0),
            openReportCount: Number(row.openReportCount ?? 0),
          }),
        ),
        total: Number(totalRows[0]?.value ?? 0),
        page,
        pageSize,
      };
    },
    async getWorkshopRulingByPublicId(publicId) {
      const database = getDatabase();
      const [row] = await database
        .select({
          id: rulings.id,
          publicId: rulings.publicId,
          displayName: rulings.displayName,
          requestText: rulings.requestText,
          decision: rulings.decision,
          santaResponse: rulings.santaResponse,
          visibility: rulings.visibility,
          isFeatured: rulings.isFeatured,
          featuredAt: rulings.featuredAt,
          hiddenAt: rulings.hiddenAt,
          hiddenReason: rulings.hiddenReason,
          createdAt: rulings.createdAt,
          reportCount: count(rulingReports.id),
          openReportCount: sql<number>`sum(case when ${rulingReports.status} = 'open' then 1 else 0 end)`,
          latestReportAt: sql<Date | null>`max(${rulingReports.createdAt})`,
        })
        .from(rulings)
        .leftJoin(rulingReports, eq(rulingReports.rulingId, rulings.id))
        .where(eq(rulings.publicId, publicId))
        .groupBy(rulings.id)
        .limit(1);

      return row
        ? mapWorkshopRulingRow({
            ...row,
            reportCount: Number(row.reportCount ?? 0),
            openReportCount: Number(row.openReportCount ?? 0),
          })
        : null;
    },
    async hideRuling(publicId, reason, now) {
      const existing = await this.getWorkshopRulingByPublicId(publicId);

      if (!existing) {
        return 'not-found';
      }

      if (existing.visibility === 'hidden') {
        return 'already-hidden';
      }

      const database = getDatabase();
      await database
        .update(rulings)
        .set({
          visibility: 'hidden',
          isFeatured: false,
          featuredAt: null,
          hiddenAt: now,
          hiddenReason: reason,
        })
        .where(eq(rulings.publicId, publicId));

      return this.getWorkshopRulingByPublicId(
        publicId,
      ) as Promise<WorkshopRulingDetail>;
    },
    async setRulingFeatured(publicId, featured, now) {
      const existing = await this.getWorkshopRulingByPublicId(publicId);

      if (!existing) {
        return 'not-found';
      }

      if (existing.visibility !== 'public') {
        return 'hidden';
      }

      if (existing.isFeatured === featured) {
        return featured ? 'already-featured' : 'already-unfeatured';
      }

      const database = getDatabase();
      await database
        .update(rulings)
        .set({
          isFeatured: featured,
          featuredAt: featured ? now : null,
        })
        .where(eq(rulings.publicId, publicId));

      return this.getWorkshopRulingByPublicId(
        publicId,
      ) as Promise<WorkshopRulingDetail>;
    },
    async restoreRuling(publicId) {
      const existing = await this.getWorkshopRulingByPublicId(publicId);

      if (!existing) {
        return 'not-found';
      }

      if (existing.visibility === 'public') {
        return 'already-public';
      }

      const database = getDatabase();
      await database
        .update(rulings)
        .set({
          visibility: 'public',
          hiddenAt: null,
        })
        .where(eq(rulings.publicId, publicId));

      return this.getWorkshopRulingByPublicId(
        publicId,
      ) as Promise<WorkshopRulingDetail>;
    },
    async deleteRuling(publicId) {
      const database = getDatabase();
      const deleted = await database
        .delete(rulings)
        .where(eq(rulings.publicId, publicId))
        .returning({
          publicId: rulings.publicId,
        });

      return deleted.length > 0;
    },
    async createOwnerActivity(input) {
      const database = getDatabase();
      await database.insert(ownerActivity).values({
        action: input.action,
        targetType: input.targetType,
        targetPublicId: input.targetPublicId ?? null,
        relatedPublicId: input.relatedPublicId ?? null,
        details: input.details ?? null,
      });
    },
    async listRecentOwnerActivity(
      limit = securitySettings.workshop.search.recentActivityLimit,
    ) {
      const database = getDatabase();
      const rows = await database
        .select()
        .from(ownerActivity)
        .orderBy(desc(ownerActivity.createdAt), desc(ownerActivity.id))
        .limit(limit);

      return rows.map(mapOwnerActivityRow);
    },
    async listOwnerActivityForRuling(
      publicId,
      limit = securitySettings.workshop.search.recentActivityLimit,
    ) {
      const database = getDatabase();
      const rows = await database
        .select()
        .from(ownerActivity)
        .where(
          and(
            or(
              and(
                eq(ownerActivity.targetType, 'ruling'),
                eq(ownerActivity.targetPublicId, publicId),
              ),
              eq(ownerActivity.relatedPublicId, publicId),
            ),
          ),
        )
        .orderBy(desc(ownerActivity.createdAt), desc(ownerActivity.id))
        .limit(limit);

      return rows.map(mapOwnerActivityRow);
    },
    async listOwnerActivityForReport(
      publicId,
      limit = securitySettings.workshop.search.recentActivityLimit,
    ) {
      const database = getDatabase();
      const rows = await database
        .select()
        .from(ownerActivity)
        .where(
          or(
            and(
              eq(ownerActivity.targetType, 'report'),
              eq(ownerActivity.targetPublicId, publicId),
            ),
            eq(ownerActivity.relatedPublicId, publicId),
          ),
        )
        .orderBy(desc(ownerActivity.createdAt), desc(ownerActivity.id))
        .limit(limit);

      return rows.map(mapOwnerActivityRow);
    },
  };
}

function buildTestWorkshopRulingSummary(
  ruling: TestStoredRuling,
  reports: TestReportRecord[],
): WorkshopRulingSummary {
  const matchingReports = reports.filter(
    (report) => report.rulingId === ruling.id,
  );
  const latestReport = matchingReports
    .slice()
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    )[0];

  return {
    ...ruling,
    reportCount: matchingReports.length,
    openReportCount: matchingReports.filter(
      (report) => report.status === 'open',
    ).length,
    latestReportAt: latestReport?.createdAt ?? null,
  };
}

export function createTestWorkshopAuthRepository(
  runId: string,
): WorkshopAuthRepository {
  return {
    async countFailedLoginAttemptsSince(clientKeyHash, since) {
      const threshold = since.getTime();

      return getTestRunStore(runId).workshopLoginAttempts.filter(
        (attempt) =>
          attempt.clientKeyHash === clientKeyHash &&
          !attempt.successful &&
          new Date(attempt.createdAt).getTime() >= threshold,
      ).length;
    },
    async recordLoginAttempt(clientKeyHash, successful) {
      getTestRunStore(runId).workshopLoginAttempts.push({
        clientKeyHash,
        successful,
        createdAt: new Date().toISOString(),
      });
    },
    async clearFailedLoginAttempts(clientKeyHash) {
      const store = getTestRunStore(runId);
      store.workshopLoginAttempts = store.workshopLoginAttempts.filter(
        (attempt) =>
          attempt.clientKeyHash !== clientKeyHash || attempt.successful,
      );
    },
    async createSession(input) {
      const store = getTestRunStore(runId);
      store.workshopSessions.push({
        id: store.workshopSessions.length + 1,
        tokenHash: input.tokenHash,
        csrfToken: input.csrfToken,
        expiresAt: input.expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
      });
    },
    async getSession(tokenHash, now) {
      const session = getTestRunStore(runId).workshopSessions.find(
        (item) =>
          item.tokenHash === tokenHash &&
          new Date(item.expiresAt).getTime() >= now.getTime(),
      );

      return session
        ? {
            tokenHash: session.tokenHash,
            csrfToken: session.csrfToken,
            expiresAt: session.expiresAt,
          }
        : null;
    },
    async deleteSession(tokenHash) {
      const store = getTestRunStore(runId);
      store.workshopSessions = store.workshopSessions.filter(
        (session) => session.tokenHash !== tokenHash,
      );
    },
    async deleteExpiredSessions(now) {
      const store = getTestRunStore(runId);
      store.workshopSessions = store.workshopSessions.filter(
        (session) => new Date(session.expiresAt).getTime() >= now.getTime(),
      );
    },
  };
}

export function createTestWorkshopRepository(
  runId: string,
): WorkshopRepository {
  return {
    async ping() {
      getTestRunStore(runId);
    },
    async getDashboardMetrics() {
      const store = getTestRunStore(runId);

      return {
        totalRulings: store.rulings.length,
        approvedRulings: store.rulings.filter(
          (ruling) => ruling.decision === 'approved',
        ).length,
        coalRulings: store.rulings.filter(
          (ruling) => ruling.decision === 'random-coal',
        ).length,
        hiddenRulings: store.rulings.filter(
          (ruling) => ruling.visibility === 'hidden',
        ).length,
        featuredRulings: store.rulings.filter(
          (ruling) => ruling.visibility === 'public' && ruling.isFeatured,
        ).length,
        openReports: store.reports.filter((report) => report.status === 'open')
          .length,
        reviewedReports: store.reports.filter(
          (report) => report.status === 'reviewed',
        ).length,
        actionedReportsLast7Days: store.reports.filter(
          (report) =>
            report.status === 'actioned' &&
            report.resolvedAt &&
            new Date(report.resolvedAt).getTime() >=
              Date.now() - 7 * 24 * 60 * 60 * 1000,
        ).length,
        rulingsWithMultipleOpenReports: store.rulings.filter(
          (ruling) =>
            store.reports.filter(
              (report) =>
                report.rulingId === ruling.id && report.status === 'open',
            ).length > 1,
        ).length,
      };
    },
    async getDashboardRulingMetrics(window) {
      const store = getTestRunStore(runId);
      const currentRulings = getTestRunStore(runId).rulings.filter((ruling) =>
        isWithinTimeWindow(
          ruling.createdAt,
          window.currentStart,
          window.currentEnd,
        ),
      );
      const previousStart = window.previousStart;
      const previousEnd = window.previousEnd;
      const previousRulings =
        previousStart && previousEnd
          ? store.rulings.filter((ruling) =>
              isWithinTimeWindow(ruling.createdAt, previousStart, previousEnd),
            )
          : [];
      const summarize = (rulingsToSummarize: TestStoredRuling[]) => ({
        totalRulings: rulingsToSummarize.length,
        approvedRulings: rulingsToSummarize.filter(
          (ruling) => ruling.decision === 'approved',
        ).length,
        coalRulings: rulingsToSummarize.filter(
          (ruling) => ruling.decision === 'random-coal',
        ).length,
        publicRulings: rulingsToSummarize.filter(
          (ruling) => ruling.visibility === 'public',
        ).length,
        hiddenRulings: rulingsToSummarize.filter(
          (ruling) => ruling.visibility === 'hidden',
        ).length,
        featuredRulings: rulingsToSummarize.filter(
          (ruling) => ruling.visibility === 'public' && ruling.isFeatured,
        ).length,
      });

      return {
        current: summarize(currentRulings),
        previous:
          previousStart && previousEnd ? summarize(previousRulings) : null,
      };
    },
    async getDashboardRulingTrend(window) {
      const grouped = new Map<string, WorkshopDashboardTrendRow>();

      for (const ruling of getTestRunStore(runId).rulings) {
        if (
          !isWithinTimeWindow(
            ruling.createdAt,
            window.currentStart,
            window.currentEnd,
          )
        ) {
          continue;
        }

        const bucketKey = getTestBucketKey(
          ruling.createdAt,
          window.bucketGranularity,
          window.timeZone,
        );
        const existing = grouped.get(bucketKey) ?? {
          bucketKey,
          totalRulings: 0,
          approvedRulings: 0,
          coalRulings: 0,
          publicRulings: 0,
          hiddenRulings: 0,
          featuredRulings: 0,
        };

        existing.totalRulings += 1;
        existing.approvedRulings += ruling.decision === 'approved' ? 1 : 0;
        existing.coalRulings += ruling.decision === 'random-coal' ? 1 : 0;
        existing.publicRulings += ruling.visibility === 'public' ? 1 : 0;
        existing.hiddenRulings += ruling.visibility === 'hidden' ? 1 : 0;
        existing.featuredRulings +=
          ruling.visibility === 'public' && ruling.isFeatured ? 1 : 0;
        grouped.set(bucketKey, existing);
      }

      return [...grouped.values()].sort((left, right) =>
        left.bucketKey.localeCompare(right.bucketKey),
      );
    },
    async listRecentWorkshopRulings(
      limit = securitySettings.workshop.search.recentRulingsLimit,
    ) {
      const store = getTestRunStore(runId);

      return store.rulings
        .slice()
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
        )
        .slice(0, limit)
        .map((ruling) => buildTestWorkshopRulingSummary(ruling, store.reports));
    },
    async listWorkshopRulings(filters) {
      const store = getTestRunStore(runId);
      const pageSize = securitySettings.workshop.search.pageSize;
      const normalizedQuery = filters.query.toLocaleLowerCase();
      const filtered = store.rulings.filter((ruling) => {
        if (
          filters.decision !== 'all' &&
          ruling.decision !== filters.decision
        ) {
          return false;
        }

        if (
          filters.visibility !== 'all' &&
          ruling.visibility !== filters.visibility
        ) {
          return false;
        }

        if (filters.featured === 'featured' && !ruling.isFeatured) {
          return false;
        }

        if (filters.featured === 'not-featured' && ruling.isFeatured) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return [
          ruling.displayName,
          ruling.requestText,
          ruling.santaResponse,
          ruling.publicId,
        ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      });
      filtered.sort((left, right) => {
        const difference =
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime();

        return filters.sort === 'oldest' ? -difference : difference;
      });

      const page = Math.max(1, filters.page);
      const start = (page - 1) * pageSize;

      return {
        rulings: filtered
          .slice(start, start + pageSize)
          .map((ruling) =>
            buildTestWorkshopRulingSummary(ruling, store.reports),
          ),
        total: filtered.length,
        page,
        pageSize,
      };
    },
    async getWorkshopRulingByPublicId(publicId) {
      const store = getTestRunStore(runId);
      const ruling = store.rulings.find((item) => item.publicId === publicId);

      return ruling
        ? buildTestWorkshopRulingSummary(ruling, store.reports)
        : null;
    },
    async hideRuling(publicId, reason, now) {
      const store = getTestRunStore(runId);
      const ruling = store.rulings.find((item) => item.publicId === publicId);

      if (!ruling) {
        return 'not-found';
      }

      if (ruling.visibility === 'hidden') {
        return 'already-hidden';
      }

      ruling.visibility = 'hidden';
      ruling.isFeatured = false;
      ruling.featuredAt = null;
      ruling.hiddenAt = now.toISOString();
      ruling.hiddenReason = reason;

      return buildTestWorkshopRulingSummary(ruling, store.reports);
    },
    async setRulingFeatured(publicId, featured, now) {
      const store = getTestRunStore(runId);
      const ruling = store.rulings.find((item) => item.publicId === publicId);

      if (!ruling) {
        return 'not-found';
      }

      if (ruling.visibility !== 'public') {
        return 'hidden';
      }

      if (ruling.isFeatured === featured) {
        return featured ? 'already-featured' : 'already-unfeatured';
      }

      ruling.isFeatured = featured;
      ruling.featuredAt = featured ? now.toISOString() : null;

      return buildTestWorkshopRulingSummary(ruling, store.reports);
    },
    async restoreRuling(publicId) {
      const store = getTestRunStore(runId);
      const ruling = store.rulings.find((item) => item.publicId === publicId);

      if (!ruling) {
        return 'not-found';
      }

      if (ruling.visibility === 'public') {
        return 'already-public';
      }

      ruling.visibility = 'public';
      ruling.hiddenAt = null;

      return buildTestWorkshopRulingSummary(ruling, store.reports);
    },
    async deleteRuling(publicId) {
      const store = getTestRunStore(runId);
      const rulingIndex = store.rulings.findIndex(
        (item) => item.publicId === publicId,
      );

      if (rulingIndex === -1) {
        return false;
      }

      const [deleted] = store.rulings.splice(rulingIndex, 1);

      if (!deleted) {
        return false;
      }

      store.reports = store.reports.filter(
        (report) => report.rulingId !== deleted.id,
      );
      store.idempotencyRecords = store.idempotencyRecords.filter(
        (record) => record.rulingPublicId !== deleted.publicId,
      );

      return true;
    },
    async createOwnerActivity(input) {
      const store = getTestRunStore(runId);
      store.ownerActivity.unshift({
        id: store.ownerActivity.length + 1,
        action: input.action,
        targetType: input.targetType,
        targetPublicId: input.targetPublicId ?? null,
        relatedPublicId: input.relatedPublicId ?? null,
        details: input.details ?? null,
        createdAt: new Date().toISOString(),
      });
    },
    async listRecentOwnerActivity(
      limit = securitySettings.workshop.search.recentActivityLimit,
    ) {
      return getTestRunStore(runId)
        .ownerActivity.slice(0, limit)
        .map((entry) => ({
          action: entry.action,
          targetType: entry.targetType,
          targetPublicId: entry.targetPublicId,
          relatedPublicId: entry.relatedPublicId,
          details: entry.details,
          createdAt: entry.createdAt,
        }));
    },
    async listOwnerActivityForRuling(
      publicId,
      limit = securitySettings.workshop.search.recentActivityLimit,
    ) {
      return getTestRunStore(runId)
        .ownerActivity.filter(
          (entry) =>
            (entry.targetType === 'ruling' &&
              entry.targetPublicId === publicId) ||
            entry.relatedPublicId === publicId,
        )
        .slice(0, limit)
        .map((entry) => ({
          action: entry.action,
          targetType: entry.targetType,
          targetPublicId: entry.targetPublicId,
          relatedPublicId: entry.relatedPublicId,
          details: entry.details,
          createdAt: entry.createdAt,
        }));
    },
    async listOwnerActivityForReport(
      publicId,
      limit = securitySettings.workshop.search.recentActivityLimit,
    ) {
      return getTestRunStore(runId)
        .ownerActivity.filter(
          (entry) =>
            (entry.targetType === 'report' &&
              entry.targetPublicId === publicId) ||
            entry.relatedPublicId === publicId,
        )
        .slice(0, limit)
        .map((entry) => ({
          action: entry.action,
          targetType: entry.targetType,
          targetPublicId: entry.targetPublicId,
          relatedPublicId: entry.relatedPublicId,
          details: entry.details,
          createdAt: entry.createdAt,
        }));
    },
  };
}
