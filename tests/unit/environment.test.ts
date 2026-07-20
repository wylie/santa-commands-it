import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('server environment helpers', () => {
  it('throws when DATABASE_URL is missing', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const { getDatabaseUrl } = await import('@/server/env');

    expect(() => getDatabaseUrl()).toThrow(
      'DATABASE_URL is required for Santa rulings persistence.',
    );
  });

  it('throws when DATABASE_URL is not a valid postgres connection string', async () => {
    vi.stubEnv('DATABASE_URL', 'not-a-database-url');
    const { getDatabaseUrl } = await import('@/server/env');

    expect(() => getDatabaseUrl()).toThrow(
      'DATABASE_URL must be a valid postgres connection string.',
    );
  });

  it('normalizes a valid SITE_URL to its origin', async () => {
    vi.stubEnv('SITE_URL', 'https://example.com/path?query=yes');
    const { getSiteUrl } = await import('@/server/env');

    expect(getSiteUrl()).toBe('https://example.com');
  });

  it('returns null for an invalid SITE_URL during development', async () => {
    vi.stubEnv('SITE_URL', 'not-a-url');
    vi.stubEnv('NODE_ENV', 'development');
    const { getSiteUrl } = await import('@/server/env');

    expect(getSiteUrl()).toBeNull();
  });

  it('returns the configured SITE_TIMEZONE when it is valid', async () => {
    vi.stubEnv('SITE_TIMEZONE', 'America/New_York');
    const { getSiteTimeZone } = await import('@/server/env');

    expect(getSiteTimeZone()).toBe('America/New_York');
  });

  it('falls back to UTC for an invalid SITE_TIMEZONE during development', async () => {
    vi.stubEnv('SITE_TIMEZONE', 'Mars/Olympus');
    vi.stubEnv('NODE_ENV', 'development');
    const { getSiteTimeZone } = await import('@/server/env');

    expect(getSiteTimeZone()).toBe('UTC');
  });

  it('returns the documented local fallback secret in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('RATE_LIMIT_SECRET', '');
    const { getRateLimitSecret } = await import('@/server/env');

    expect(getRateLimitSecret()).toBe(
      'local-development-rate-limit-secret-only',
    );
  });
});
