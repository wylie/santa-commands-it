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

function readEnvValue(name: 'DATABASE_URL' | 'SITE_URL' | 'RATE_LIMIT_SECRET') {
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
