import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getConfigurationRepositoryForHeaders } from '@/server/config/test-mode';
import { getRuntimeConfigurationForHeaders } from '@/server/config/service';
import {
  getSiteTimeZone,
  getSiteUrl,
  isProductionEnvironment,
} from '@/server/env';
import { getRequestNow } from '@/server/rulings/test-mode';
import { getWorkshopReportsRepositoryForHeaders } from '@/server/workshop/test-mode';
import { getWorkshopRepositoryForHeaders } from '@/server/workshop/test-mode';
import {
  coerceWorkshopDashboardRange,
  getOwnerActivityLabel,
  type OwnerActivityAction,
  type WorkshopDashboardRange,
  type WorkshopRulingSummary,
} from '@/utils/workshop';

export const WORKSHOP_DASHBOARD_RANGES = [
  {
    value: '7d',
    label: '7 days',
    totalDays: 7,
    bucketGranularity: 'day',
  },
  {
    value: '30d',
    label: '30 days',
    totalDays: 30,
    bucketGranularity: 'day',
  },
  {
    value: '90d',
    label: '90 days',
    totalDays: 90,
    bucketGranularity: 'day',
  },
  {
    value: 'all',
    label: 'All time',
    totalDays: null,
    bucketGranularity: 'month',
  },
] as const satisfies ReadonlyArray<{
  value: WorkshopDashboardRange;
  label: string;
  totalDays: number | null;
  bucketGranularity: 'day' | 'month';
}>;

export type DashboardSection<T> =
  | {
      status: 'ready';
      data: T;
    }
  | {
      status: 'unavailable';
      message: string;
    };

export type WorkshopDashboardAggregateCounts = {
  totalRulings: number;
  approvedRulings: number;
  coalRulings: number;
  publicRulings: number;
  hiddenRulings: number;
};

export type WorkshopDashboardRulingMetrics = {
  current: WorkshopDashboardAggregateCounts;
  previous: WorkshopDashboardAggregateCounts | null;
};

export type WorkshopDashboardTrendRow = {
  bucketKey: string;
  totalRulings: number;
  approvedRulings: number;
  coalRulings: number;
  publicRulings: number;
  hiddenRulings: number;
};

export type WorkshopDashboardReportSummary = {
  currentOpenReports: number;
  currentReviewedReports: number;
  reportsCreatedInRange: number;
  reportsDismissedInRange: number;
  reportsActionedInRange: number;
  rulingsWithMultipleOpenReports: number;
  oldestOpenReportCreatedAt: string | null;
};

export type WorkshopModerationDashboardSummary = {
  activeBlockedWords: number;
  activeBlockedPhrases: number;
  activeAllowedExceptions: number;
  inactiveRules: number;
  lastUpdatedAt: string | null;
};

export type WorkshopResponseTemplateDashboardSummary = {
  activeApprovedTemplates: number;
  activeCoalTemplates: number;
  activeBlockedWarningTemplates: number;
  inactiveTemplates: number;
  lastUpdatedAt: string | null;
};

export type DashboardTimeWindow = {
  range: WorkshopDashboardRange;
  label: string;
  bucketGranularity: 'day' | 'month';
  timeZone: string;
  currentStart: Date | null;
  currentEnd: Date;
  previousStart: Date | null;
  previousEnd: Date | null;
  comparisonLabel: string | null;
};

export type WorkshopDashboardRangeLink = {
  value: WorkshopDashboardRange;
  label: string;
  href: string;
  active: boolean;
};

export type WorkshopDashboardMetricCard = {
  label: string;
  value: number;
  kind: 'range' | 'current';
  description: string;
  comparison: DashboardMetricComparison | null;
};

export type DashboardMetricComparison = {
  delta: number;
  percentageChange: number | null;
  direction: 'up' | 'down' | 'flat';
  label: string;
};

export type WorkshopDashboardDecisionBreakdown = {
  totalRulings: number;
  approvedRulings: number;
  coalRulings: number;
  approvedPercentage: number;
  coalPercentage: number;
};

export type WorkshopDashboardCoalSummary = {
  randomCoalEnabled: boolean;
  configuredCoalPercentage: number | null;
  actualCoalPercentage: number;
  note: string;
};

