import { securitySettings } from '@/config/security';
import type { ListWorkshopReportsResult } from '@/server/workshop/reports-repository';
import { getWorkshopDashboardPageData } from '@/server/workshop/dashboard';
import {
  getReportTransition,
  type ReportTransitionAction,
} from '@/server/workshop/report-status';
import { getWorkshopReportsRepositoryForHeaders } from '@/server/workshop/test-mode';
import { validateOptionalText } from '@/utils/validation';
import {
  coercePositivePage,
  coerceWorkshopDecisionFilter,
  coerceWorkshopReportReasonFilter,
  coerceWorkshopReportStatusFilter,
  coerceWorkshopSort,
  coerceWorkshopVisibilityFilter,
  isValidWorkshopReportId,
  type WorkshopRulingFilters,
} from '@/utils/workshop';
import { isValidPublicRulingId } from '@/utils/rulingPages';
import { getWorkshopRepositoryForHeaders } from '@/server/workshop/test-mode';

function trimSearchQuery(query: string | null): string {
  if (!query) {
    return '';
  }

  return query.trim().slice(0, securitySettings.workshop.search.maxQueryLength);
}

async function recordActivitySafely(
  headers: Headers,
  input: Parameters<
    ReturnType<typeof getWorkshopRepositoryForHeaders>['createOwnerActivity']
  >[0],
): Promise<boolean> {
  try {
    await getWorkshopRepositoryForHeaders(headers).createOwnerActivity(input);
    return true;
  } catch {
    return false;
  }
}

export function parseWorkshopRulingFilters(
  searchParams: URLSearchParams,
): WorkshopRulingFilters {
  return {
    query: trimSearchQuery(searchParams.get('q')),
    decision: coerceWorkshopDecisionFilter(searchParams.get('decision')),
    visibility: coerceWorkshopVisibilityFilter(searchParams.get('visibility')),
    sort: coerceWorkshopSort(searchParams.get('sort')),
    page: coercePositivePage(searchParams.get('page')),
  };
}

export function parseWorkshopReportFilters(searchParams: URLSearchParams) {
  return {
    query: trimSearchQuery(searchParams.get('q')),
    status: coerceWorkshopReportStatusFilter(searchParams.get('status')),
    reason: coerceWorkshopReportReasonFilter(searchParams.get('reason')),
    visibility: coerceWorkshopVisibilityFilter(searchParams.get('visibility')),
    sort: coerceWorkshopSort(searchParams.get('sort')),
    page: coercePositivePage(searchParams.get('page')),
  };
}

export async function getWorkshopDashboardData(headers: Headers, url: URL) {
  return getWorkshopDashboardPageData(headers, url);
}

export async function getWorkshopOpenReportCount(headers: Headers) {
  return getWorkshopReportsRepositoryForHeaders(headers).countOpenReports();
}

export async function getWorkshopRulingsPageData(
  headers: Headers,
  searchParams: URLSearchParams,
) {
  const repository = getWorkshopRepositoryForHeaders(headers);
  const filters = parseWorkshopRulingFilters(searchParams);
  const result = await repository.listWorkshopRulings(filters);

  return {
    filters,
    ...result,
  };
}

export async function getWorkshopRulingDetailData(
  publicId: string,
  headers: Headers,
) {
  if (!isValidPublicRulingId(publicId)) {
    return null;
  }

  const repository = getWorkshopRepositoryForHeaders(headers);
  const reportsRepository = getWorkshopReportsRepositoryForHeaders(headers);
  const [ruling, activity, reports] = await Promise.all([
    repository.getWorkshopRulingByPublicId(publicId),
    repository.listOwnerActivityForRuling(publicId),
    reportsRepository.listReportsForRuling(publicId),
  ]);

  if (!ruling) {
    return null;
  }

  return {
    ruling,
    reports,
    activity,
  };
}

