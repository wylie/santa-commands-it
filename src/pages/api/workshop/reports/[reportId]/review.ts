import type { APIRoute } from 'astro';

import {
  appendWorkshopRedirectParam,
  ensureWorkshopMutationRequest,
  requireWorkshopApiSession,
  sanitizeWorkshopNextPath,
} from '@/server/workshop/auth';
import { transitionWorkshopReport } from '@/server/workshop/service';

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
  const result = await transitionWorkshopReport({
    publicId: context.params.reportId ?? '',
    action: 'review',
    headers: context.request.headers,
  });

  if (result.status === 'success') {
    return context.redirect(
      appendWorkshopRedirectParam(
        returnTo,
        'status',
        result.activityLogged ? 'reviewed' : 'reviewed-with-warning',
      ),
    );
  }

  return context.redirect(
    appendWorkshopRedirectParam(returnTo, 'error', result.status),
  );
};
