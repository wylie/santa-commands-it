import type { PersistedRulingDecision } from '@/utils/rulings';
import { reportReasons, type ReportReason } from '@/config/reports';

export type RulingVisibility = 'public' | 'hidden';
export type WorkshopSort = 'newest' | 'oldest';
export type WorkshopDecisionFilter = 'all' | PersistedRulingDecision;
export type WorkshopVisibilityFilter = 'all' | RulingVisibility;
export type WorkshopFeaturedFilter = 'all' | 'featured' | 'not-featured';
export type WorkshopReportStatus =
  'open' | 'reviewed' | 'dismissed' | 'actioned';
export type WorkshopReportStatusFilter = 'all' | WorkshopReportStatus;
export type WorkshopReportReasonFilter = 'all' | ReportReason;
export type WorkshopDashboardRange = '7d' | '30d' | '90d' | 'all';

export type OwnerActivityAction =
  | 'login-success'
  | 'login-failure'
  | 'logout'
  | 'ruling-hidden'
  | 'ruling-restored'
  | 'ruling-deleted'
  | 'ruling-featured'
  | 'ruling-unfeatured'
  | 'report-reviewed'
  | 'report-dismissed'
  | 'report-reopened'
  | 'report-actioned'
  | 'ruling-hidden-from-report'
  | 'related-reports-actioned'
  | 'moderation-rule-created'
  | 'moderation-rule-updated'
  | 'moderation-rule-enabled'
  | 'moderation-rule-disabled'
  | 'moderation-rule-deleted'
  | 'santa-settings-updated'
  | 'seasonal-mode-updated'
  | 'seasonal-greeting-enabled'
  | 'seasonal-greeting-disabled'
  | 'seasonal-greeting-updated'
  | 'seasonal-status-enabled'
  | 'seasonal-status-disabled'
  | 'seasonal-status-updated'
  | 'seasonal-countdown-enabled'
  | 'seasonal-countdown-disabled'
  | 'seasonal-countdown-updated'
  | 'seasonal-defaults-restored'
  | 'response-template-created'
  | 'response-template-updated'
  | 'response-template-enabled'
  | 'response-template-disabled'
  | 'response-template-deleted';

export type OwnerActivityTargetType =
  | 'auth'
  | 'ruling'
  | 'report'
  | 'moderation-rule'
  | 'setting'
  | 'response-template';

export type OwnerActivityEntry = {
  action: OwnerActivityAction;
  targetType: OwnerActivityTargetType;
  targetPublicId: string | null;
  relatedPublicId: string | null;
  details: string | null;
  createdAt: string;
};

export type WorkshopRulingSummary = {
  publicId: string;
  displayName: string;
  requestText: string;
  decision: PersistedRulingDecision;
  santaResponse: string;
  visibility: RulingVisibility;
  isFeatured: boolean;
  featuredAt: string | null;
  hiddenAt: string | null;
  hiddenReason: string | null;
  createdAt: string;
  reportCount: number;
  openReportCount: number;
  latestReportAt: string | null;
};

export type WorkshopRulingDetail = WorkshopRulingSummary;

export type WorkshopDashboardMetrics = {
  totalRulings: number;
  approvedRulings: number;
  coalRulings: number;
  hiddenRulings: number;
  featuredRulings: number;
  openReports: number;
  reviewedReports: number;
  actionedReportsLast7Days: number;
  rulingsWithMultipleOpenReports: number;
};

export type WorkshopRulingFilters = {
  query: string;
  decision: WorkshopDecisionFilter;
  visibility: WorkshopVisibilityFilter;
  featured: WorkshopFeaturedFilter;
  sort: WorkshopSort;
  page: number;
};

export type WorkshopReportSummary = {
  publicId: string;
  reason: ReportReason;
  note: string | null;
  status: WorkshopReportStatus;
  reviewedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  rulingPublicId: string;
  rulingDisplayName: string;
  rulingRequestText: string;
  rulingDecision: PersistedRulingDecision;
  rulingVisibility: RulingVisibility;
  rulingCreatedAt: string;
  totalReportsForRuling: number;
  openReportsForRuling: number;
};

export type WorkshopReportDetail = WorkshopReportSummary & {
  rulingSantaResponse: string;
};

export type WorkshopReportFilters = {
  query: string;
  status: WorkshopReportStatusFilter;
  reason: WorkshopReportReasonFilter;
  visibility: WorkshopVisibilityFilter;
  sort: WorkshopSort;
  page: number;
};

export const WORKSHOP_REPORT_ID_PREFIX = 'report_';
const WORKSHOP_REPORT_ID_PATTERN = /^report_[a-z0-9-]{24,80}$/;

export function serializeOptionalTimestamp(
  value: string | Date | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  return (value instanceof Date ? value : new Date(value)).toISOString();
}

export function getDecisionFilterLabel(
  decision: WorkshopDecisionFilter,
): string {
  if (decision === 'approved') {
    return 'Approved';
  }

  if (decision === 'random-coal') {
    return 'Coal';
  }

  return 'All decisions';
}

export function getVisibilityLabel(visibility: RulingVisibility): string {
  return visibility === 'public' ? 'Public' : 'Hidden';
}

