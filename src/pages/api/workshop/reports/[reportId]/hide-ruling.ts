import type { APIRoute } from 'astro';

import {
  appendWorkshopRedirectParam,
  ensureWorkshopMutationRequest,
  requireWorkshopApiSession,
  sanitizeWorkshopNextPath,
} from '@/server/workshop/auth';
import { hideWorkshopRulingFromReport } from '@/server/workshop/service';

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
  const result = await hideWorkshopRulingFromReport({
    publicId: context.params.reportId ?? '',
    hideReason: String(formData.get('hideReason') ?? ''),
    resolutionNote: String(formData.get('resolutionNote') ?? ''),
    headers: context.request.headers,
  });

  if (result.status === 'success') {
    return context.redirect(
      appendWorkshopRedirectParam(
        returnTo,
        'status',
        result.activityLogged
          ? 'hidden-from-report'
          : 'hidden-from-report-with-warning',
      ),
    );
  }

  const error =
    result.status === 'invalid-hide-reason' ||
    result.status === 'invalid-note' ||
    result.status === 'already-hidden' ||
    result.status === 'transition-conflict'
      ? result.status
      : 'not-found';
  return context.redirect(
    appendWorkshopRedirectParam(returnTo, 'error', error),
  );
};
