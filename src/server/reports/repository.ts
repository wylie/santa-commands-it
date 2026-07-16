import { and, count, eq, gte } from 'drizzle-orm';

import type { ReportReason } from '@/config/reports';
import { getDatabase } from '@/server/db/client';
import { rulingReports } from '@/server/db/schema';
import { getTestRunStore } from '@/server/testing/store';

export type CreateRulingReportInput = {
  rulingId: number;
  clientKeyHash: string;
  reason: ReportReason;
  note: string;
};

export type RulingReportsRepository = {
  countReportsSince(clientKeyHash: string, since: Date): Promise<number>;
  hasRecentReportForRuling(
    rulingId: number,
    clientKeyHash: string,
    since: Date,
  ): Promise<boolean>;
  createReport(input: CreateRulingReportInput): Promise<void>;
};

export function createDatabaseRulingReportsRepository(): RulingReportsRepository {
  return {
    async countReportsSince(clientKeyHash, since) {
      const database = getDatabase();
      const [result] = await database
        .select({
          value: count(),
        })
        .from(rulingReports)
        .where(
          and(
            eq(rulingReports.clientKeyHash, clientKeyHash),
            gte(rulingReports.createdAt, since),
          ),
        );

      return Number(result?.value ?? 0);
    },
    async hasRecentReportForRuling(rulingId, clientKeyHash, since) {
      const database = getDatabase();
      const [result] = await database
        .select({
          id: rulingReports.id,
        })
        .from(rulingReports)
        .where(
          and(
            eq(rulingReports.rulingId, rulingId),
            eq(rulingReports.clientKeyHash, clientKeyHash),
            gte(rulingReports.createdAt, since),
          ),
        )
        .limit(1);

      return Boolean(result);
    },
    async createReport(input) {
      const database = getDatabase();
      await database.insert(rulingReports).values({
        rulingId: input.rulingId,
        clientKeyHash: input.clientKeyHash,
        reason: input.reason,
        note: input.note || null,
        status: 'open',
      });
    },
  };
}

export function createTestRulingReportsRepository(
  runId: string,
): RulingReportsRepository {
  return {
    async countReportsSince(clientKeyHash, since) {
      const threshold = since.getTime();

      return getTestRunStore(runId).reports.filter(
        (report) =>
          report.clientKeyHash === clientKeyHash &&
          new Date(report.createdAt).getTime() >= threshold,
      ).length;
    },
    async hasRecentReportForRuling(rulingId, clientKeyHash, since) {
      const threshold = since.getTime();

      return getTestRunStore(runId).reports.some(
        (report) =>
          report.rulingId === rulingId &&
          report.clientKeyHash === clientKeyHash &&
          new Date(report.createdAt).getTime() >= threshold,
      );
    },
    async createReport(input) {
      const store = getTestRunStore(runId);
      store.reports.push({
        id: store.reports.length + 1,
        rulingId: input.rulingId,
        clientKeyHash: input.clientKeyHash,
        reason: input.reason,
        note: input.note || null,
        status: 'open',
        createdAt: new Date().toISOString(),
      });
    },
  };
}