export async function getWorkshopReportsPageData(
  headers: Headers,
  searchParams: URLSearchParams,
) {
  const repository = getWorkshopReportsRepositoryForHeaders(headers);
  const filters = parseWorkshopReportFilters(searchParams);
  const result = await repository.listWorkshopReports(filters);

  return {
    filters,
    ...result,
  };
}

export type WorkshopReportsPageData = Awaited<
  ReturnType<typeof getWorkshopReportsPageData>
>;

export type WorkshopReportsPageState =
  | {
      status: 'ready';
      data: WorkshopReportsPageData;
    }
  | {
      status: 'unavailable';
      data: WorkshopReportsPageData;
      message: string;
    };

function buildEmptyWorkshopReportsPageData(
  filters: ReturnType<typeof parseWorkshopReportFilters>,
): WorkshopReportsPageData {
  const fallback: ListWorkshopReportsResult = {
    reports: [],
    total: 0,
    page: filters.page,
    pageSize: securitySettings.workshop.search.pageSize,
  };

  return {
    filters,
    ...fallback,
  };
}

export async function getWorkshopReportsPageState(
  headers: Headers,
  searchParams: URLSearchParams,
): Promise<WorkshopReportsPageState> {
  const filters = parseWorkshopReportFilters(searchParams);

  if (headers.get('x-santa-test-workshop-reports-failure') === 'list') {
    return {
      status: 'unavailable',
      data: buildEmptyWorkshopReportsPageData(filters),
      message:
        'The report queue is temporarily unavailable. Workshop navigation and other tools remain available.',
    };
  }

  try {
    const repository = getWorkshopReportsRepositoryForHeaders(headers);
    const result = await repository.listWorkshopReports(filters);

    return {
      status: 'ready',
      data: {
        filters,
        ...result,
      },
    };
  } catch (error) {
    console.error(
      '[santa-commands-it] Failed to load workshop reports page.',
      error,
    );

    return {
      status: 'unavailable',
      data: buildEmptyWorkshopReportsPageData(filters),
      message:
        'The report queue is temporarily unavailable. Workshop navigation and other tools remain available.',
    };
  }
}

export async function getWorkshopReportDetailData(
  publicId: string,
  headers: Headers,
) {
  if (!isValidWorkshopReportId(publicId)) {
    return null;
  }

  const repository = getWorkshopReportsRepositoryForHeaders(headers);
  const workshopRepository = getWorkshopRepositoryForHeaders(headers);
  const report = await repository.getWorkshopReportByPublicId(publicId);

  if (!report) {
    return null;
  }

  const [relatedReports, activity] = await Promise.all([
    repository.listReportsForRuling(report.rulingPublicId, {
      excludeReportPublicId: report.publicId,
    }),
    workshopRepository.listOwnerActivityForReport(report.publicId),
  ]);

  return {
    report,
    relatedReports,
    activity,
  };
}

export async function hideWorkshopRuling(input: {
  publicId: string;
  reason: string;
  headers: Headers;
  now?: Date;
}) {
  if (!isValidPublicRulingId(input.publicId)) {
    return { status: 'not-found' as const };
  }

  const validatedReason = validateOptionalText(
    input.reason,
    securitySettings.workshop.hideReasonMaxLength,
    `Please keep hide notes to ${securitySettings.workshop.hideReasonMaxLength} characters or fewer.`,
  );

  if (!validatedReason.valid) {
    return {
      status: 'invalid-reason' as const,
      message: validatedReason.error,
    };
  }

  const repository = getWorkshopRepositoryForHeaders(input.headers);
  const result = await repository.hideRuling(
    input.publicId,
    validatedReason.value || null,
    input.now ?? new Date(),
  );

  if (result === 'not-found' || result === 'already-hidden') {
    return { status: result };
  }

  const activityLogged = await recordActivitySafely(input.headers, {
    action: 'ruling-hidden',
    targetType: 'ruling',
    targetPublicId: result.publicId,
    details: validatedReason.value || null,
  });

  return {
    status: 'success' as const,
    ruling: result,
    activityLogged,
  };
}

