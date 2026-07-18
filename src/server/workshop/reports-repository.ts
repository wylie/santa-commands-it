import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import { securitySettings } from '@/config/security';
import { getDatabase } from '@/server/db/client';
import { rulingReports, rulings } from '@/server/db/schema';
import type {
  DashboardTimeWindow,
  WorkshopDashboardReportSummary,
} from '@/server/workshop/dashboard';
import { getTestRunStore } from '@/server/testing/store';
import type {
  TestReportRecord,
  TestStoredRuling,
} from '@/server/testing/store';
import { serializeCreatedAt } from '@/utils/rulings';
import type {
  WorkshopDashboardMetrics,
  WorkshopReportDetail,
  WorkshopReportFilters,
  WorkshopReportStatus,
  WorkshopReportSummary,
} from '@/utils/workshop';
import { serializeOptionalTimestamp } from '@/utils/workshop';

export type ListWorkshopReportsResult = {
  reports: WorkshopReportSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type UpdateWorkshopReportInput = {
  publicId: string;
  status: WorkshopReportStatus;
  reviewedAt?: Date | null;
  resolvedAt?: Date | null;
  resolutionNote?: string | null;
};

export type HideRulingFromReportInput = {
  reportPublicId: string;
  hideReason: string | null;
  resolutionNote: string | null;
  now: Date;
};

export type HideRulingFromReportResult =
  | {
      status: 'not-found';
    }
  | {
      status: 'already-hidden';
      report: WorkshopReportDetail;
    }
  | {
      status: 'transition-conflict';
      report: WorkshopReportDetail;
    }
  | {
      status: 'success';
      report: WorkshopReportDetail;
      relatedActionedCount: number;
    };

export type WorkshopReportsRepository = {
  countOpenReports(): Promise<number>;
  getDashboardReportSummary(
    window: DashboardTimeWindow,
  ): Promise<WorkshopDashboardReportSummary>;
  getDashboardReportMetrics(): Promise<
    Pick<
      WorkshopDashboardMetrics,
      | 'openReports'
      | 'reviewedReports'
      | 'actionedReportsLast7Days'
      | 'rulingsWithMultipleOpenReports'
    >
  >;
  listWorkshopReports(
    filters: WorkshopReportFilters,
  ): Promise<ListWorkshopReportsResult>;
  getWorkshopReportByPublicId(
    publicId: string,
  ): Promise<WorkshopReportDetail | null>;
  listReportsForRuling(
    rulingPublicId: string,
    options?: {
      excludeReportPublicId?: string;
      limit?: number;
    },
  ): Promise<WorkshopReportSummary[]>;
  updateWorkshopReport(
    input: UpdateWorkshopReportInput,
  ): Promise<WorkshopReportDetail | null>;
  hideRulingFromReport(
    input: HideRulingFromReportInput,
  ): Promise<HideRulingFromReportResult>;
};

type WorkshopReportRow = {
  publicId: string;
  reason: typeof rulingReports.$inferSelect.reason;
  note: string | null;
  status: WorkshopReportStatus;
  reviewedAt: Date | null;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  createdAt: Date;
  rulingPublicId: string;
  rulingDisplayName: string;
  rulingRequestText: string;
  rulingDecision: typeof rulings.$inferSelect.decision;
  rulingSantaResponse: string;
  rulingVisibility: typeof rulings.$inferSelect.visibility;
  rulingCreatedAt: Date;
  totalReportsForRuling: number;
  openReportsForRuling: number;
};

function mapWorkshopReportRow(row: WorkshopReportRow): WorkshopReportDetail {
  return {
    publicId: row.publicId,
    reason: row.reason,
    note: row.note,
    status: row.status,
    reviewedAt: serializeOptionalTimestamp(row.reviewedAt),
    resolvedAt: serializeOptionalTimestamp(row.resolvedAt),
    resolutionNote: row.resolutionNote,
    createdAt: serializeCreatedAt(row.createdAt),
    rulingPublicId: row.rulingPublicId,
    rulingDisplayName: row.rulingDisplayName,
    rulingRequestText: row.rulingRequestText,
    rulingDecision: row.rulingDecision,
    rulingSantaResponse: row.rulingSantaResponse,
    rulingVisibility: row.rulingVisibility,
    rulingCreatedAt: serializeCreatedAt(row.rulingCreatedAt),
    totalReportsForRuling: Number(row.totalReportsForRuling ?? 0),
    openReportsForRuling: Number(row.openReportsForRuling ?? 0),
  };
}

function buildReportWhere(filters: WorkshopReportFilters) {
  const conditions: SQL[] = [];

  if (filters.status !== 'all') {
    conditions.push(eq(rulingReports.status, filters.status));
  }

  if (filters.reason !== 'all') {
    conditions.push(eq(rulingReports.reason, filters.reason));
  }

  if (filters.visibility !== 'all') {
    conditions.push(eq(rulings.visibility, filters.visibility));
  }

  if (filters.query) {
    const pattern = `%${filters.query}%`;
    const searchCondition = or(
      ilike(rulingReports.publicId, pattern),
      ilike(rulingReports.note, pattern),
      ilike(rulings.publicId, pattern),
      ilike(rulings.displayName, pattern),
      ilike(rulings.requestText, pattern),
      ilike(rulings.santaResponse, pattern),
    );

    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  return conditions.length ? and(...conditions) : undefined;
}

function getStatusOrderSql() {
  return sql<number>`case ${rulingReports.status}
    when 'open' then 0
    when 'reviewed' then 1
    when 'dismissed' then 2
    when 'actioned' then 3
    else 4
  end`;
}

function createReportSummarySubquery(database: ReturnType<typeof getDatabase>) {
  return database
    .select({
      rulingId: rulingReports.rulingId,
      totalReportsForRuling: count(rulingReports.id),
      openReportsForRuling: sql<number>`sum(case when ${rulingReports.status} = 'open' then 1 else 0 end)`,
    })
    .from(rulingReports)
    .groupBy(rulingReports.rulingId)
    .as('report_summary');
}

function parseCount(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function isWithinTimeWindow(
  value: string | null,
  start: Date | null,
  end: Date,
) {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();

  return (
    timestamp < end.getTime() &&
    (start === null || timestamp >= start.getTime())
  );
}

export function createDatabaseWorkshopReportsRepository(): WorkshopReportsRepository {
  return {
    async countOpenReports() {
      const database = getDatabase();
      const [result] = await database
        .select({ value: count() })
        .from(rulingReports)
        .where(eq(rulingReports.status, 'open'));

      return Number(result?.value ?? 0);
    },
    async getDashboardReportSummary(window) {
      const database = getDatabase();
      const rangeStart = window.currentStart ?? new Date(0);
      const result = await database.execute(sql<{
        currentOpenReports: string;
        currentReviewedReports: string;
        reportsCreatedInRange: string;
        reportsDismissedInRange: string;
        reportsActionedInRange: string;
        rulingsWithMultipleOpenReports: string;
        oldestOpenReportCreatedAt: string | null;
      }>`
        with multi_open_reports as (
          select ruling_id
          from ${rulingReports}
          where ${rulingReports.status} = 'open'
          group by ruling_id
          having count(*) > 1
        )
        select
          count(*) filter (where ${rulingReports.status} = 'open')::text as "currentOpenReports",
          count(*) filter (where ${rulingReports.status} = 'reviewed')::text as "currentReviewedReports",
          count(*) filter (
            where ${rulingReports.createdAt} >= ${rangeStart}
              and ${rulingReports.createdAt} < ${window.currentEnd}
          )::text as "reportsCreatedInRange",
          count(*) filter (
            where ${rulingReports.status} = 'dismissed'
              and ${rulingReports.resolvedAt} is not null
              and ${rulingReports.resolvedAt} >= ${rangeStart}
              and ${rulingReports.resolvedAt} < ${window.currentEnd}
          )::text as "reportsDismissedInRange",
          count(*) filter (
            where ${rulingReports.status} = 'actioned'
              and ${rulingReports.resolvedAt} is not null
              and ${rulingReports.resolvedAt} >= ${rangeStart}
              and ${rulingReports.resolvedAt} < ${window.currentEnd}
          )::text as "reportsActionedInRange",
          (select count(*)::text from multi_open_reports) as "rulingsWithMultipleOpenReports",
          min(${rulingReports.createdAt}) filter (where ${rulingReports.status} = 'open')::text as "oldestOpenReportCreatedAt"
        from ${rulingReports}
      `);
      const row = result.rows[0] as
        | {
            currentOpenReports: string;
            currentReviewedReports: string;
            reportsCreatedInRange: string;
            reportsDismissedInRange: string;
            reportsActionedInRange: string;
            rulingsWithMultipleOpenReports: string;
            oldestOpenReportCreatedAt: string | null;
          }
        | undefined;

      return {
        currentOpenReports: parseCount(row?.currentOpenReports),
        currentReviewedReports: parseCount(row?.currentReviewedReports),
        reportsCreatedInRange: parseCount(row?.reportsCreatedInRange),
        reportsDismissedInRange: parseCount(row?.reportsDismissedInRange),
        reportsActionedInRange: parseCount(row?.reportsActionedInRange),
        rulingsWithMultipleOpenReports: parseCount(
          row?.rulingsWithMultipleOpenReports,
        ),
        oldestOpenReportCreatedAt: row?.oldestOpenReportCreatedAt ?? null,
      };
    },
    async getDashboardReportMetrics() {
      const database = getDatabase();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [
        openReports,
        reviewedReports,
        actionedReportsLast7Days,
        multiOpenRulings,
      ] = await Promise.all([
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
              gte(rulingReports.resolvedAt, sevenDaysAgo),
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
    async listWorkshopReports(filters) {
      const database = getDatabase();
      const pageSize = securitySettings.workshop.search.pageSize;
      const page = Math.max(1, filters.page);
      const offset = (page - 1) * pageSize;
      const whereClause = buildReportWhere(filters);
      const reportSummary = createReportSummarySubquery(database);
      const createdOrder =
        filters.sort === 'oldest'
          ? [asc(rulingReports.createdAt), asc(rulingReports.id)]
          : [desc(rulingReports.createdAt), desc(rulingReports.id)];
      const [rows, totalRows] = await Promise.all([
        database
          .select({
            publicId: rulingReports.publicId,
            reason: rulingReports.reason,
            note: rulingReports.note,
            status: rulingReports.status,
            reviewedAt: rulingReports.reviewedAt,
            resolvedAt: rulingReports.resolvedAt,
            resolutionNote: rulingReports.resolutionNote,
            createdAt: rulingReports.createdAt,
            rulingPublicId: rulings.publicId,
            rulingDisplayName: rulings.displayName,
            rulingRequestText: rulings.requestText,
            rulingDecision: rulings.decision,
            rulingSantaResponse: rulings.santaResponse,
            rulingVisibility: rulings.visibility,
            rulingCreatedAt: rulings.createdAt,
            totalReportsForRuling: reportSummary.totalReportsForRuling,
            openReportsForRuling: reportSummary.openReportsForRuling,
          })
          .from(rulingReports)
          .innerJoin(rulings, eq(rulingReports.rulingId, rulings.id))
          .innerJoin(reportSummary, eq(reportSummary.rulingId, rulings.id))
          .where(whereClause)
          .orderBy(getStatusOrderSql(), ...createdOrder)
          .limit(pageSize)
          .offset(offset),
        database
          .select({ value: count() })
          .from(rulingReports)
          .innerJoin(rulings, eq(rulingReports.rulingId, rulings.id))
          .where(whereClause),
      ]);

      return {
        reports: rows.map((row) =>
          mapWorkshopReportRow({
            ...row,
            totalReportsForRuling: Number(row.totalReportsForRuling ?? 0),
            openReportsForRuling: Number(row.openReportsForRuling ?? 0),
          }),
        ),
        total: Number(totalRows[0]?.value ?? 0),
        page,
        pageSize,
      };
    },
    async getWorkshopReportByPublicId(publicId) {
      const database = getDatabase();
      const reportSummary = createReportSummarySubquery(database);
      const [row] = await database
        .select({
          publicId: rulingReports.publicId,
          reason: rulingReports.reason,
          note: rulingReports.note,
          status: rulingReports.status,
          reviewedAt: rulingReports.reviewedAt,
          resolvedAt: rulingReports.resolvedAt,
          resolutionNote: rulingReports.resolutionNote,
          createdAt: rulingReports.createdAt,
          rulingPublicId: rulings.publicId,
          rulingDisplayName: rulings.displayName,
          rulingRequestText: rulings.requestText,
          rulingDecision: rulings.decision,
          rulingSantaResponse: rulings.santaResponse,
          rulingVisibility: rulings.visibility,
          rulingCreatedAt: rulings.createdAt,
          totalReportsForRuling: reportSummary.totalReportsForRuling,
          openReportsForRuling: reportSummary.openReportsForRuling,
        })
        .from(rulingReports)
        .innerJoin(rulings, eq(rulingReports.rulingId, rulings.id))
        .innerJoin(reportSummary, eq(reportSummary.rulingId, rulings.id))
        .where(eq(rulingReports.publicId, publicId))
        .limit(1);

      return row
        ? mapWorkshopReportRow({
            ...row,
            totalReportsForRuling: Number(row.totalReportsForRuling ?? 0),
            openReportsForRuling: Number(row.openReportsForRuling ?? 0),
          })
        : null;
    },
    async listReportsForRuling(rulingPublicId, options) {
      const database = getDatabase();
      const reportSummary = createReportSummarySubquery(database);
      const limit =
        options?.limit ?? securitySettings.workshop.search.relatedReportsLimit;
      const conditions: SQL[] = [eq(rulings.publicId, rulingPublicId)];

      if (options?.excludeReportPublicId) {
        conditions.push(
          ne(rulingReports.publicId, options.excludeReportPublicId),
        );
      }

      const rows = await database
        .select({
          publicId: rulingReports.publicId,
          reason: rulingReports.reason,
          note: rulingReports.note,
          status: rulingReports.status,
          reviewedAt: rulingReports.reviewedAt,
          resolvedAt: rulingReports.resolvedAt,
          resolutionNote: rulingReports.resolutionNote,
          createdAt: rulingReports.createdAt,
          rulingPublicId: rulings.publicId,
          rulingDisplayName: rulings.displayName,
          rulingRequestText: rulings.requestText,
          rulingDecision: rulings.decision,
          rulingSantaResponse: rulings.santaResponse,
          rulingVisibility: rulings.visibility,
          rulingCreatedAt: rulings.createdAt,
          totalReportsForRuling: reportSummary.totalReportsForRuling,
          openReportsForRuling: reportSummary.openReportsForRuling,
        })
        .from(rulingReports)
        .innerJoin(rulings, eq(rulingReports.rulingId, rulings.id))
        .innerJoin(reportSummary, eq(reportSummary.rulingId, rulings.id))
        .where(and(...conditions))
        .orderBy(desc(rulingReports.createdAt), desc(rulingReports.id))
        .limit(limit);

      return rows.map((row) =>
        mapWorkshopReportRow({
          ...row,
          totalReportsForRuling: Number(row.totalReportsForRuling ?? 0),
          openReportsForRuling: Number(row.openReportsForRuling ?? 0),
        }),
      );
    },
    async updateWorkshopReport(input) {
      const database = getDatabase();
      const updated = await database
        .update(rulingReports)
        .set({
          status: input.status,
          reviewedAt:
            input.reviewedAt === undefined ? undefined : input.reviewedAt,
          resolvedAt:
            input.resolvedAt === undefined ? undefined : input.resolvedAt,
          resolutionNote:
            input.resolutionNote === undefined
              ? undefined
              : input.resolutionNote,
        })
        .where(eq(rulingReports.publicId, input.publicId))
        .returning({
          publicId: rulingReports.publicId,
        });

      if (!updated[0]) {
        return null;
      }

      return this.getWorkshopReportByPublicId(input.publicId);
    },
    async hideRulingFromReport(input) {
      const database = getDatabase();
      const result = await database.execute(sql<{
        reportPublicId: string | null;
        rulingPublicId: string | null;
        rulingVisibility: 'public' | 'hidden' | null;
        currentStatus: WorkshopReportStatus | null;
        relatedActionedCount: string | null;
      }>`
        with target_report as (
          select
            rr.public_id as report_public_id,
            rr.status as current_status,
            rr.ruling_id as ruling_id,
            r.public_id as ruling_public_id,
            r.visibility as ruling_visibility
          from ruling_reports rr
          inner join rulings r on r.id = rr.ruling_id
          where rr.public_id = ${input.reportPublicId}
          limit 1
        ),
        updated_ruling as (
          update rulings
          set
            visibility = 'hidden'::ruling_visibility,
            hidden_at = ${input.now},
            hidden_reason = ${input.hideReason}
          where id = (select ruling_id from target_report)
            and visibility = 'public'::ruling_visibility
          returning public_id
        ),
        updated_current as (
          update ruling_reports
          set
            status = 'actioned'::report_status,
            reviewed_at = coalesce(reviewed_at, ${input.now}),
            resolved_at = ${input.now},
            resolution_note = ${input.resolutionNote}
          where public_id = ${input.reportPublicId}
            and status in ('open'::report_status, 'reviewed'::report_status)
          returning public_id
        ),
        updated_related as (
          update ruling_reports
          set
            status = 'actioned'::report_status,
            reviewed_at = coalesce(reviewed_at, ${input.now}),
            resolved_at = ${input.now}
          where ruling_id = (select ruling_id from target_report)
            and public_id <> ${input.reportPublicId}
            and status in ('open'::report_status, 'reviewed'::report_status)
          returning public_id
        )
        select
          target_report.report_public_id as "reportPublicId",
          target_report.ruling_public_id as "rulingPublicId",
          target_report.ruling_visibility as "rulingVisibility",
          target_report.current_status as "currentStatus",
          (
            select count(*)::text
            from updated_related
          ) as "relatedActionedCount"
        from target_report
      `);

      const row = result.rows[0];

      if (!row?.reportPublicId || !row.rulingPublicId || !row.currentStatus) {
        return {
          status: 'not-found',
        };
      }

      if (row.rulingVisibility === 'hidden') {
        const existing = await this.getWorkshopReportByPublicId(
          input.reportPublicId,
        );

        if (!existing) {
          return {
            status: 'not-found',
          };
        }

        return {
          status: 'already-hidden',
          report: existing,
        };
      }

      if (row.currentStatus !== 'open' && row.currentStatus !== 'reviewed') {
        const existing = await this.getWorkshopReportByPublicId(
          input.reportPublicId,
        );

        if (!existing) {
          return {
            status: 'not-found',
          };
        }

        return {
          status: 'transition-conflict',
          report: existing,
        };
      }

      const updatedReport = await this.getWorkshopReportByPublicId(
        input.reportPublicId,
      );

      if (!updatedReport) {
        return {
          status: 'not-found',
        };
      }

      return {
        status: 'success',
        report: updatedReport,
        relatedActionedCount: Number(row.relatedActionedCount ?? 0),
      };
    },
  };
}

function sortReportsForQueue(
  reports: TestReportRecord[],
  sort: 'newest' | 'oldest',
) {
  const statusRank: Record<WorkshopReportStatus, number> = {
    open: 0,
    reviewed: 1,
    dismissed: 2,
    actioned: 3,
  };

  return reports.slice().sort((left, right) => {
    const statusDifference = statusRank[left.status] - statusRank[right.status];

    if (statusDifference !== 0) {
      return statusDifference;
    }

    const createdDifference =
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();

    return sort === 'oldest' ? -createdDifference : createdDifference;
  });
}

function buildTestWorkshopReportSummary(
  report: TestReportRecord,
  ruling: TestStoredRuling,
  reports: TestReportRecord[],
): WorkshopReportDetail {
  const totalReportsForRuling = reports.filter(
    (entry) => entry.rulingId === report.rulingId,
  ).length;
  const openReportsForRuling = reports.filter(
    (entry) => entry.rulingId === report.rulingId && entry.status === 'open',
  ).length;

  return {
    publicId: report.publicId,
    reason: report.reason,
    note: report.note,
    status: report.status,
    reviewedAt: report.reviewedAt,
    resolvedAt: report.resolvedAt,
    resolutionNote: report.resolutionNote,
    createdAt: report.createdAt,
    rulingPublicId: ruling.publicId,
    rulingDisplayName: ruling.displayName,
    rulingRequestText: ruling.requestText,
    rulingDecision: ruling.decision,
    rulingSantaResponse: ruling.santaResponse,
    rulingVisibility: ruling.visibility,
    rulingCreatedAt: ruling.createdAt,
    totalReportsForRuling,
    openReportsForRuling,
  };
}

export function createTestWorkshopReportsRepository(
  runId: string,
): WorkshopReportsRepository {
  return {
    async countOpenReports() {
      return getTestRunStore(runId).reports.filter(
        (report) => report.status === 'open',
      ).length;
    },
    async getDashboardReportSummary(window) {
      const store = getTestRunStore(runId);
      const openReports = store.reports.filter(
        (report) => report.status === 'open',
      );
      const oldestOpenReport = openReports
        .slice()
        .sort(
          (left, right) =>
            new Date(left.createdAt).getTime() -
            new Date(right.createdAt).getTime(),
        )[0];

      return {
        currentOpenReports: openReports.length,
        currentReviewedReports: store.reports.filter(
          (report) => report.status === 'reviewed',
        ).length,
        reportsCreatedInRange: store.reports.filter((report) =>
          isWithinTimeWindow(
            report.createdAt,
            window.currentStart,
            window.currentEnd,
          ),
        ).length,
        reportsDismissedInRange: store.reports.filter(
          (report) =>
            report.status === 'dismissed' &&
            isWithinTimeWindow(
              report.resolvedAt,
              window.currentStart,
              window.currentEnd,
            ),
        ).length,
        reportsActionedInRange: store.reports.filter(
          (report) =>
            report.status === 'actioned' &&
            isWithinTimeWindow(
              report.resolvedAt,
              window.currentStart,
              window.currentEnd,
            ),
        ).length,
        rulingsWithMultipleOpenReports: store.rulings.filter(
          (ruling) =>
            store.reports.filter(
              (report) =>
                report.rulingId === ruling.id && report.status === 'open',
            ).length > 1,
        ).length,
        oldestOpenReportCreatedAt: oldestOpenReport?.createdAt ?? null,
      };
    },
    async getDashboardReportMetrics() {
      const store = getTestRunStore(runId);
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const openReports = store.reports.filter(
        (report) => report.status === 'open',
      ).length;
      const reviewedReports = store.reports.filter(
        (report) => report.status === 'reviewed',
      ).length;
      const actionedReportsLast7Days = store.reports.filter(
        (report) =>
          report.status === 'actioned' &&
          report.resolvedAt &&
          new Date(report.resolvedAt).getTime() >= sevenDaysAgo,
      ).length;
      const openByRuling = new Map<number, number>();

      for (const report of store.reports) {
        if (report.status !== 'open') {
          continue;
        }

        openByRuling.set(
          report.rulingId,
          (openByRuling.get(report.rulingId) ?? 0) + 1,
        );
      }

      return {
        openReports,
        reviewedReports,
        actionedReportsLast7Days,
        rulingsWithMultipleOpenReports: Array.from(
          openByRuling.values(),
        ).filter((count) => count > 1).length,
      };
    },
    async listWorkshopReports(filters) {
      const store = getTestRunStore(runId);
      const pageSize = securitySettings.workshop.search.pageSize;
      const normalizedQuery = filters.query.toLocaleLowerCase();
      const filtered = sortReportsForQueue(store.reports, filters.sort).filter(
        (report) => {
          const ruling = store.rulings.find(
            (entry) => entry.id === report.rulingId,
          );

          if (!ruling) {
            return false;
          }

          if (filters.status !== 'all' && report.status !== filters.status) {
            return false;
          }

          if (filters.reason !== 'all' && report.reason !== filters.reason) {
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
            report.publicId,
            report.note ?? '',
            ruling.publicId,
            ruling.displayName,
            ruling.requestText,
            ruling.santaResponse,
          ].some((value) =>
            value.toLocaleLowerCase().includes(normalizedQuery),
          );
        },
      );
      const page = Math.max(1, filters.page);
      const start = (page - 1) * pageSize;
      const pageReports = filtered.slice(start, start + pageSize);

      return {
        reports: pageReports
          .map((report) => {
            const ruling = store.rulings.find(
              (entry) => entry.id === report.rulingId,
            );

            return ruling
              ? buildTestWorkshopReportSummary(report, ruling, store.reports)
              : null;
          })
          .filter((report): report is WorkshopReportDetail => report !== null),
        total: filtered.length,
        page,
        pageSize,
      };
    },
    async getWorkshopReportByPublicId(publicId) {
      const store = getTestRunStore(runId);
      const report = store.reports.find((entry) => entry.publicId === publicId);

      if (!report) {
        return null;
      }

      const ruling = store.rulings.find(
        (entry) => entry.id === report.rulingId,
      );

      return ruling
        ? buildTestWorkshopReportSummary(report, ruling, store.reports)
        : null;
    },
    async listReportsForRuling(rulingPublicId, options) {
      const store = getTestRunStore(runId);
      const ruling = store.rulings.find(
        (entry) => entry.publicId === rulingPublicId,
      );

      if (!ruling) {
        return [];
      }

      return sortReportsForQueue(store.reports, 'newest')
        .filter(
          (report) =>
            report.rulingId === ruling.id &&
            report.publicId !== options?.excludeReportPublicId,
        )
        .slice(
          0,
          options?.limit ??
            securitySettings.workshop.search.relatedReportsLimit,
        )
        .map((report) =>
          buildTestWorkshopReportSummary(report, ruling, store.reports),
        );
    },
    async updateWorkshopReport(input) {
      const store = getTestRunStore(runId);
      const report = store.reports.find(
        (entry) => entry.publicId === input.publicId,
      );

      if (!report) {
        return null;
      }

      report.status = input.status;

      if (input.reviewedAt !== undefined) {
        report.reviewedAt = input.reviewedAt
          ? input.reviewedAt.toISOString()
          : null;
      }

      if (input.resolvedAt !== undefined) {
        report.resolvedAt = input.resolvedAt
          ? input.resolvedAt.toISOString()
          : null;
      }

      if (input.resolutionNote !== undefined) {
        report.resolutionNote = input.resolutionNote;
      }

      return this.getWorkshopReportByPublicId(input.publicId);
    },
    async hideRulingFromReport(input) {
      const store = getTestRunStore(runId);
      const report = store.reports.find(
        (entry) => entry.publicId === input.reportPublicId,
      );

      if (!report) {
        return {
          status: 'not-found',
        };
      }

      const ruling = store.rulings.find(
        (entry) => entry.id === report.rulingId,
      );

      if (!ruling) {
        return {
          status: 'not-found',
        };
      }

      if (ruling.visibility === 'hidden') {
        return {
          status: 'already-hidden',
          report: buildTestWorkshopReportSummary(report, ruling, store.reports),
        };
      }

      if (report.status !== 'open' && report.status !== 'reviewed') {
        return {
          status: 'transition-conflict',
          report: buildTestWorkshopReportSummary(report, ruling, store.reports),
        };
      }

      ruling.visibility = 'hidden';
      ruling.hiddenAt = input.now.toISOString();
      ruling.hiddenReason = input.hideReason;
      report.status = 'actioned';
      report.reviewedAt = report.reviewedAt ?? input.now.toISOString();
      report.resolvedAt = input.now.toISOString();
      report.resolutionNote = input.resolutionNote;

      let relatedActionedCount = 0;
      for (const otherReport of store.reports) {
        if (
          otherReport.rulingId !== ruling.id ||
          otherReport.publicId === report.publicId
        ) {
          continue;
        }

        if (
          otherReport.status === 'open' ||
          otherReport.status === 'reviewed'
        ) {
          otherReport.status = 'actioned';
          otherReport.reviewedAt =
            otherReport.reviewedAt ?? input.now.toISOString();
          otherReport.resolvedAt = input.now.toISOString();
          relatedActionedCount += 1;
        }
      }

      return {
        status: 'success',
        report: buildTestWorkshopReportSummary(report, ruling, store.reports),
        relatedActionedCount,
      };
    },
  };
}