export function getOwnerActivityLabel(action: OwnerActivityAction): string {
  switch (action) {
    case 'login-success':
      return 'Login';
    case 'login-failure':
      return 'Failed login';
    case 'logout':
      return 'Logout';
    case 'ruling-hidden':
      return 'Ruling hidden';
    case 'ruling-restored':
      return 'Ruling restored';
    case 'ruling-deleted':
      return 'Ruling deleted';
    case 'ruling-featured':
      return 'Ruling featured';
    case 'ruling-unfeatured':
      return 'Ruling unfeatured';
    case 'report-reviewed':
      return 'Report reviewed';
    case 'report-dismissed':
      return 'Report dismissed';
    case 'report-reopened':
      return 'Report reopened';
    case 'report-actioned':
      return 'Report actioned';
    case 'ruling-hidden-from-report':
      return 'Ruling hidden from report';
    case 'related-reports-actioned':
      return 'Related reports actioned';
    case 'moderation-rule-created':
      return 'Moderation rule created';
    case 'moderation-rule-updated':
      return 'Moderation rule updated';
    case 'moderation-rule-enabled':
      return 'Moderation rule enabled';
    case 'moderation-rule-disabled':
      return 'Moderation rule disabled';
    case 'moderation-rule-deleted':
      return 'Moderation rule deleted';
    case 'santa-settings-updated':
      return 'Santa settings updated';
    case 'seasonal-mode-updated':
      return 'Seasonal mode updated';
    case 'seasonal-greeting-enabled':
      return 'Seasonal greeting enabled';
    case 'seasonal-greeting-disabled':
      return 'Seasonal greeting disabled';
    case 'seasonal-greeting-updated':
      return 'Seasonal greeting updated';
    case 'seasonal-status-enabled':
      return 'Seasonal status enabled';
    case 'seasonal-status-disabled':
      return 'Seasonal status disabled';
    case 'seasonal-status-updated':
      return 'Seasonal status updated';
    case 'seasonal-countdown-enabled':
      return 'Seasonal countdown enabled';
    case 'seasonal-countdown-disabled':
      return 'Seasonal countdown disabled';
    case 'seasonal-countdown-updated':
      return 'Seasonal countdown updated';
    case 'seasonal-defaults-restored':
      return 'Seasonal defaults restored';
    case 'response-template-created':
      return 'Response template created';
    case 'response-template-updated':
      return 'Response template updated';
    case 'response-template-enabled':
      return 'Response template enabled';
    case 'response-template-disabled':
      return 'Response template disabled';
    case 'response-template-deleted':
      return 'Response template deleted';
  }
}

export function getWorkshopReportStatusLabel(
  status: WorkshopReportStatus,
): string {
  switch (status) {
    case 'open':
      return 'Open';
    case 'reviewed':
      return 'Reviewed';
    case 'dismissed':
      return 'Dismissed';
    case 'actioned':
      return 'Actioned';
  }
}

export function getWorkshopReportReasonLabel(reason: ReportReason): string {
  return (
    reportReasons.find((entry) => entry.value === reason)?.label ?? 'Unknown'
  );
}

export function coerceWorkshopDecisionFilter(
  value: string | null,
): WorkshopDecisionFilter {
  if (value === 'approved') {
    return 'approved';
  }

  if (value === 'coal' || value === 'random-coal') {
    return 'random-coal';
  }

  return 'all';
}

export function coerceWorkshopVisibilityFilter(
  value: string | null,
): WorkshopVisibilityFilter {
  if (value === 'public' || value === 'hidden') {
    return value;
  }

  return 'all';
}

export function coerceWorkshopFeaturedFilter(
  value: string | null,
): WorkshopFeaturedFilter {
  if (value === 'featured' || value === 'not-featured') {
    return value;
  }

  return 'all';
}

export function coerceWorkshopSort(value: string | null): WorkshopSort {
  return value === 'oldest' ? 'oldest' : 'newest';
}

export function coerceWorkshopReportStatusFilter(
  value: string | null,
): WorkshopReportStatusFilter {
  if (
    value === 'open' ||
    value === 'reviewed' ||
    value === 'dismissed' ||
    value === 'actioned'
  ) {
    return value;
  }

  return 'all';
}

export function coerceWorkshopReportReasonFilter(
  value: string | null,
): WorkshopReportReasonFilter {
  if (
    value === 'bullying' ||
    value === 'hate' ||
    value === 'personal-information' ||
    value === 'inappropriate' ||
    value === 'threats' ||
    value === 'spam' ||
    value === 'other'
  ) {
    return value;
  }

  return 'all';
}

export function coerceWorkshopDashboardRange(
  value: string | null,
): WorkshopDashboardRange {
  if (value === '7d' || value === '30d' || value === '90d' || value === 'all') {
    return value;
  }

  return '30d';
}

export function coercePositivePage(value: string | null): number {
  const page = value ? Number.parseInt(value, 10) : Number.NaN;

  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function isValidWorkshopReportId(value: string): boolean {
  return WORKSHOP_REPORT_ID_PATTERN.test(value);
}