export async function setWorkshopRulingFeatured(input: {
  publicId: string;
  featured: boolean;
  headers: Headers;
  now?: Date;
}) {
  if (!isValidPublicRulingId(input.publicId)) {
    return { status: 'not-found' as const };
  }

  const repository = getWorkshopRepositoryForHeaders(input.headers);
  const result = await repository.setRulingFeatured(
    input.publicId,
    input.featured,
    input.now ?? new Date(),
  );

  if (
    result === 'not-found' ||
    result === 'hidden' ||
    result === 'already-featured' ||
    result === 'already-unfeatured'
  ) {
    return { status: result };
  }

  const activityLogged = await recordActivitySafely(input.headers, {
    action: input.featured ? 'ruling-featured' : 'ruling-unfeatured',
    targetType: 'ruling',
    targetPublicId: result.publicId,
  });

  return {
    status: 'success' as const,
    ruling: result,
    activityLogged,
  };
}

export async function restoreWorkshopRuling(input: {
  publicId: string;
  headers: Headers;
}) {
  if (!isValidPublicRulingId(input.publicId)) {
    return { status: 'not-found' as const };
  }

  const repository = getWorkshopRepositoryForHeaders(input.headers);
  const result = await repository.restoreRuling(input.publicId);

  if (result === 'not-found' || result === 'already-public') {
    return { status: result };
  }

  const activityLogged = await recordActivitySafely(input.headers, {
    action: 'ruling-restored',
    targetType: 'ruling',
    targetPublicId: result.publicId,
  });

  return {
    status: 'success' as const,
    ruling: result,
    activityLogged,
  };
}

export async function deleteWorkshopRuling(input: {
  publicId: string;
  confirmation: string;
  headers: Headers;
}) {
  if (!isValidPublicRulingId(input.publicId)) {
    return { status: 'not-found' as const };
  }

  if (
    input.confirmation !==
    securitySettings.workshop.auth.deleteConfirmationPhrase
  ) {
    return { status: 'invalid-confirmation' as const };
  }

  const repository = getWorkshopRepositoryForHeaders(input.headers);
  const deleted = await repository.deleteRuling(input.publicId);

  if (!deleted) {
    return { status: 'not-found' as const };
  }

  const activityLogged = await recordActivitySafely(input.headers, {
    action: 'ruling-deleted',
    targetType: 'ruling',
    targetPublicId: input.publicId,
  });

  return {
    status: 'success' as const,
    activityLogged,
  };
}

function validateResolutionNote(note: string) {
  return validateOptionalText(
    note,
    securitySettings.workshop.resolutionNoteMaxLength,
    `Please keep resolution notes to ${securitySettings.workshop.resolutionNoteMaxLength} characters or fewer.`,
  );
}

function getReportActivityAction(
  action: Exclude<ReportTransitionAction, 'hide-and-action'>,
) {
  switch (action) {
    case 'review':
      return 'report-reviewed' as const;
    case 'dismiss':
      return 'report-dismissed' as const;
    case 'reopen':
      return 'report-reopened' as const;
    case 'action':
      return 'report-actioned' as const;
  }
}

