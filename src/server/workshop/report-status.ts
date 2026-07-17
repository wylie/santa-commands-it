import type { WorkshopReportStatus } from '@/utils/workshop';

export type ReportTransitionAction =
  'review' | 'dismiss' | 'reopen' | 'action' | 'hide-and-action';

export type ReportTransitionResult =
  | {
      ok: true;
      nextStatus: WorkshopReportStatus;
      updates: {
        reviewedAt?: Date | null;
        resolvedAt?: Date | null;
      };
    }
  | {
      ok: false;
      reason: 'no-op' | 'invalid-transition';
    };

export function getReportTransition(
  currentStatus: WorkshopReportStatus,
  action: ReportTransitionAction,
  now: Date,
): ReportTransitionResult {
  if (action === 'review') {
    if (currentStatus === 'open') {
      return {
        ok: true,
        nextStatus: 'reviewed',
        updates: {
          reviewedAt: now,
        },
      };
    }

    return {
      ok: false,
      reason: currentStatus === 'reviewed' ? 'no-op' : 'invalid-transition',
    };
  }

  if (action === 'dismiss') {
    if (currentStatus === 'open' || currentStatus === 'reviewed') {
      return {
        ok: true,
        nextStatus: 'dismissed',
        updates: {
          reviewedAt: currentStatus === 'open' ? now : undefined,
          resolvedAt: now,
        },
      };
    }

    return {
      ok: false,
      reason: currentStatus === 'dismissed' ? 'no-op' : 'invalid-transition',
    };
  }

  if (action === 'reopen') {
    if (
      currentStatus === 'reviewed' ||
      currentStatus === 'dismissed' ||
      currentStatus === 'actioned'
    ) {
      return {
        ok: true,
        nextStatus: 'open',
        updates: {
          resolvedAt: null,
        },
      };
    }

    return {
      ok: false,
      reason: currentStatus === 'open' ? 'no-op' : 'invalid-transition',
    };
  }

  if (action === 'action' || action === 'hide-and-action') {
    if (currentStatus === 'open' || currentStatus === 'reviewed') {
      return {
        ok: true,
        nextStatus: 'actioned',
        updates: {
          reviewedAt: currentStatus === 'open' ? now : undefined,
          resolvedAt: now,
        },
      };
    }

    return {
      ok: false,
      reason: currentStatus === 'actioned' ? 'no-op' : 'invalid-transition',
    };
  }

  return {
    ok: false,
    reason: 'invalid-transition',
  };
}
