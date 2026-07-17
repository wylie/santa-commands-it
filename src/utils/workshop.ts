import type { PersistedRulingDecision } from '@/utils/rulings';

export type RulingVisibility = 'public' | 'hidden';
export type WorkshopSort = 'newest' | 'oldest';
export type WorkshopDecisionFilter = 'all' | PersistedRulingDecision;
export type WorkshopVisibilityFilter = 'all' | RulingVisibility;

export type OwnerActivityAction =
  | 'login-success'
  | 'login-failure'
  | 'logout'
  | 'ruling-hidden'
  | 'ruling-restored'
  | 'ruling-deleted';

export type OwnerActivityTargetType = 'auth' | 'ruling';

export type OwnerActivityEntry = {
  action: OwnerActivityAction;
  targetType: OwnerActivityTargetType;
  targetPublicId: string | null;
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
  hiddenAt: string | null;
  hiddenReason: string | null;
  createdAt: string;
  reportCount: number;
};

export type WorkshopRulingDetail = WorkshopRulingSummary;

export type WorkshopDashboardMetrics = {
  totalRulings: number;
  approvedRulings: number;
  coalRulings: number;
  hiddenRulings: number;
  openReports: number;
};

export type WorkshopRulingFilters = {
  query: string;
  decision: WorkshopDecisionFilter;
  visibility: WorkshopVisibilityFilter;
  sort: WorkshopSort;
  page: number;
};

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
  }
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

export function coerceWorkshopSort(value: string | null): WorkshopSort {
  return value === 'oldest' ? 'oldest' : 'newest';
}

export function coercePositivePage(value: string | null): number {
  const page = value ? Number.parseInt(value, 10) : Number.NaN;

  return Number.isInteger(page) && page > 0 ? page : 1;
}
