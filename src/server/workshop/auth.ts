import { timingSafeEqual } from 'node:crypto';

import type { APIContext, AstroCookies } from 'astro';

import { securitySettings } from '@/config/security';
import {
  getWorkshopPasswordHash,
  getWorkshopUsername,
  isProductionEnvironment,
} from '@/server/env';
import { isAllowedOrigin } from '@/server/security/origin';
import {
  type WorkshopAuthRepository,
  type WorkshopRepository,
} from '@/server/workshop/repository';
import { getWorkshopAuthRepositoryForHeaders } from '@/server/workshop/test-mode';
import {
  createOpaqueToken,
  hashWorkshopToken,
  verifyWorkshopPassword,
} from '@/server/workshop/password';

export const WORKSHOP_SESSION_COOKIE = 'workshop_session';
export const WORKSHOP_ROOT_PATH = '/workshop';
export const WORKSHOP_LOGIN_PATH = '/workshop/login';

export type WorkshopLoginErrorCode =
  'credentials' | 'rate-limited' | 'expired' | 'unavailable';

export type WorkshopSession = {
  token: string;
  tokenHash: string;
  csrfToken: string;
  expiresAt: string;
};

export type WorkshopLoginResult =
  | {
      status: 'success';
      session: WorkshopSession;
    }
  | {
      status: 'invalid';
      message: string;
    }
  | {
      status: 'rate-limited';
      message: string;
    };

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

async function recordAuthActivitySafely(
  workshopRepository: WorkshopRepository,
  action: 'login-success' | 'login-failure' | 'logout',
): Promise<void> {
  try {
    await workshopRepository.createOwnerActivity({
      action,
      targetType: 'auth',
    });
  } catch {
    // Owner activity should not block authentication state changes.
  }
}

export function getWorkshopSessionCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProductionEnvironment(),
    path: '/',
    expires: expiresAt,
  };
}

export function sanitizeWorkshopNextPath(value: string | null): string {
  if (!value || !value.startsWith('/')) {
    return WORKSHOP_ROOT_PATH;
  }

  try {
    const url = new URL(value, 'http://localhost');

    if (url.origin !== 'http://localhost') {
      return WORKSHOP_ROOT_PATH;
    }

    const pathname = url.pathname;
    const isWorkshopPath =
      pathname === WORKSHOP_ROOT_PATH ||
      pathname.startsWith(`${WORKSHOP_ROOT_PATH}/`);
    const isLoginPath =
      pathname === WORKSHOP_LOGIN_PATH ||
      pathname.startsWith(`${WORKSHOP_LOGIN_PATH}/`);

    if (!isWorkshopPath || isLoginPath) {
      return WORKSHOP_ROOT_PATH;
    }

    return `${pathname}${url.search}${url.hash}`;
  } catch {
    return WORKSHOP_ROOT_PATH;
  }
}

export function appendWorkshopRedirectParam(
  path: string,
  key: 'status' | 'error',
  value: string,
): string {
  const url = new URL(path, 'http://localhost');
  url.searchParams.set(key, value);

  return `${url.pathname}${url.search}`;
}

export function buildWorkshopLoginPath(options?: {
  error?: WorkshopLoginErrorCode;
  status?: 'logged-out';
  next?: string | null;
}): string {
  const url = new URL(WORKSHOP_LOGIN_PATH, 'http://localhost');
  const nextPath = sanitizeWorkshopNextPath(options?.next ?? null);

  if (options?.error) {
    url.searchParams.set('error', options.error);
  }

  if (options?.status) {
    url.searchParams.set('status', options.status);
  }

  if (nextPath !== WORKSHOP_ROOT_PATH) {
    url.searchParams.set('next', nextPath);
  }

  return `${url.pathname}${url.search}`;
}

