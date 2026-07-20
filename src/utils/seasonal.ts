export const seasonalPresentationModes = [
  {
    value: 'standard',
    label: 'Standard',
  },
  {
    value: 'festive',
    label: 'Festive',
  },
  {
    value: 'christmas-eve',
    label: 'Christmas Eve',
  },
  {
    value: 'post-christmas',
    label: 'Post Christmas',
  },
] as const;

export type SeasonalPresentationMode =
  (typeof seasonalPresentationModes)[number]['value'];

export type RuntimeSeasonalSettings = {
  mode: SeasonalPresentationMode;
  greetingEnabled: boolean;
  greetingText: string;
  statusEnabled: boolean;
  statusText: string;
  countdownEnabled: boolean;
  countdownTargetDate: string;
  countdownLabel: string;
  version: number;
};

export type WorkshopSeasonalSettings = RuntimeSeasonalSettings & {
  updatedAt: string;
};

export type SeasonalPublicPresentation = {
  mode: SeasonalPresentationMode;
  greeting: string;
  status: string;
  countdown: {
    label: string;
    targetDate: string;
    message: string;
    state: 'future' | 'today' | 'past';
    daysRemaining: number;
  } | null;
};

type CalendarDayParts = {
  year: number;
  month: number;
  day: number;
};

export const SEASONAL_GREETING_MAX_LENGTH = 120;
export const SEASONAL_STATUS_MAX_LENGTH = 160;
export const SEASONAL_COUNTDOWN_LABEL_MAX_LENGTH = 40;
export const DEFAULT_SEASONAL_COUNTDOWN_LABEL = 'UNTIL CHRISTMAS';

export function isSeasonalPresentationMode(
  value: unknown,
): value is SeasonalPresentationMode {
  return seasonalPresentationModes.some((entry) => entry.value === value);
}

export function coerceSeasonalPresentationMode(
  value: string | null | undefined,
): SeasonalPresentationMode {
  return isSeasonalPresentationMode(value) ? value : 'standard';
}

export function getSeasonalPresentationModeLabel(
  mode: SeasonalPresentationMode,
): string {
  return (
    seasonalPresentationModes.find((entry) => entry.value === mode)?.label ??
    'Standard'
  );
}

export function normalizeSeasonalPlainText(value: string): string {
  return Array.from(value.replace(/\r\n?/g, '\n'))
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;

      return !(
        (codePoint >= 0x00 && codePoint <= 0x08) ||
        codePoint === 0x0b ||
        codePoint === 0x0c ||
        (codePoint >= 0x0e && codePoint <= 0x1f) ||
        codePoint === 0x7f
      );
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseCountdownTargetDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return '';
  }

  const trimmedValue = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return '';
  }

  const [year, month, day] = trimmedValue
    .split('-')
    .map((part) => Number.parseInt(part, 10));
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() + 1 !== month ||
    candidate.getUTCDate() !== day
  ) {
    return '';
  }

  return trimmedValue;
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

function getUtcDayNumber(parts: CalendarDayParts) {
  return Math.floor(
    Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000,
  );
}

function getCountdownEventName(label: string) {
  const normalizedLabel =
    normalizeSeasonalPlainText(label) || DEFAULT_SEASONAL_COUNTDOWN_LABEL;

  return normalizedLabel.replace(/^UNTIL\s+/i, '').trim() || 'CHRISTMAS';
}

export function buildSeasonalCountdownMessage(input: {
  targetDate: string;
  label?: string;
  timeZone: string;
  now: Date;
}): {
  label: string;
  targetDate: string;
  message: string;
  state: 'future' | 'today' | 'past';
  daysRemaining: number;
} | null {
  const targetDate = parseCountdownTargetDate(input.targetDate);

  if (!targetDate) {
    return null;
  }

  const [year, month, day] = targetDate
    .split('-')
    .map((part) => Number.parseInt(part, 10));
  const today = getZonedDayParts(input.now, input.timeZone);
  const daysRemaining =
    getUtcDayNumber({ year, month, day }) - getUtcDayNumber(today);
  const label =
    normalizeSeasonalPlainText(input.label ?? '') ||
    DEFAULT_SEASONAL_COUNTDOWN_LABEL;
  const eventName = getCountdownEventName(label).toUpperCase();

  if (daysRemaining < 0) {
    return {
      label,
      targetDate,
      message: `${eventName} HAS PASSED—SANTA IS ALREADY PREPARING FOR NEXT YEAR.`,
      state: 'past',
      daysRemaining: 0,
    };
  }

  if (daysRemaining === 0) {
    return {
      label,
      targetDate,
      message: `${eventName} IS HERE!`,
      state: 'today',
      daysRemaining: 0,
    };
  }

  return {
    label,
    targetDate,
    message: `${daysRemaining} DAY${daysRemaining === 1 ? '' : 'S'} ${label.toUpperCase()}`,
    state: 'future',
    daysRemaining,
  };
}
