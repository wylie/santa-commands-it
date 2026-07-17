import { afterEach, describe, expect, it, vi } from 'vitest';

import { securitySettings } from '@/config/security';
import {
  ensureWorkshopMutationRequest,
  getWorkshopSessionCookieOptions,
  performWorkshopLogin,
} from '@/server/workshop/auth';
import {
  createTestWorkshopAuthRepository,
  createTestWorkshopRepository,
} from '@/server/workshop/repository';

const TEST_PASSWORD_HASH =
  'scrypt$16384$8$1$VQtVf9aINseCC0S28nwZhQ$hBcteqZZNeLtQi97rVc0ZEz0gtg7q7_IjeKkIfdHmc-MLk0Mx14BeKOfulFi-XFqmz7395QTMAZjyL9licsYkg';

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubWorkshopEnv() {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('WORKSHOP_USERNAME', 'owner');
  vi.stubEnv('WORKSHOP_PASSWORD_HASH', TEST_PASSWORD_HASH);
  vi.stubEnv('SESSION_SECRET', 'development-session-secret-for-tests-only');
}

describe('workshop authentication', () => {
  it('creates a valid owner session for correct credentials', async () => {
    stubWorkshopEnv();
    const authRepository = createTestWorkshopAuthRepository('auth-success');
    const workshopRepository = createTestWorkshopRepository('auth-success');

    const result = await performWorkshopLogin({
      username: 'owner',
      password: 'northpole-sleigh',
      clientKeyHash: 'client-a',
      authRepository,
      workshopRepository,
      now: new Date('2026-07-17T12:00:00.000Z'),
    });

    expect(result.status).toBe('success');
    if (result.status !== 'success') {
      return;
    }

    expect(result.session.token).toBeTruthy();
    expect(result.session.csrfToken).toBeTruthy();
    expect(
      await authRepository.getSession(
        result.session.tokenHash,
        new Date('2026-07-17T12:01:00.000Z'),
      ),
    ).not.toBeNull();
  });

  it('returns a generic invalid-credentials response and records the failure', async () => {
    stubWorkshopEnv();
    const authRepository = createTestWorkshopAuthRepository('auth-invalid');
    const workshopRepository = createTestWorkshopRepository('auth-invalid');

    const result = await performWorkshopLogin({
      username: 'owner',
      password: 'wrong-password',
      clientKeyHash: 'client-a',
      authRepository,
      workshopRepository,
      now: new Date('2026-07-17T12:00:00.000Z'),
    });

    expect(result).toEqual({
      status: 'invalid',
      message: securitySettings.workshop.auth.failedLoginMessage,
    });
    expect(
      await authRepository.countFailedLoginAttemptsSince(
        'client-a',
        new Date('2026-07-17T11:45:00.000Z'),
      ),
    ).toBe(1);
  });

  it('rate-limits repeated failed login attempts for the same client', async () => {
    stubWorkshopEnv();
    const authRepository = createTestWorkshopAuthRepository('auth-rate-limit');
    const workshopRepository = createTestWorkshopRepository('auth-rate-limit');

    for (
      let attempt = 0;
      attempt < securitySettings.workshop.auth.loginRateLimit.maxAttempts;
      attempt += 1
    ) {
      await authRepository.recordLoginAttempt('client-a', false);
    }

    const result = await performWorkshopLogin({
      username: 'owner',
      password: 'northpole-sleigh',
      clientKeyHash: 'client-a',
      authRepository,
      workshopRepository,
      now: new Date('2026-07-17T12:00:00.000Z'),
    });

    expect(result).toEqual({
      status: 'rate-limited',
      message: securitySettings.workshop.auth.rateLimitMessage,
    });
  });
});

describe('workshop session hardening', () => {
  it('uses a server-only cookie shape for workshop sessions', () => {
    const options = getWorkshopSessionCookieOptions(
      new Date('2026-07-18T00:00:00.000Z'),
    );

    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: false,
    });
  });

  it('rejects invalid CSRF tokens on same-origin mutations', () => {
    const verification = ensureWorkshopMutationRequest(
      new Request('http://127.0.0.1:4321/api/workshop/logout', {
        method: 'POST',
        headers: {
          origin: 'http://127.0.0.1:4321',
        },
      }),
      'http://127.0.0.1:4321/api/workshop/logout',
      {
        token: 'token',
        tokenHash: 'hash',
        csrfToken: 'csrf-token',
        expiresAt: '2026-07-17T12:00:00.000Z',
      },
      'wrong-token',
    );

    expect(verification).toEqual({
      ok: false,
      status: 403,
      message: 'Workshop access is not available for that request.',
    });
  });
});
