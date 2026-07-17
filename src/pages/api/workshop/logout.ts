import type { APIRoute } from 'astro';

import {
  destroyWorkshopSession,
  ensureWorkshopMutationRequest,
  getWorkshopSessionCookieOptions,
  requireWorkshopApiSession,
  WORKSHOP_SESSION_COOKIE,
} from '@/server/workshop/auth';
import { getWorkshopAuthRepositoryForHeaders } from '@/server/workshop/test-mode';
import { getWorkshopRepositoryForHeaders } from '@/server/workshop/test-mode';

export const POST: APIRoute = async (context) => {
  const session = await requireWorkshopApiSession(context);

  if (session instanceof Response) {
    return context.redirect('/workshop/login?error=expired');
  }

  const formData = await context.request.formData();
  const verification = ensureWorkshopMutationRequest(
    context.request,
    context.request.url,
    session,
    String(formData.get('csrfToken') ?? ''),
  );

  if (!verification.ok) {
    return context.redirect('/workshop/login?error=expired');
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

  return context.redirect('/workshop/login?status=logged-out');
};
