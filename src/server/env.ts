export class DatabaseConfigurationError extends Error {
  constructor(
    message = 'DATABASE_URL is required for Santa rulings persistence.',
  ) {
    super(message);
    this.name = 'DatabaseConfigurationError';
  }
}

export class RateLimitSecretConfigurationError extends Error {
  constructor(
    message = 'RATE_LIMIT_SECRET is required for production abuse protection.',
  ) {
    super(message);
    this.name = 'RateLimitSecretConfigurationError';
  }
}

export class SiteUrlConfigurationError extends Error {
  constructor(
    message = 'SITE_URL must be a valid absolute URL when it is configured.',
  ) {
    super(message);
    this.name = 'SiteUrlConfigurationError';
  }
}

export class SiteTimeZoneConfigurationError extends Error {
  constructor(
    message = 'SITE_TIMEZONE must be a valid IANA time zone when it is configured.',
  ) {
    super(message);
    this.name = 'SiteTimeZoneConfigurationError';
  }
}

export class WorkshopConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkshopConfigurationError';
  }
}

function readEnvValue(
  name:
    | 'DATABASE_URL'
    | 'SITE_URL'
    | 'SITE_TIMEZONE'
    | 'RATE_LIMIT_SECRET'
    | 'WORKSHOP_USERNAME'
    | 'WORKSHOP_PASSWORD_HASH'
    | 'SESSION_SECRET',
) {
  return import.meta.env[name] ?? process.env[name];
}

function normalizeAbsoluteUrl(value: string): string | null {
  try {
    const url = new URL(value);

    return url.origin;
  } catch {
    return null;
  }
}

export function getDatabaseUrl(): string {
  const databaseUrl = readEnvValue('DATABASE_URL');

  if (!databaseUrl) {
    throw new DatabaseConfigurationError();
  }

  return databaseUrl;
}

export function getSiteUrl(): string | null {
  const configuredSiteUrl = readEnvValue('SITE_URL');

  if (!configuredSiteUrl) {
    return null;
  }

  const normalizedSiteUrl = normalizeAbsoluteUrl(configuredSiteUrl);

  if (normalizedSiteUrl) {
    return normalizedSiteUrl;
  }

  if (isProductionEnvironment()) {
    throw new SiteUrlConfigurationError();
  }

  return null;
}

export function getSiteTimeZone(): string {
  const configuredTimeZone = readEnvValue('SITE_TIMEZONE');

  if (!configuredTimeZone) {
    return 'UTC';
  }

  try {
    Intl.DateTimeFormat(undefined, {
      timeZone: configuredTimeZone,
    }).format(new Date());

    return configuredTimeZone;
  } catch {
    if (isProductionEnvironment()) {
      throw new SiteTimeZoneConfigurationError();
    }

    return 'UTC';
  }
}

export function isProductionEnvironment(): boolean {
  return import.meta.env.PROD || process.env.NODE_ENV === 'production';
}

export function getRateLimitSecret(): string {
  const configuredSecret = readEnvValue('RATE_LIMIT_SECRET');

  if (configuredSecret && configuredSecret.length >= 16) {
    return configuredSecret;
  }

  if (isProductionEnvironment()) {
    throw new RateLimitSecretConfigurationError();
  }

  return 'local-development-rate-limit-secret-only';
}

export function isEndToEndTestMode(): boolean {
  return (
    import.meta.env.SANTA_TEST_MODE === 'e2e' ||
    process.env.SANTA_TEST_MODE === 'e2e'
  );
}

export function getWorkshopUsername(options?: {
  allowTestFallback?: boolean;
}): string {
  const value = readEnvValue('WORKSHOP_USERNAME');

  if (value && value.trim()) {
    return value.trim();
  }

  if (options?.allowTestFallback || isEndToEndTestMode()) {
    return 'owner';
  }

  throw new WorkshopConfigurationError(
    'WORKSHOP_USERNAME is required for Santa’s Workshop access.',
  );
}

export function getWorkshopPasswordHash(options?: {
  allowTestFallback?: boolean;
}): string {
  const value = readEnvValue('WORKSHOP_PASSWORD_HASH');

  if (value && value.trim()) {
    return value.trim();
  }

  if (options?.allowTestFallback || isEndToEndTestMode()) {
    return 'scrypt$16384$8$1$VQtVf9aINseCC0S28nwZhQ$hBcteqZZNeLtQi97rVc0ZEz0gtg7q7_IjeKkIfdHmc-MLk0Mx14BeKOfulFi-XFqmz7395QTMAZjyL9licsYkg';
  }

  throw new WorkshopConfigurationError(
    'WORKSHOP_PASSWORD_HASH is required for Santa’s Workshop access.',
  );
}

export function getSessionSecret(): string {
  const value = readEnvValue('SESSION_SECRET');

  if (value && value.length >= 32) {
    return value;
  }

  if (!isProductionEnvironment()) {
    return 'local-development-session-secret-for-santa-workshop-only';
  }

  throw new WorkshopConfigurationError(
    'SESSION_SECRET must be at least 32 characters in production.',
  );
}
