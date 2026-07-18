import type { APIRoute } from 'astro';

import { methodNotAllowed } from '@/server/api/responses';
import {
  buildWorkshopLoginPath,
  destroyWorkshopSession,
  ensureWorkshopMutationRequest,
  getWorkshopSessionCookieOptions,
  requireWorkshopApiSession,
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

export const POST: APIRoute = async (context) => {
  const session = await requireWorkshopApiSession(context);

  if (session instanceof Response) {
    return redirectSeeOther(
      context.redirect,
      buildWorkshopLoginPath({ error: 'expired' }),
    );
  }

  const formData = await context.request.formData();
  const verification = ensureWorkshopMutationRequest(
    context.request,
    context.request.url,
    session,
    String(formData.get('csrfToken') ?? ''),
  );

  if (!verification.ok) {
    return redirectSeeOther(
      context.redirect,
      buildWorkshopLoginPath({ error: 'expired' }),
    );
  }

  await destroyWorkshopSession({
    session,
    authRepository: getWorkshopAuthRepositoryForHeaders(
      context.request.headers,
    ),
    workshopRepository: getWorkshopRepositoryForHeaders(
      context.request.headers,
    ),
  });
  context.cookies.delete(
    WORKSHOP_SESSION_COOKIE,
    getWorkshopSessionCookieOptions(),
  );

  return redirectSeeOther(
    context.redirect,
    buildWorkshopLoginPath({ status: 'logged-out' }),
  );
};

export const ALL: APIRoute = async () => methodNotAllowed('POST');
