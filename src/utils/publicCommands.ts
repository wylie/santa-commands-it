import type { PublicRuling } from '@/utils/rulings';

export const PUBLIC_COMMANDS_PATH = '/commands';
export const PUBLIC_COMMANDS_PAGE_SIZE = 12;
export const PUBLIC_COMMANDS_MAX_PAGE = 1000;
export const PUBLIC_COMMANDS_MAX_SEARCH_LENGTH = 80;

export type PublicCommandsDecision = 'all' | 'approved' | 'coal' | 'featured';
export type PublicCommandsSort = 'newest' | 'oldest';

export type PublicCommandsQuery = {
  search: string;
  decision: PublicCommandsDecision;
  sort: PublicCommandsSort;
  page: number;
  pageSize: number;
};

export type PublicCommandsDiscoveryRuling = Pick<
  PublicRuling,
  | 'publicId'
  | 'displayName'
  | 'requestText'
  | 'decision'
  | 'santaResponse'
  | 'isFeatured'
  | 'createdAt'
>;

const WHITESPACE = /\s+/g;

function removeUnsafeControlCharacters(value: string): string {
  return Array.from(value)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;

      return (
        codePoint === 0x09 ||
        codePoint === 0x0a ||
        codePoint === 0x0d ||
        (codePoint >= 0x20 && codePoint !== 0x7f)
      );
    })
    .join('');
}

export function normalizePublicCommandsSearch(value: string): string {
  return removeUnsafeControlCharacters(value)
    .replace(WHITESPACE, ' ')
    .trim()
    .slice(0, PUBLIC_COMMANDS_MAX_SEARCH_LENGTH);
}

function parseDecision(value: string | null): PublicCommandsDecision {
  return value === 'approved' || value === 'coal' || value === 'featured'
    ? value
    : 'all';
}

function parseSort(value: string | null): PublicCommandsSort {
  return value === 'oldest' ? 'oldest' : 'newest';
}

function parsePage(value: string | null): number {
  if (!value) {
    return 1;
  }

  if (!/^\d+$/.test(value)) {
    return 1;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return 1;
  }

  return Math.min(parsed, PUBLIC_COMMANDS_MAX_PAGE);
}

export function parsePublicCommandsQuery(
  searchParams: URLSearchParams,
): PublicCommandsQuery {
  return {
    search: normalizePublicCommandsSearch(searchParams.get('q') ?? ''),
    decision: parseDecision(searchParams.get('decision')),
    sort: parseSort(searchParams.get('sort')),
    page: parsePage(searchParams.get('page')),
    pageSize: PUBLIC_COMMANDS_PAGE_SIZE,
  };
}

export function hasPublicCommandsParameters(
  searchParams: URLSearchParams,
): boolean {
  return (
    searchParams.has('q') ||
    searchParams.has('decision') ||
    searchParams.has('sort') ||
    searchParams.has('page')
  );
}

export function buildPublicCommandsPath(
  query: Partial<PublicCommandsQuery> = {},
): string {
  const params = new URLSearchParams();
  const search = normalizePublicCommandsSearch(query.search ?? '');
  const decision = query.decision ?? 'all';
  const sort = query.sort ?? 'newest';
  const page = query.page ?? 1;

  if (search) {
    params.set('q', search);
  }

  if (decision !== 'all') {
    params.set('decision', decision);
  }

  if (sort !== 'newest') {
    params.set('sort', sort);
  }

  if (page > 1) {
    params.set('page', String(Math.min(page, PUBLIC_COMMANDS_MAX_PAGE)));
  }

  const serialized = params.toString();

  return serialized
    ? `${PUBLIC_COMMANDS_PATH}?${serialized}`
    : PUBLIC_COMMANDS_PATH;
}

export function buildPublicCommandsPagePath(
  query: PublicCommandsQuery,
  page: number,
): string {
  return buildPublicCommandsPath({
    ...query,
    page,
  });
}

export function buildPublicCommandsResetPagePath(
  query: PublicCommandsQuery,
  next: Partial<PublicCommandsQuery>,
): string {
  return buildPublicCommandsPath({
    ...query,
    ...next,
    page: 1,
  });
}

export function getPublicCommandsSummary(
  total: number,
  query: PublicCommandsQuery,
): string {
  const decisionLabel =
    query.decision === 'approved'
      ? 'approved '
      : query.decision === 'coal'
        ? 'coal '
        : query.decision === 'featured'
          ? 'featured '
          : '';
  const requestLabel = total === 1 ? 'request' : 'requests';
  const matching = query.search ? ` matching "${query.search}"` : '';

  if (total === 0) {
    return `No ${decisionLabel}${requestLabel} matched${matching}.`;
  }

  return `Showing ${total} ${decisionLabel}${requestLabel}${matching}.`;
}

export function createPublicExcerpt(value: string, maxLength = 180): string {
  const normalized = value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(removeUnsafeControlCharacters)
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const segmenter =
    typeof Intl.Segmenter === 'function'
      ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
      : null;

  if (!segmenter) {
    return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
  }

  let excerpt = '';

  for (const segment of segmenter.segment(normalized)) {
    if (`${excerpt}${segment.segment}...`.length > maxLength) {
      break;
    }

    excerpt += segment.segment;
  }

  return `${excerpt.trimEnd()}...`;
}
