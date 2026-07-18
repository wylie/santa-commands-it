import type { APIRoute } from 'astro';

import { methodNotAllowed } from '@/server/api/responses';
import { hashClientIdentifier } from '@/server/security/client-key';
import { isAllowedOrigin } from '@/server/security/origin';
import {
  buildWorkshopLoginPath,
  getWorkshopSessionCookieOptions,
  performWorkshopLogin,
  sanitizeWorkshopNextPath,
  WORKSHOP_ROOT_PATH,
  WORKSHOP_SESSION_COOKIE,
} from '@/server/workshop/auth';
import { getWorkshopAuthRepositoryForHeaders } from '@/server/workshop/test-mode';
import { getWorkshopRepositoryForHeaders } from '@/server/workshop/test-mode';

function redirectSeeOther(
  redirect: (path: string, status?: 301 | 302 | 303 | 307 | 308) => Response,
  path: string,
): Response {
  return redirect(path, 303);
}

export const GET: APIRoute = async ({ request, redirect }) => {
  const next = sanitizeWorkshopNextPath(
    new URL(request.url).searchParams.get('next'),
  );

  return redirectSeeOther(
    redirect,
    buildWorkshopLoginPath({
      next,
    }),
  );
};

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  let next = WORKSHOP_ROOT_PATH;

  if (!isAllowedOrigin(request.headers.get('origin'), request.url)) {
    return redirectSeeOther(
      redirect,
      buildWorkshopLoginPath({
        error: 'unavailable',
      }),
    );
  }

  try {
    const formData = await request.formData();
    const username = String(formData.get('username') ?? '');
    const password = String(formData.get('password') ?? '');
    next = sanitizeWorkshopNextPath(String(formData.get('next') ?? ''));
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
      return redirectSeeOther(
        redirect,
        buildWorkshopLoginPath({
          error: 'credentials',
          next,
        }),
      );
    }

    if (result.status === 'rate-limited') {
      return redirectSeeOther(
        redirect,
        buildWorkshopLoginPath({
          error: 'rate-limited',
          next,
        }),
      );
    }

    cookies.set(
      WORKSHOP_SESSION_COOKIE,
      result.session.token,
      getWorkshopSessionCookieOptions(new Date(result.session.expiresAt)),
    );

    return redirectSeeOther(redirect, next);
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';

    console.error('[santa-commands-it] Workshop login failed.', {
      errorName,
    });

    return redirectSeeOther(
      redirect,
      buildWorkshopLoginPath({
        error: 'unavailable',
        next,
      }),
    );
  }
};

export const ALL: APIRoute = async () => methodNotAllowed('GET, POST');
