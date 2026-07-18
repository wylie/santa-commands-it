import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createTestWorkshopAuthRepository,
  createTestWorkshopRepository,
} from '@/server/workshop/repository';

type CookieSetCall = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

function createCookies(existing: Record<string, string> = {}) {
  const values = new Map(Object.entries(existing));
  const setCalls: CookieSetCall[] = [];
  const deleteCalls: Array<{
    name: string;
    options?: Record<string, unknown>;
  }> = [];

  return {
    setCalls,
    deleteCalls,
    get(name: string) {
      const value = values.get(name);

      return value === undefined ? undefined : { value };
    },
    set(name: string, value: string, options: Record<string, unknown>) {
      values.set(name, value);
      setCalls.push({ name, value, options });
    },
    delete(name: string, options?: Record<string, unknown>) {
      values.delete(name);
      deleteCalls.push({ name, options });
    },
  };
}

function createRedirect() {
  return (path: string, status = 302) =>
    new Response(null, {
      status,
      headers: {
        Location: path,
      },
    });
}

function createFormRequest(
  url: string,
  data: Record<string, string>,
  options?: {
    headers?: Record<string, string>;
    method?: string;
  },
) {
  const method = options?.method ?? 'POST';
  const headers = new Headers(options?.headers);

  if (method === 'POST') {
    headers.set('content-type', 'application/x-www-form-urlencoded');
  }

  return new Request(url, {
    method,
    headers,
    body: method === 'POST' ? new URLSearchParams(data).toString() : undefined,
  });
}

async function loadLoginRoute(runId = `login-route-${crypto.randomUUID()}`) {
  vi.resetModules();
  const authRepository = createTestWorkshopAuthRepository(runId);
  const workshopRepository = createTestWorkshopRepository(runId);

  vi.doMock('@/server/workshop/test-mode', () => ({
    getWorkshopAuthRepositoryForHeaders: () => authRepository,
    getWorkshopRepositoryForHeaders: () => workshopRepository,
  }));
  vi.doMock('@/server/security/client-key', () => ({
    hashClientIdentifier: () => 'client-a',
  }));

  const route = await import('@/pages/api/workshop/login');

  return {
    route,
    authRepository,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.doUnmock('@/server/workshop/test-mode');
  vi.doUnmock('@/server/security/client-key');
});

