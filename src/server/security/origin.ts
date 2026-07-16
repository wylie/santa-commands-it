import { getSiteUrl } from '@/server/env';

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getAllowedOrigins(requestUrl: string): string[] {
  const configuredOrigin = getSiteUrl();
  const requestOrigin = normalizeOrigin(requestUrl);
  const allowedOrigins = new Set<string>();

  if (configuredOrigin) {
    const origin = normalizeOrigin(configuredOrigin);

    if (origin) {
      allowedOrigins.add(origin);
    }
  }

  if (requestOrigin) {
    allowedOrigins.add(requestOrigin);
  }

  return Array.from(allowedOrigins);
}

export function isAllowedOrigin(
  originHeader: string | null,
  requestUrl: string,
): boolean {
  if (!originHeader) {
    return true;
  }

  const origin = normalizeOrigin(originHeader);

  if (!origin) {
    return false;
  }

  return getAllowedOrigins(requestUrl).includes(origin);
}
