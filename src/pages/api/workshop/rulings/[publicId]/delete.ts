import type { APIRoute } from 'astro';

import {
  appendWorkshopRedirectParam,
  ensureWorkshopMutationRequest,
  requireWorkshopApiSession,
  sanitizeWorkshopNextPath,
} from '@/server/workshop/auth';
import { deleteWorkshopRuling } from '@/server/workshop/service';

export const POST: APIRoute = async (context) => {
  const session = await requireWorkshopApiSession(context);

  if (session instanceof Response) {
    return session;
  }

  const formData = await context.request.formData();
  const verification = ensureWorkshopMutationRequest(
    context.request,
    context.request.url,
    session,
    String(formData.get('csrfToken') ?? ''),
  );

  if (!verification.ok) {
    return new Response(verification.message, {
      status: verification.status,
    });
  }

  const returnTo = sanitizeWorkshopNextPath(
    String(formData.get('returnTo') ?? ''),
  );
  const result = await deleteWorkshopRuling({
    publicId: context.params.publicId ?? '',
    confirmation: String(formData.get('confirmation') ?? ''),
    headers: context.request.headers,
  });

  if (result.status === 'success') {
    const suffix = result.activityLogged ? 'deleted' : 'deleted-with-warning';
    return context.redirect(
      appendWorkshopRedirectParam(returnTo, 'status', suffix),
    );
  }

  const error =
    result.status === 'invalid-confirmation'
      ? 'invalid-confirmation'
      : 'not-found';
  return context.redirect(
    appendWorkshopRedirectParam(returnTo, 'error', error),
  );
};