export async function transitionWorkshopReport(input: {
  publicId: string;
  action: Exclude<ReportTransitionAction, 'hide-and-action'>;
  resolutionNote?: string;
  headers: Headers;
  now?: Date;
}) {
  if (!isValidWorkshopReportId(input.publicId)) {
    return { status: 'not-found' as const };
  }

  const validatedNote = validateResolutionNote(input.resolutionNote ?? '');

  if (!validatedNote.valid) {
    return {
      status: 'invalid-note' as const,
      message: validatedNote.error,
    };
  }

  const reportsRepository = getWorkshopReportsRepositoryForHeaders(
    input.headers,
  );
  const existing = await reportsRepository.getWorkshopReportByPublicId(
    input.publicId,
  );

  if (!existing) {
    return { status: 'not-found' as const };
  }

  const now = input.now ?? new Date();
  const transition = getReportTransition(existing.status, input.action, now);

  if (!transition.ok) {
    return {
      status: transition.reason,
      report: existing,
    } as const;
  }

  const updated = await reportsRepository.updateWorkshopReport({
    publicId: existing.publicId,
    status: transition.nextStatus,
    reviewedAt: transition.updates.reviewedAt,
    resolvedAt: transition.updates.resolvedAt,
    resolutionNote:
      input.action === 'review'
        ? undefined
        : input.action === 'reopen'
          ? null
          : validatedNote.value || null,
  });

  if (!updated) {
    return { status: 'not-found' as const };
  }

  const activityLogged = await recordActivitySafely(input.headers, {
    action: getReportActivityAction(input.action),
    targetType: 'report',
    targetPublicId: updated.publicId,
    relatedPublicId: updated.rulingPublicId,
    details:
      input.action === 'dismiss' || input.action === 'action'
        ? validatedNote.value || null
        : null,
  });

  return {
    status: 'success' as const,
    report: updated,
    activityLogged,
  };
}

export async function hideWorkshopRulingFromReport(input: {
  publicId: string;
  hideReason: string;
  resolutionNote: string;
  headers: Headers;
  now?: Date;
}) {
  if (!isValidWorkshopReportId(input.publicId)) {
    return { status: 'not-found' as const };
  }

  const validatedHideReason = validateOptionalText(
    input.hideReason,
    securitySettings.workshop.hideReasonMaxLength,
    `Please keep hide notes to ${securitySettings.workshop.hideReasonMaxLength} characters or fewer.`,
  );

  if (!validatedHideReason.valid) {
    return {
      status: 'invalid-hide-reason' as const,
      message: validatedHideReason.error,
    };
  }

  const validatedResolutionNote = validateResolutionNote(input.resolutionNote);

  if (!validatedResolutionNote.valid) {
    return {
      status: 'invalid-note' as const,
      message: validatedResolutionNote.error,
    };
  }

  const reportsRepository = getWorkshopReportsRepositoryForHeaders(
    input.headers,
  );
  const result = await reportsRepository.hideRulingFromReport({
    reportPublicId: input.publicId,
    hideReason: validatedHideReason.value || null,
    resolutionNote: validatedResolutionNote.value || null,
    now: input.now ?? new Date(),
  });

  if (result.status !== 'success') {
    return result;
  }

  const reportActionLogged = await recordActivitySafely(input.headers, {
    action: 'report-actioned',
    targetType: 'report',
    targetPublicId: result.report.publicId,
    relatedPublicId: result.report.rulingPublicId,
    details: validatedResolutionNote.value || null,
  });
  const rulingActionLogged = await recordActivitySafely(input.headers, {
    action: 'ruling-hidden-from-report',
    targetType: 'ruling',
    targetPublicId: result.report.rulingPublicId,
    relatedPublicId: result.report.publicId,
    details: validatedHideReason.value || null,
  });
  const relatedActionLogged =
    result.relatedActionedCount > 0
      ? await recordActivitySafely(input.headers, {
          action: 'related-reports-actioned',
          targetType: 'ruling',
          targetPublicId: result.report.rulingPublicId,
          relatedPublicId: result.report.publicId,
          details:
            result.relatedActionedCount === 1
              ? '1 related report was also marked actioned.'
              : `${result.relatedActionedCount} related reports were also marked actioned.`,
        })
      : true;

  return {
    status: 'success' as const,
    report: result.report,
    relatedActionedCount: result.relatedActionedCount,
    activityLogged:
      reportActionLogged && rulingActionLogged && relatedActionLogged,
  };
}