export async function readWorkshopSession(
  cookies: AstroCookies,
  headers: Headers,
  now = new Date(),
): Promise<WorkshopSession | null> {
  const token = cookies.get(WORKSHOP_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const repository = getWorkshopAuthRepositoryForHeaders(headers);
  const tokenHash = hashWorkshopToken(token);
  const session = await repository.getSession(tokenHash, now);

  if (!session) {
    return null;
  }

  return {
    token,
    tokenHash,
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt,
  };
}

export async function requireWorkshopPageSession(
  context: APIContext,
): Promise<WorkshopSession | Response> {
  const session = await readWorkshopSession(
    context.cookies,
    context.request.headers,
  );

  if (session) {
    return session;
  }

  context.cookies.delete(WORKSHOP_SESSION_COOKIE, {
    path: '/',
  });

  const nextPath = `${context.url.pathname}${context.url.search}`;
  return context.redirect(buildWorkshopLoginPath({ next: nextPath }));
}

export async function requireWorkshopApiSession(
  context: APIContext,
): Promise<WorkshopSession | Response> {
  const session = await readWorkshopSession(
    context.cookies,
    context.request.headers,
  );

  if (session) {
    return session;
  }

  context.cookies.delete(WORKSHOP_SESSION_COOKIE, {
    path: '/',
  });

  return new Response(
    JSON.stringify({
      status: 'unauthorized',
      message: 'Workshop authorization is required.',
    }),
    {
      status: 401,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
    },
  );
}

export async function performWorkshopLogin(input: {
  username: string;
  password: string;
  clientKeyHash: string;
  existingSessionToken?: string | null;
  allowTestFallback?: boolean;
  authRepository: WorkshopAuthRepository;
  workshopRepository: WorkshopRepository;
  now?: Date;
}): Promise<WorkshopLoginResult> {
  const now = input.now ?? new Date();
  const rateLimitWindowStart = new Date(
    now.getTime() - securitySettings.workshop.auth.loginRateLimit.windowMs,
  );
  const recentFailures =
    await input.authRepository.countFailedLoginAttemptsSince(
      input.clientKeyHash,
      rateLimitWindowStart,
    );

  if (
    recentFailures >= securitySettings.workshop.auth.loginRateLimit.maxAttempts
  ) {
    return {
      status: 'rate-limited',
      message: securitySettings.workshop.auth.rateLimitMessage,
    };
  }

  const storedHash = getWorkshopPasswordHash({
    allowTestFallback: input.allowTestFallback,
  });
  const usernameMatches = safeEquals(
    input.username.trim(),
    getWorkshopUsername({
      allowTestFallback: input.allowTestFallback,
    }),
  );
  const passwordMatches = await verifyWorkshopPassword(
    input.password,
    storedHash,
  );

  if (!usernameMatches || !passwordMatches) {
    await input.authRepository.recordLoginAttempt(input.clientKeyHash, false);
    await recordAuthActivitySafely(input.workshopRepository, 'login-failure');

    return {
      status: 'invalid',
      message: securitySettings.workshop.auth.failedLoginMessage,
    };
  }

  await input.authRepository.clearFailedLoginAttempts(input.clientKeyHash);

  if (input.existingSessionToken) {
    await input.authRepository.deleteSession(
      hashWorkshopToken(input.existingSessionToken),
    );
  }

  const token = createOpaqueToken();
  const csrfToken = createOpaqueToken();
  const expiresAt = new Date(
    now.getTime() + securitySettings.workshop.auth.sessionDurationMs,
  );
  await input.authRepository.createSession({
    tokenHash: hashWorkshopToken(token),
    csrfToken,
    expiresAt,
  });
  await input.authRepository.recordLoginAttempt(input.clientKeyHash, true);
  await recordAuthActivitySafely(input.workshopRepository, 'login-success');

  return {
    status: 'success',
    session: {
      token,
      tokenHash: hashWorkshopToken(token),
      csrfToken,
      expiresAt: expiresAt.toISOString(),
    },
  };
}

export async function destroyWorkshopSession(input: {
  session: WorkshopSession;
  authRepository: WorkshopAuthRepository;
  workshopRepository: WorkshopRepository;
}): Promise<void> {
  await input.authRepository.deleteSession(input.session.tokenHash);
  await recordAuthActivitySafely(input.workshopRepository, 'logout');
}

export function ensureWorkshopMutationRequest(
  request: Request,
  requestUrl: string,
  session: WorkshopSession,
  csrfToken: string | null,
): { ok: true } | { ok: false; status: 403; message: string } {
  if (!isAllowedOrigin(request.headers.get('origin'), requestUrl)) {
    return {
      ok: false,
      status: 403,
      message: 'Workshop access is not available for that request.',
    };
  }

  if (!csrfToken || !safeEquals(csrfToken, session.csrfToken)) {
    return {
      ok: false,
      status: 403,
      message: 'Workshop access is not available for that request.',
    };
  }

  return {
    ok: true,
  };
}
