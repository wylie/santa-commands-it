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
  getDashboardMetrics(): Promise<WorkshopDashboardMetrics>;
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
    async getDashboardMetrics() {
      const database = getDatabase();
      const [
        totalRulings,
        approvedRulings,
        coalRulings,
        hiddenRulings,
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
          hiddenAt: now,
          hiddenReason: reason,
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
      ruling.hiddenAt = now.toISOString();
      ruling.hiddenReason = reason;

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