export type WorkshopDashboardOverview = {
  primaryMetrics: WorkshopDashboardMetricCard[];
  decisionBreakdown: WorkshopDashboardDecisionBreakdown;
  coalSummary: WorkshopDashboardCoalSummary;
};

export type WorkshopDashboardTrendPoint = {
  bucketKey: string;
  label: string;
  totalRulings: number;
  approvedRulings: number;
  coalRulings: number;
  publicRulings: number;
  hiddenRulings: number;
};

export type WorkshopDashboardReports = WorkshopDashboardReportSummary & {
  oldestOpenReportAgeDays: number | null;
};

export type WorkshopDashboardConfigurationSummary = {
  moderation: WorkshopModerationDashboardSummary;
  templates: WorkshopResponseTemplateDashboardSummary;
};

export type WorkshopDashboardHealthCheck = {
  label: string;
  status: 'healthy' | 'needs-attention' | 'unavailable';
  detail: string;
  href: string | null;
};

export type WorkshopDashboardHealth = {
  overallStatus: 'healthy' | 'needs-attention' | 'unavailable';
  checks: WorkshopDashboardHealthCheck[];
};

export type WorkshopDashboardRecentRuling = {
  publicId: string;
  displayName: string;
  requestExcerpt: string;
  decision: WorkshopRulingSummary['decision'];
  visibility: WorkshopRulingSummary['visibility'];
  createdAt: string;
  reportCount: number;
  openReportCount: number;
};

export type WorkshopDashboardOwnerActivity = {
  action: OwnerActivityAction;
  label: string;
  targetReference: string | null;
  detail: string | null;
  createdAt: string;
};

export type WorkshopDashboardPageData = {
  range: WorkshopDashboardRange;
  rangeLabel: string;
  rangeLinks: WorkshopDashboardRangeLink[];
  timeZone: string;
  comparisonLabel: string | null;
  openReportCount: number;
  warningMessages: string[];
  overview: DashboardSection<WorkshopDashboardOverview>;
  trend: DashboardSection<WorkshopDashboardTrendPoint[]>;
  reports: DashboardSection<WorkshopDashboardReports>;
  configuration: DashboardSection<WorkshopDashboardConfigurationSummary>;
  health: DashboardSection<WorkshopDashboardHealth>;
  recentRulings: DashboardSection<WorkshopDashboardRecentRuling[]>;
  recentActivity: DashboardSection<WorkshopDashboardOwnerActivity[]>;
};

type CalendarDayParts = {
  year: number;
  month: number;
  day: number;
};

type CalendarMonthParts = {
  year: number;
  month: number;
};

const santaArtworkPath = fileURLToPath(
  new URL('../../../public/images/santa-solo.png', import.meta.url),
);

function getDashboardRangeConfig(range: WorkshopDashboardRange) {
  return (
    WORKSHOP_DASHBOARD_RANGES.find((entry) => entry.value === range) ??
    WORKSHOP_DASHBOARD_RANGES[1]
  );
}

function getFormatterParts(
  date: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    ...options,
  }).formatToParts(date);
}

function readNumericPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
) {
  return Number.parseInt(
    parts.find((part) => part.type === type)?.value ?? '0',
    10,
  );
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getFormatterParts(date, timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const year = readNumericPart(parts, 'year');
  const month = readNumericPart(parts, 'month');
  const day = readNumericPart(parts, 'day');
  const hour = readNumericPart(parts, 'hour');
  const minute = readNumericPart(parts, 'minute');
  const second = readNumericPart(parts, 'second');

  return Date.UTC(year, month - 1, day, hour, minute, second) - date.getTime();
}

function zonedDateTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const initialOffset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  const candidate = new Date(utcGuess - initialOffset);
  const candidateOffset = getTimeZoneOffsetMs(candidate, timeZone);

  if (candidateOffset === initialOffset) {
    return candidate;
  }

  return new Date(utcGuess - candidateOffset);
}

function getZonedDayParts(date: Date, timeZone: string): CalendarDayParts {
  const parts = getFormatterParts(date, timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return {
    year: readNumericPart(parts, 'year'),
    month: readNumericPart(parts, 'month'),
    day: readNumericPart(parts, 'day'),
  };
}

function getZonedMonthParts(date: Date, timeZone: string): CalendarMonthParts {
  const dayParts = getZonedDayParts(date, timeZone);

  return {
    year: dayParts.year,
    month: dayParts.month,
  };
}

function addCalendarDays(
  parts: CalendarDayParts,
  delta: number,
): CalendarDayParts {
  const value = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + delta),
  );

  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

