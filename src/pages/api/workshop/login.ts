import type { APIRoute } from 'astro';

import { hashClientIdentifier } from '@/server/security/client-key';
import { isAllowedOrigin } from '@/server/security/origin';
import {
  getWorkshopSessionCookieOptions,
  performWorkshopLogin,
  sanitizeWorkshopNextPath,
  WORKSHOP_SESSION_COOKIE,
} from '@/server/workshop/auth';
import { getWorkshopAuthRepositoryForHeaders } from '@/server/workshop/test-mode';
import { getWorkshopRepositoryForHeaders } from '@/server/workshop/test-mode';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!isAllowedOrigin(request.headers.get('origin'), request.url)) {
    return redirect('/workshop/login?error=invalid');
  }

  const formData = await request.formData();
  const username = String(formData.get('username') ?? '');
  const password = String(formData.get('password') ?? '');
  const next = sanitizeWorkshopNextPath(String(formData.get('next') ?? ''));
  const allowTestFallback = request.headers.has('x-santa-test-run-id');
  const result = await performWorkshopLogin({
    username,
    password,
    clientKeyHash: hashClientIdentifier(request.headers),
    existingSessionToken: cookies.get(WORKSHOP_SESSION_COOKIE)?.value ?? null,
    allowTestFallback,
    authRepository: getWorkshopAuthRepositoryForHeaders(request.headers),
    workshopRepository: getWorkshopRepositoryForHeaders(request.headers),
  });

  if (result.status === 'invalid') {
    return redirect(
      `/workshop/login?error=invalid&next=${encodeURIComponent(next)}`,
    );
  }

  if (result.status === 'rate-limited') {
    return redirect(
      `/workshop/login?error=rate-limited&next=${encodeURIComponent(next)}`,
    );
  }

  cookies.set(
    WORKSHOP_SESSION_COOKIE,
    result.session.token,
    getWorkshopSessionCookieOptions(new Date(result.session.expiresAt)),
  );

  return redirect(next);
};
