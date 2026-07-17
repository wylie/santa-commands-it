import type { APIRoute } from 'astro';

import {
  appendWorkshopRedirectParam,
  ensureWorkshopMutationRequest,
  requireWorkshopApiSession,
  sanitizeWorkshopNextPath,
} from '@/server/workshop/auth';
import { hideWorkshopRuling } from '@/server/workshop/service';

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
  const result = await hideWorkshopRuling({
    publicId: context.params.publicId ?? '',
    reason: String(formData.get('reason') ?? ''),
    headers: context.request.headers,
  });

  if (result.status === 'success') {
    const suffix = result.activityLogged ? 'hidden' : 'hidden-with-warning';
    return context.redirect(
      appendWorkshopRedirectParam(returnTo, 'status', suffix),
    );
  }

  if (result.status === 'invalid-reason') {
    return context.redirect(
      appendWorkshopRedirectParam(returnTo, 'error', 'invalid-hide-reason'),
    );
  }

  const error =
    result.status === 'already-hidden' ? 'already-hidden' : 'not-found';
  return context.redirect(
    appendWorkshopRedirectParam(returnTo, 'error', error),
  );
};
