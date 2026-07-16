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

export function getDatabaseUrl(): string {
  const databaseUrl = import.meta.env.DATABASE_URL ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new DatabaseConfigurationError();
  }

  return databaseUrl;
}

export function getSiteUrl(): string | null {
  return import.meta.env.SITE_URL ?? process.env.SITE_URL ?? null;
}

export function isProductionEnvironment(): boolean {
  return import.meta.env.PROD || process.env.NODE_ENV === 'production';
}

export function getRateLimitSecret(): string {
  const configuredSecret =
    import.meta.env.RATE_LIMIT_SECRET ?? process.env.RATE_LIMIT_SECRET;

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
