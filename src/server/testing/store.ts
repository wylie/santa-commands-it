import type { PublicRuling } from '@/utils/rulings';
import type { ReportReason } from '@/config/reports';
import type {
  OwnerActivityAction,
  OwnerActivityTargetType,
  RulingVisibility,
  WorkshopReportStatus,
} from '@/utils/workshop';

export type TestStoredRuling = PublicRuling & {
  id: number;
  visibility: RulingVisibility;
  hiddenAt: string | null;
  hiddenReason: string | null;
};

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
  publicId: string;
  rulingId: number;
  clientKeyHash: string;
  reason: ReportReason;
  note: string | null;
  status: WorkshopReportStatus;
  reviewedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
};

export type TestWorkshopSession = {
  id: number;
  tokenHash: string;
  csrfToken: string;
  expiresAt: string;
  createdAt: string;
};

export type TestWorkshopLoginAttempt = {
  clientKeyHash: string;
  successful: boolean;
  createdAt: string;
};

export type TestOwnerActivityRecord = {
  id: number;
  action: OwnerActivityAction;
  targetType: OwnerActivityTargetType;
  targetPublicId: string | null;
  relatedPublicId: string | null;
  details: string | null;
  createdAt: string;
};

export type TestRunStore = {
  rulings: TestStoredRuling[];
  submissionAttempts: TestSubmissionAttempt[];
  idempotencyRecords: TestIdempotencyRecord[];
  reports: TestReportRecord[];
  workshopSessions: TestWorkshopSession[];
  workshopLoginAttempts: TestWorkshopLoginAttempt[];
  ownerActivity: TestOwnerActivityRecord[];
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
    workshopSessions: [],
    workshopLoginAttempts: [],
    ownerActivity: [],
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