describe('workshop login route', () => {
  it('redirects GET requests back to the login page instead of leaving the browser on the API URL', async () => {
    const { route } = await loadLoginRoute();
    const response = await route.GET?.({
      request: createFormRequest(
        'http://127.0.0.1:4321/api/workshop/login?next=%2Fworkshop%2Freports',
        {},
        {
          method: 'GET',
        },
      ),
      redirect: createRedirect(),
    } as never);

    expect(response?.status).toBe(303);
    expect(response?.headers.get('location')).toBe(
      '/workshop/login?next=%2Fworkshop%2Freports',
    );
  });

  it('returns 303, sets a session cookie, and redirects valid credentials to /workshop', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv(
      'SESSION_SECRET',
      'production-session-secret-for-valid-login-test-1234567890',
    );
    const { route } = await loadLoginRoute();
    const cookies = createCookies();
    const response = await route.POST({
      request: createFormRequest(
        'https://santa-commands-it.vercel.app/api/workshop/login',
        {
          username: 'owner',
          password: 'northpole-sleigh',
          next: '/workshop',
        },
        {
          headers: {
            origin: 'https://santa-commands-it.vercel.app',
            'x-santa-test-run-id': 'login-valid',
          },
        },
      ),
      cookies,
      redirect: createRedirect(),
    } as never);

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/workshop');
    expect(cookies.setCalls).toHaveLength(1);
    expect(cookies.setCalls[0]).toMatchObject({
      name: 'workshop_session',
      options: expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/',
      }),
    });
    expect(cookies.setCalls[0]?.value).not.toBe('northpole-sleigh');
  });

  it('accepts a valid internal workshop return path after successful login', async () => {
    const { route } = await loadLoginRoute();
    const response = await route.POST({
      request: createFormRequest(
        'http://127.0.0.1:4321/api/workshop/login',
        {
          username: 'owner',
          password: 'northpole-sleigh',
          next: '/workshop/reports?status=open',
        },
        {
          headers: {
            origin: 'http://127.0.0.1:4321',
            'x-santa-test-run-id': 'login-next',
          },
        },
      ),
      cookies: createCookies(),
      redirect: createRedirect(),
    } as never);

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      '/workshop/reports?status=open',
    );
  });

  it('rejects external return urls and falls back to /workshop', async () => {
    const { route } = await loadLoginRoute();
    const response = await route.POST({
      request: createFormRequest(
        'http://127.0.0.1:4321/api/workshop/login',
        {
          username: 'owner',
          password: 'northpole-sleigh',
          next: 'https://evil.example/outside',
        },
        {
          headers: {
            origin: 'http://127.0.0.1:4321',
            'x-santa-test-run-id': 'login-next-reject',
          },
        },
      ),
      cookies: createCookies(),
      redirect: createRedirect(),
    } as never);

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/workshop');
  });

  it('returns 303 to /workshop/login?error=credentials for invalid credentials without exposing secrets', async () => {
    const { route } = await loadLoginRoute();
    const response = await route.POST({
      request: createFormRequest(
        'http://127.0.0.1:4321/api/workshop/login',
        {
          username: 'owner',
          password: 'wrong-password',
          next: '/workshop',
        },
        {
          headers: {
            origin: 'http://127.0.0.1:4321',
            'x-santa-test-run-id': 'login-invalid',
          },
        },
      ),
      cookies: createCookies(),
      redirect: createRedirect(),
    } as never);

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      '/workshop/login?error=credentials',
    );
    expect(response.headers.get('location')).not.toContain('owner');
    expect(response.headers.get('location')).not.toContain('wrong-password');
  });

  it('keeps login rate limiting active through the route', async () => {
    const { route } = await loadLoginRoute('login-rate-limit');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await route.POST({
        request: createFormRequest(
          'http://127.0.0.1:4321/api/workshop/login',
          {
            username: 'owner',
            password: 'wrong-password',
            next: '/workshop',
          },
          {
            headers: {
              origin: 'http://127.0.0.1:4321',
              'x-santa-test-run-id': 'login-rate-limit',
            },
          },
        ),
        cookies: createCookies(),
        redirect: createRedirect(),
      } as never);

      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe(
        '/workshop/login?error=credentials',
      );
    }

    const response = await route.POST({
      request: createFormRequest(
        'http://127.0.0.1:4321/api/workshop/login',
        {
          username: 'owner',
          password: 'wrong-password',
          next: '/workshop',
        },
        {
          headers: {
            origin: 'http://127.0.0.1:4321',
            'x-santa-test-run-id': 'login-rate-limit',
          },
        },
      ),
      cookies: createCookies(),
      redirect: createRedirect(),
    } as never);

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      '/workshop/login?error=rate-limited',
    );
  });

  it('redirects foreign-origin login attempts back to the safe login page', async () => {
    const { route } = await loadLoginRoute();
    const response = await route.POST({
      request: createFormRequest(
        'https://santa-commands-it.vercel.app/api/workshop/login',
        {
          username: 'owner',
          password: 'northpole-sleigh',
          next: '/workshop',
        },
        {
          headers: {
            origin: 'https://evil.example',
            'x-santa-test-run-id': 'login-origin-reject',
          },
        },
      ),
      cookies: createCookies(),
      redirect: createRedirect(),
    } as never);

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      '/workshop/login?error=unavailable',
    );
  });

  it('maps broken production configuration to a safe unavailable redirect instead of leaving the browser on the API route', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('WORKSHOP_USERNAME', 'owner');
    vi.stubEnv('WORKSHOP_PASSWORD_HASH', '');
    vi.stubEnv(
      'SESSION_SECRET',
      'production-session-secret-for-tests-only-1234567890',
    );
    vi.stubEnv('RATE_LIMIT_SECRET', 'production-rate-limit-secret');
    const { route } = await loadLoginRoute();
    const response = await route.POST({
      request: createFormRequest(
        'https://santa-commands-it.vercel.app/api/workshop/login',
        {
          username: 'owner',
          password: 'northpole-sleigh',
          next: '/workshop',
        },
        {
          headers: {
            origin: 'https://santa-commands-it.vercel.app',
          },
        },
      ),
      cookies: createCookies(),
      redirect: createRedirect(),
    } as never);

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      '/workshop/login?error=unavailable',
    );
    expect(response.headers.get('location')).not.toContain(
      'WORKSHOP_PASSWORD_HASH',
    );
    expect(response.headers.get('location')).not.toContain('northpole-sleigh');
  });
});
