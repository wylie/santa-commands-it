import {
  RULING_SHARE_IMAGE_HEIGHT,
  RULING_SHARE_IMAGE_TYPE,
  RULING_SHARE_IMAGE_WIDTH,
} from '@/config/share-images';
import type { PublicRuling } from '@/utils/rulings';

const PUBLIC_RULING_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_METADATA_LENGTH = 160;
const DEFAULT_SHARE_TEXT_LENGTH = 220;
const DEFAULT_SHARE_NAME_LENGTH = 48;

function normalizeTextForMetadata(value: string): string {
  return Array.from(value.replace(/\r\n?/g, '\n'))
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      const isUnsafeControl =
        (codePoint >= 0x00 && codePoint <= 0x08) ||
        codePoint === 0x0b ||
        codePoint === 0x0c ||
        (codePoint >= 0x0e && codePoint <= 0x1f) ||
        codePoint === 0x7f;
      const isBidirectionalControl =
        codePoint === 0x200e ||
        codePoint === 0x200f ||
        (codePoint >= 0x202a && codePoint <= 0x202e) ||
        (codePoint >= 0x2066 && codePoint <= 0x2069);

      return !isUnsafeControl && !isBidirectionalControl;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateNormalizedText(value: string, maxLength: number): string {
  const characters = Array.from(value);

  if (characters.length <= maxLength) {
    return value;
  }

  const ellipsis = '...';

  if (maxLength <= ellipsis.length) {
    return characters.slice(0, maxLength).join('');
  }

  const visibleLength = maxLength - ellipsis.length;

  return `${characters.slice(0, visibleLength).join('')}${ellipsis}`;
}

function resolveUrlOrigin(
  value: string | URL | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value.toString()).origin;
  } catch {
    return null;
  }
}

function isSafeRequestOriginFallback(origin: string): boolean {
  const { hostname } = new URL(origin);

  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.vercel.app')
  );
}

function resolveRequestFallbackOrigin(
  value: string | URL | null | undefined,
): string | null {
  const origin = resolveUrlOrigin(value);

  if (!origin || !isSafeRequestOriginFallback(origin)) {
    return null;
  }

  return origin;
}

export type RulingSharePayload = {
  title: string;
  text: string;
  url: string;
};

export type RulingSocialMetadata = {
  title: string;
  description: string;
  canonicalUrl: string | null;
  imageUrl: string | null;
  imageAlt: string;
  imageType: typeof RULING_SHARE_IMAGE_TYPE;
  imageWidth: typeof RULING_SHARE_IMAGE_WIDTH;
  imageHeight: typeof RULING_SHARE_IMAGE_HEIGHT;
  twitterCard: 'summary_large_image';
};

export function isValidPublicRulingId(value: string): boolean {
  return PUBLIC_RULING_ID_PATTERN.test(value);
}

export function buildRulingPath(publicId: string): string {
  return `/rulings/${publicId}`;
}

export function buildRulingOgImagePath(publicId: string): string {
  return `/rulings/${publicId}/og.png`;
}

export function buildWorkshopRulingSharePreviewPath(publicId: string): string {
  return `/workshop/rulings/${publicId}/share-preview`;
}

export function buildWorkshopRulingSharePreviewImagePath(
  publicId: string,
): string {
  return `/workshop/rulings/${publicId}/share-preview.png`;
}

export function truncateMetadataText(
  value: string,
  maxLength = DEFAULT_METADATA_LENGTH,
): string {
  const normalized = normalizeTextForMetadata(value);

  return truncateNormalizedText(normalized, maxLength);
}

export function buildCanonicalUrl(
  path: string,
  options: {
    siteUrl?: string | URL | null;
    requestUrl?: string | URL | null;
  } = {},
): string | null {
  const origin =
    resolveUrlOrigin(options.siteUrl) ??
    resolveRequestFallbackOrigin(options.requestUrl);

  if (!origin) {
    return null;
  }

  return new URL(path, origin).toString();
}

export function buildCanonicalRulingUrl(
  publicId: string,
  options: {
    siteUrl?: string | URL | null;
    requestUrl?: string | URL | null;
  } = {},
): string | null {
  return buildCanonicalUrl(buildRulingPath(publicId), options);
}

export function buildRulingPageTitle(ruling: PublicRuling): string {
  const displayName = truncateMetadataText(ruling.displayName, 64);

  return ruling.decision === 'approved'
    ? `Santa Commands It! - ${displayName}'s Request`
    : `Coal from Santa - ${displayName}'s Request`;
}

export function buildRulingPageDescription(
  ruling: PublicRuling,
  maxLength = DEFAULT_METADATA_LENGTH,
): string {
  const displayName = truncateMetadataText(ruling.displayName, 56);
  const requestSnippet = truncateMetadataText(ruling.requestText, 88);
  const summary =
    ruling.decision === 'approved'
      ? `${displayName} asked Santa for ${requestSnippet}. Santa approved it with "Santa Commands It!"`
      : `${displayName} asked Santa for ${requestSnippet}. Santa answered with coal.`;

  return truncateMetadataText(summary, maxLength);
}

export function buildRulingOgImageAlt(ruling: PublicRuling): string {
  const displayName = truncateMetadataText(ruling.displayName, 56);

  return ruling.decision === 'approved'
    ? `Santa approved ${displayName}\u2019s request with "Santa Commands It!"`
    : `Santa chose coal for ${displayName}\u2019s request.`;
}

export function buildRulingSharePayload(
  ruling: PublicRuling,
  canonicalUrl: string,
): RulingSharePayload {
  const title = 'Santa Commands It!';
  const displayName = truncateMetadataText(
    ruling.displayName,
    DEFAULT_SHARE_NAME_LENGTH,
  );
  const sharePrefix =
    ruling.decision === 'approved'
      ? `Santa approved ${displayName}'s request: `
      : `Santa answered ${displayName}'s request with coal: `;
  const quotePrefix = '\u201c';
  const quoteSuffix = '\u201d';
  const availableExcerptLength = Math.max(
    0,
    DEFAULT_SHARE_TEXT_LENGTH -
      Array.from(sharePrefix).length -
      Array.from(quotePrefix).length -
      Array.from(quoteSuffix).length,
  );
  const requestExcerpt = truncateNormalizedText(
    normalizeTextForMetadata(ruling.requestText),
    availableExcerptLength,
  );
  const text = `${sharePrefix}${quotePrefix}${requestExcerpt}${quoteSuffix}`;

  return {
    title,
    text,
    url: canonicalUrl,
  };
}

export function buildRulingSocialMetadata(
  ruling: PublicRuling,
  options: {
    siteUrl?: string | URL | null;
    requestUrl?: string | URL | null;
  } = {},
): RulingSocialMetadata {
  const canonicalUrl = buildCanonicalRulingUrl(ruling.publicId, options);
  const imageUrl = buildCanonicalUrl(
    buildRulingOgImagePath(ruling.publicId),
    options,
  );

  return {
    title: buildRulingPageTitle(ruling),
    description: buildRulingPageDescription(ruling),
    canonicalUrl,
    imageUrl,
    imageAlt: buildRulingOgImageAlt(ruling),
    imageType: RULING_SHARE_IMAGE_TYPE,
    imageWidth: RULING_SHARE_IMAGE_WIDTH,
    imageHeight: RULING_SHARE_IMAGE_HEIGHT,
    twitterCard: 'summary_large_image',
  };
}
