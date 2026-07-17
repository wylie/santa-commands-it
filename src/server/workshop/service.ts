import { securitySettings } from '@/config/security';
import { validateOptionalText } from '@/utils/validation';
import {
  coercePositivePage,
  coerceWorkshopDecisionFilter,
  coerceWorkshopSort,
  coerceWorkshopVisibilityFilter,
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

export async function getWorkshopDashboardData(headers: Headers) {
  const repository = getWorkshopRepositoryForHeaders(headers);
  const [metrics, recentRulings, recentActivity] = await Promise.all([
    repository.getDashboardMetrics(),
    repository.listRecentWorkshopRulings(),
    repository.listRecentOwnerActivity(),
  ]);

  return {
    metrics,
    recentRulings,
    recentActivity,
  };
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
  const [ruling, activity] = await Promise.all([
    repository.getWorkshopRulingByPublicId(publicId),
    repository.listOwnerActivityForRuling(publicId),
  ]);

  if (!ruling) {
    return null;
  }

  return {
    ruling,
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
