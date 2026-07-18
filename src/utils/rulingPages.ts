import {
  RULING_SHARE_IMAGE_HEIGHT,
  RULING_SHARE_IMAGE_TYPE,
  RULING_SHARE_IMAGE_WIDTH,
} from '@/config/share-images';
import type { PublicRuling } from '@/utils/rulings';

const PUBLIC_RULING_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_METADATA_LENGTH = 160;

function normalizeTextForMetadata(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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
  const characters = Array.from(normalized);

  if (characters.length <= maxLength) {
    return normalized;
  }

  const ellipsis = '...';

  if (maxLength <= ellipsis.length) {
    return characters.slice(0, maxLength).join('');
  }

  const visibleLength = maxLength - ellipsis.length;

  return `${characters.slice(0, visibleLength).join('')}${ellipsis}`;
}

export function buildCanonicalUrl(
  path: string,
  options: {
    siteUrl?: string | URL | null;
    requestUrl?: string | URL | null;
  } = {},
): string | null {
  const origin =
    resolveUrlOrigin(options.siteUrl) ?? resolveUrlOrigin(options.requestUrl);

  if (!origin) {
    return null;
  }

  return new URL(path, origin).toString();
}

export function buildRulingPageTitle(ruling: PublicRuling): string {
  return ruling.decision === 'approved'
    ? `Santa Commands It! - ${ruling.displayName}'s Request`
    : `Coal from Santa - ${ruling.displayName}'s Request`;
}

export function buildRulingPageDescription(
  ruling: PublicRuling,
  maxLength = DEFAULT_METADATA_LENGTH,
): string {
  const requestSnippet = truncateMetadataText(ruling.requestText, 88);
  const summary =
    ruling.decision === 'approved'
      ? `${ruling.displayName} asked Santa for ${requestSnippet}. Santa approved it with "Santa Commands It!"`
      : `${ruling.displayName} asked Santa for ${requestSnippet}. Santa answered with coal.`;

  return truncateMetadataText(summary, maxLength);
}

export function buildRulingOgImageAlt(ruling: PublicRuling): string {
  return ruling.decision === 'approved'
    ? `Santa approved ${ruling.displayName}\u2019s request with "Santa Commands It!"`
    : `Santa chose coal for ${ruling.displayName}\u2019s request.`;
}

export function buildRulingSharePayload(
  ruling: PublicRuling,
  canonicalUrl: string,
): RulingSharePayload {
  const text =
    ruling.decision === 'approved'
      ? `Santa approved this request with "Santa Commands It!"`
      : 'Santa decided this request deserved coal.';

  return {
    title: buildRulingPageTitle(ruling),
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
  const canonicalUrl = buildCanonicalUrl(
    buildRulingPath(ruling.publicId),
    options,
  );
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