function addCalendarMonths(
  parts: CalendarMonthParts,
  delta: number,
): CalendarMonthParts {
  const value = new Date(Date.UTC(parts.year, parts.month - 1 + delta, 1));

  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
  };
}

function buildDayKey(parts: CalendarDayParts) {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function buildMonthKey(parts: CalendarMonthParts) {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}`;
}

function parseDayKey(value: string): CalendarDayParts {
  const [year, month, day] = value
    .split('-')
    .map((part) => Number.parseInt(part, 10));

  return {
    year,
    month,
    day,
  };
}

function parseMonthKey(value: string): CalendarMonthParts {
  const [year, month] = value
    .split('-')
    .map((part) => Number.parseInt(part, 10));

  return {
    year,
    month,
  };
}

function formatTrendLabel(
  bucketKey: string,
  bucketGranularity: 'day' | 'month',
) {
  if (bucketGranularity === 'day') {
    const parts = parseDayKey(bucketKey);

    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
    }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12)));
  }

  const parts = parseMonthKey(bucketKey);

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    year: 'numeric',
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, 1, 12)));
}

function calculatePercentage(value: number, total: number) {
  if (!total) {
    return 0;
  }

  return (value / total) * 100;
}

function buildMetricComparison(
  label: string,
  current: number,
  previous: number | null,
): DashboardMetricComparison | null {
  if (previous === null) {
    return null;
  }

  const delta = current - previous;
  const percentageChange = previous === 0 ? null : (delta / previous) * 100;

  return {
    delta,
    percentageChange,
    direction: delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down',
    label,
  };
}

function abbreviateText(value: string, maxLength: number) {
  const trimmedValue = value.trim().replace(/\s+/g, ' ');

  if (trimmedValue.length <= maxLength) {
    return trimmedValue;
  }

  return `${trimmedValue.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function sanitizeOwnerActivityDetail(
  action: OwnerActivityAction,
  detail: string | null,
) {
  if (!detail) {
    return null;
  }

  if (
    action === 'moderation-rule-created' ||
    action === 'moderation-rule-updated' ||
    action === 'moderation-rule-enabled' ||
    action === 'moderation-rule-disabled' ||
    action === 'moderation-rule-deleted' ||
    action === 'santa-settings-updated' ||
    action === 'response-template-created' ||
    action === 'response-template-updated' ||
    action === 'response-template-enabled' ||
    action === 'response-template-disabled' ||
    action === 'response-template-deleted'
  ) {
    return abbreviateText(detail, 80);
  }

  return null;
}

function getSectionFailureHeader(headers: Headers) {
  return headers.get('x-santa-test-dashboard-failure');
}

function maybeThrowSimulatedSectionFailure(
  headers: Headers,
  sectionName: string,
) {
  if (getSectionFailureHeader(headers) === sectionName) {
    throw new Error(`Simulated dashboard section failure for ${sectionName}.`);
  }
}

function logDashboardSectionError(sectionName: string, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error('[santa-commands-it]', {
    scope: 'workshop-dashboard',
    section: sectionName,
    message,
  });
}

async function loadDashboardSection<T>(
  headers: Headers,
  sectionName: string,
  loader: () => Promise<T>,
): Promise<DashboardSection<T>> {
  try {
    maybeThrowSimulatedSectionFailure(headers, sectionName);

    return {
      status: 'ready',
      data: await loader(),
    };
  } catch (error) {
    logDashboardSectionError(sectionName, error);

    return {
      status: 'unavailable',
      message: 'This section is temporarily unavailable.',
    };
  }
}

export function buildDashboardTimeWindow(
  range: WorkshopDashboardRange,
  timeZone: string,
  now: Date,
): DashboardTimeWindow {
  const config = getDashboardRangeConfig(range);
  const today = getZonedDayParts(now, timeZone);
  const tomorrow = addCalendarDays(today, 1);
  const tomorrowStart = zonedDateTimeToUtc(
    timeZone,
    tomorrow.year,
    tomorrow.month,
    tomorrow.day,
  );

  if (config.totalDays === null) {
    return {
      range,
      label: config.label,
      bucketGranularity: config.bucketGranularity,
      timeZone,
      currentStart: null,
      currentEnd: tomorrowStart,
      previousStart: null,
      previousEnd: null,
      comparisonLabel: null,
    };
  }

  const currentStartParts = addCalendarDays(today, -(config.totalDays - 1));
  const previousStartParts = addCalendarDays(
    currentStartParts,
    -config.totalDays,
  );
  const currentStart = zonedDateTimeToUtc(
    timeZone,
    currentStartParts.year,
    currentStartParts.month,
    currentStartParts.day,
  );

  return {
    range,
    label: config.label,
    bucketGranularity: config.bucketGranularity,
    timeZone,
    currentStart,
    currentEnd: tomorrowStart,
    previousStart: zonedDateTimeToUtc(
      timeZone,
      previousStartParts.year,
      previousStartParts.month,
      previousStartParts.day,
    ),
    previousEnd: currentStart,
    comparisonLabel: `vs previous ${config.label.toLowerCase()}`,
  };
}

export function buildDashboardRangeLinks(
  url: URL,
  selectedRange: WorkshopDashboardRange,
): WorkshopDashboardRangeLink[] {
  return WORKSHOP_DASHBOARD_RANGES.map((entry) => {
    const href = new URL(url.pathname, url);
    href.searchParams.set('range', entry.value);

    return {
      value: entry.value,
      label: entry.label,
      href: `${href.pathname}${href.search}`,
      active: entry.value === selectedRange,
    };
  });
}

export function buildFilledTrendPoints(
  rows: WorkshopDashboardTrendRow[],
  window: DashboardTimeWindow,
  now: Date,
): WorkshopDashboardTrendPoint[] {
  const valuesByKey = new Map(rows.map((row) => [row.bucketKey, row]));
  let bucketKeys: string[] = [];

  if (window.bucketGranularity === 'day' && window.currentStart) {
    const totalDays = getDashboardRangeConfig(window.range).totalDays ?? 0;
    const startParts = getZonedDayParts(window.currentStart, window.timeZone);

    bucketKeys = Array.from({ length: totalDays }, (_, index) =>
      buildDayKey(addCalendarDays(startParts, index)),
    );
  }

  if (window.bucketGranularity === 'month') {
    const firstKey =
      rows[0]?.bucketKey ??
      buildMonthKey(getZonedMonthParts(now, window.timeZone));
    const startParts = parseMonthKey(firstKey);
    const endParts = getZonedMonthParts(now, window.timeZone);
    const keys: string[] = [];
    let cursor = startParts;

    while (
      cursor.year < endParts.year ||
      (cursor.year === endParts.year && cursor.month <= endParts.month)
    ) {
      keys.push(buildMonthKey(cursor));
      cursor = addCalendarMonths(cursor, 1);
    }

    bucketKeys = keys;
  }

  return bucketKeys.map((bucketKey) => {
    const row = valuesByKey.get(bucketKey);

    return {
      bucketKey,
      label: formatTrendLabel(bucketKey, window.bucketGranularity),
      totalRulings: row?.totalRulings ?? 0,
      approvedRulings: row?.approvedRulings ?? 0,
      coalRulings: row?.coalRulings ?? 0,
      publicRulings: row?.publicRulings ?? 0,
      hiddenRulings: row?.hiddenRulings ?? 0,
    };
  });
}

function buildOverviewSection(
  metrics: WorkshopDashboardRulingMetrics,
  reports: WorkshopDashboardReportSummary,
  settings: {
    randomCoalEnabled: boolean;
    randomCoalPercentage: number;
    updatedAt: string;
  } | null,
  window: DashboardTimeWindow,
): WorkshopDashboardOverview {
  const comparisonLabel = window.comparisonLabel;
  const decisionBreakdown: WorkshopDashboardDecisionBreakdown = {
    totalRulings: metrics.current.totalRulings,
    approvedRulings: metrics.current.approvedRulings,
    coalRulings: metrics.current.coalRulings,
    approvedPercentage: calculatePercentage(
      metrics.current.approvedRulings,
      metrics.current.totalRulings,
    ),
    coalPercentage: calculatePercentage(
      metrics.current.coalRulings,
      metrics.current.totalRulings,
    ),
  };
  const settingsUpdatedDuringRange =
    settings &&
    window.currentStart &&
    new Date(settings.updatedAt).getTime() >= window.currentStart.getTime() &&
    new Date(settings.updatedAt).getTime() < window.currentEnd.getTime();

  return {
    primaryMetrics: [
      {
        label: 'Total rulings',
        value: metrics.current.totalRulings,
        kind: 'range',
        description: `Rulings created in the selected ${window.label.toLowerCase()}.`,
        comparison: buildMetricComparison(
          comparisonLabel ?? '',
          metrics.current.totalRulings,
          metrics.previous?.totalRulings ?? null,
        ),
      },
      {
        label: 'Approved rulings',
        value: metrics.current.approvedRulings,
        kind: 'range',
        description: 'Approved decisions created in the selected range.',
        comparison: buildMetricComparison(
          comparisonLabel ?? '',
          metrics.current.approvedRulings,
          metrics.previous?.approvedRulings ?? null,
        ),
      },
      {
        label: 'Coal rulings',
        value: metrics.current.coalRulings,
        kind: 'range',
        description: 'Coal decisions created in the selected range.',
        comparison: buildMetricComparison(
          comparisonLabel ?? '',
          metrics.current.coalRulings,
          metrics.previous?.coalRulings ?? null,
        ),
      },
      {
        label: 'Public rulings',
        value: metrics.current.publicRulings,
        kind: 'range',
        description: 'Selected-range rulings that are currently public.',
        comparison: buildMetricComparison(
          comparisonLabel ?? '',
          metrics.current.publicRulings,
          metrics.previous?.publicRulings ?? null,
        ),
      },
      {
        label: 'Hidden rulings',
        value: metrics.current.hiddenRulings,
        kind: 'range',
        description: 'Selected-range rulings that are currently hidden.',
        comparison: buildMetricComparison(
          comparisonLabel ?? '',
          metrics.current.hiddenRulings,
          metrics.previous?.hiddenRulings ?? null,
        ),
      },
      {
        label: 'Open reports',
        value: reports.currentOpenReports,
        kind: 'current',
        description: 'Current open reports across all time.',
        comparison: null,
      },
    ],
    decisionBreakdown,
    coalSummary: {
      randomCoalEnabled: settings?.randomCoalEnabled ?? false,
      configuredCoalPercentage: settings?.randomCoalEnabled
        ? settings.randomCoalPercentage
        : null,
      actualCoalPercentage: decisionBreakdown.coalPercentage,
      note:
        !settings || !settings.randomCoalEnabled
          ? 'Random coal is currently disabled.'
          : settingsUpdatedDuringRange
            ? 'The current coal setting was updated during this selected range, so the present target may not match every historical ruling in view.'
            : 'The configured coal percentage reflects the current Santa settings, while the actual coal rate reflects rulings created in this selected range.',
    },
  };
}

function buildReportsSection(
  summary: WorkshopDashboardReportSummary,
  now: Date,
): WorkshopDashboardReports {
  return {
    ...summary,
    oldestOpenReportAgeDays: summary.oldestOpenReportCreatedAt
      ? Math.max(
          0,
          Math.floor(
            (now.getTime() -
              new Date(summary.oldestOpenReportCreatedAt).getTime()) /
              (24 * 60 * 60 * 1000),
          ),
        )
      : null,
  };
}

function buildHealthCheckStatus(
  valid: boolean,
): 'healthy' | 'needs-attention' | 'unavailable' {
  return valid ? 'healthy' : 'needs-attention';
}

async function buildHealthSection(
  headers: Headers,
  timeZone: string,
): Promise<WorkshopDashboardHealth> {
  const repository = getWorkshopRepositoryForHeaders(headers);
  const configurationRepository = getConfigurationRepositoryForHeaders(headers);
  const rawSiteUrl = import.meta.env.SITE_URL ?? process.env.SITE_URL ?? '';
  const rawDatabaseUrl =
    import.meta.env.DATABASE_URL ?? process.env.DATABASE_URL ?? '';
  const rawRateLimitSecret =
    import.meta.env.RATE_LIMIT_SECRET ?? process.env.RATE_LIMIT_SECRET ?? '';
  const rawWorkshopUsername =
    import.meta.env.WORKSHOP_USERNAME ?? process.env.WORKSHOP_USERNAME ?? '';
  const rawWorkshopPasswordHash =
    import.meta.env.WORKSHOP_PASSWORD_HASH ??
    process.env.WORKSHOP_PASSWORD_HASH ??
    '';
  const rawSessionSecret =
    import.meta.env.SESSION_SECRET ?? process.env.SESSION_SECRET ?? '';
  const rawSiteTimeZone =
    import.meta.env.SITE_TIMEZONE ?? process.env.SITE_TIMEZONE ?? '';
  const isTestStoreRequest = headers.has('x-santa-test-run-id');
  const checks: WorkshopDashboardHealthCheck[] = [];

  try {
    await repository.ping();
    checks.push({
      label: 'Database connection',
      status: 'healthy',
      detail: isTestStoreRequest
        ? 'The in-memory test store is active for this request.'
        : 'The database accepted a lightweight dashboard health query.',
      href: null,
    });
  } catch {
    checks.push({
      label: 'Database connection',
      status: 'unavailable',
      detail: 'The dashboard could not confirm database availability.',
      href: null,
    });
  }

  try {
    await getRuntimeConfigurationForHeaders(headers);
    checks.push({
      label: 'Runtime moderation and templates',
      status: 'healthy',
      detail:
        'Moderation rules, Santa settings, and required active templates loaded successfully.',
      href: '/workshop/settings',
    });
  } catch (error) {
    checks.push({
      label: 'Runtime moderation and templates',
      status: 'needs-attention',
      detail:
        error instanceof Error
          ? error.message
          : 'Runtime configuration could not be loaded.',
      href: '/workshop/settings',
    });
  }

  const settings = await configurationRepository.getSantaSettings();
  checks.push({
    label: 'Santa settings',
    status: settings ? 'healthy' : 'unavailable',
    detail: settings
      ? `Current settings loaded. Random coal is ${settings.randomCoalEnabled ? 'enabled' : 'disabled'} at ${settings.randomCoalPercentage}%.`
      : 'Santa settings could not be loaded.',
    href: '/workshop/settings',
  });
  checks.push({
    label: 'Random coal percentage',
    status: settings
      ? buildHealthCheckStatus(
          settings.randomCoalPercentage >= 0 &&
            settings.randomCoalPercentage <= 100,
        )
      : 'unavailable',
    detail: settings
      ? 'The configured coal percentage is within the expected 0 to 100 range.'
      : 'The dashboard could not validate the coal percentage because settings are unavailable.',
    href: '/workshop/settings',
  });

  checks.push({
    label: 'Site URL',
    status:
      !rawSiteUrl && !isProductionEnvironment()
        ? 'healthy'
        : buildHealthCheckStatus(Boolean(getSiteUrl())),
    detail:
      rawSiteUrl || isProductionEnvironment()
        ? getSiteUrl()
          ? `SITE_URL resolves to ${getSiteUrl()}.`
          : 'SITE_URL is missing or invalid for production use.'
        : 'SITE_URL is not configured, so development falls back to the current request origin.',
    href: null,
  });

  checks.push({
    label: 'Dashboard time zone',
    status:
      rawSiteTimeZone && timeZone === 'UTC' ? 'needs-attention' : 'healthy',
    detail: rawSiteTimeZone
      ? `Dashboard grouping uses ${timeZone}.`
      : 'No SITE_TIMEZONE is configured, so dashboard grouping uses UTC.',
    href: null,
  });

  const productionEnvValuesPresent =
    Boolean(rawDatabaseUrl) &&
    rawRateLimitSecret.length >= 16 &&
    Boolean(rawWorkshopUsername.trim()) &&
    Boolean(rawWorkshopPasswordHash.trim()) &&
    rawSessionSecret.length >= 32 &&
    (!isProductionEnvironment() || Boolean(getSiteUrl()));

  checks.push({
    label: 'Required production environment',
    status:
      isProductionEnvironment() && !productionEnvValuesPresent
        ? 'needs-attention'
        : 'healthy',
    detail: productionEnvValuesPresent
      ? 'Required production environment values are configured.'
      : isProductionEnvironment()
        ? 'One or more required production environment values are missing or too short.'
        : 'Development fallbacks are allowed here, but production still requires the documented environment values.',
    href: null,
  });

  checks.push({
    label: 'Santa artwork asset',
    status: existsSync(santaArtworkPath) ? 'healthy' : 'needs-attention',
    detail: existsSync(santaArtworkPath)
      ? 'The canonical public Santa artwork exists at /images/santa-solo.png.'
      : 'The canonical Santa artwork is missing from public/images/santa-solo.png.',
    href: null,
  });

  const overallStatus = checks.some((check) => check.status === 'unavailable')
    ? 'unavailable'
    : checks.some((check) => check.status === 'needs-attention')
      ? 'needs-attention'
      : 'healthy';

  return {
    overallStatus,
    checks,
  };
}

export async function getWorkshopDashboardPageData(headers: Headers, url: URL) {
  const range = coerceWorkshopDashboardRange(url.searchParams.get('range'));
  const timeZone = getSiteTimeZone();
  const now = getRequestNow(headers);
  const window = buildDashboardTimeWindow(range, timeZone, now);
  const repository = getWorkshopRepositoryForHeaders(headers);
  const reportsRepository = getWorkshopReportsRepositoryForHeaders(headers);
  const configurationRepository = getConfigurationRepositoryForHeaders(headers);
  const rulingMetricsPromise = repository.getDashboardRulingMetrics(window);
  const reportSummaryPromise =
    reportsRepository.getDashboardReportSummary(window);
  const settingsPromise = configurationRepository.getSantaSettings();
  const moderationSummaryPromise =
    configurationRepository.getModerationDashboardSummary();
  const templateSummaryPromise =
    configurationRepository.getResponseTemplateDashboardSummary();

  const [
    overview,
    trend,
    reports,
    configuration,
    health,
    recentRulings,
    recentActivity,
  ] = await Promise.all([
    loadDashboardSection(headers, 'overview', async () =>
      buildOverviewSection(
        await rulingMetricsPromise,
        await reportSummaryPromise,
        await settingsPromise,
        window,
      ),
    ),
    loadDashboardSection(headers, 'trend', async () =>
      buildFilledTrendPoints(
        await repository.getDashboardRulingTrend(window),
        window,
        now,
      ),
    ),
    loadDashboardSection(headers, 'reports', async () =>
      buildReportsSection(await reportSummaryPromise, now),
    ),
    loadDashboardSection(headers, 'configuration', async () => ({
      moderation: await moderationSummaryPromise,
      templates: await templateSummaryPromise,
    })),
    loadDashboardSection(headers, 'health', async () =>
      buildHealthSection(headers, timeZone),
    ),
    loadDashboardSection(headers, 'recent-rulings', async () =>
      (await repository.listRecentWorkshopRulings()).map((ruling) => ({
        publicId: ruling.publicId,
        displayName: ruling.displayName,
        requestExcerpt: abbreviateText(ruling.requestText, 96),
        decision: ruling.decision,
        visibility: ruling.visibility,
        createdAt: ruling.createdAt,
        reportCount: ruling.reportCount,
        openReportCount: ruling.openReportCount,
      })),
    ),
    loadDashboardSection(headers, 'recent-activity', async () =>
      (await repository.listRecentOwnerActivity()).map((entry) => ({
        action: entry.action,
        label: getOwnerActivityLabel(entry.action),
        targetReference: entry.targetPublicId,
        detail: sanitizeOwnerActivityDetail(entry.action, entry.details),
        createdAt: entry.createdAt,
      })),
    ),
  ]);

  const warningMessages: string[] = [];

  if (health.status === 'ready' && health.data.overallStatus !== 'healthy') {
    warningMessages.push(
      'Configuration health needs attention. Review the checks below before relying on this dashboard operationally.',
    );
  }

  for (const [sectionName, section] of Object.entries({
    overview,
    trend,
    reports,
    configuration,
    health,
    recentRulings,
    recentActivity,
  })) {
    if (section.status === 'unavailable') {
      warningMessages.push(
        `${sectionName.replace(/([A-Z])/g, ' $1').toLowerCase()} is temporarily unavailable.`,
      );
    }
  }

  return {
    range,
    rangeLabel: window.label,
    rangeLinks: buildDashboardRangeLinks(url, range),
    timeZone,
    comparisonLabel: window.comparisonLabel,
    openReportCount:
      reports.status === 'ready' ? reports.data.currentOpenReports : 0,
    warningMessages,
    overview,
    trend,
    reports,
    configuration,
    health,
    recentRulings,
    recentActivity,
  } satisfies WorkshopDashboardPageData;
}
