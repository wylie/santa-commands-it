import type { PublicRuling } from '@/utils/rulings';
import type { ReportReason } from '@/config/reports';

export type TestSubmissionAttempt = {
  clientKeyHash: string;
  createdAt: string;
};

export type TestIdempotencyRecord = {
  clientKeyHash: string;
  idempotencyKey: string;
  normalizedName: string;
  normalizedRequest: string;
  rulingPublicId: string;
  createdAt: string;
  expiresAt: string;
};

export type TestReportRecord = {
  id: number;
  rulingId: number;
  clientKeyHash: string;
  reason: ReportReason;
  note: string | null;
  status: 'open' | 'reviewed' | 'dismissed' | 'actioned';
  createdAt: string;
};

export type TestRunStore = {
  rulings: PublicRuling[];
  submissionAttempts: TestSubmissionAttempt[];
  idempotencyRecords: TestIdempotencyRecord[];
  reports: TestReportRecord[];
};

const stores = new Map<string, TestRunStore>();

export function getTestRunStore(runId: string): TestRunStore {
  const existingStore = stores.get(runId);

  if (existingStore) {
    return existingStore;
  }

  const nextStore: TestRunStore = {
    rulings: [],
    submissionAttempts: [],
    idempotencyRecords: [],
    reports: [],
  };

  stores.set(runId, nextStore);

  return nextStore;
}

export function clearTestRunStore(runId?: string): void {
  if (runId) {
    stores.delete(runId);
    return;
  }

  stores.clear();
}
