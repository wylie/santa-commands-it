import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('server environment helpers', () => {
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

  it('returns the documented local fallback secret in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('RATE_LIMIT_SECRET', '');
    const { getRateLimitSecret } = await import('@/server/env');

    expect(getRateLimitSecret()).toBe(
      'local-development-rate-limit-secret-only',
    );
  });
});
