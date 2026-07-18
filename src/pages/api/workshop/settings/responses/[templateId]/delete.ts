import type { APIRoute } from 'astro';

import {
  appendWorkshopRedirectParam,
  ensureWorkshopMutationRequest,
  requireWorkshopApiSession,
  sanitizeWorkshopNextPath,
} from '@/server/workshop/auth';
import { parseWorkshopFormRequest } from '@/server/workshop/forms';
import { deleteWorkshopResponseTemplate } from '@/server/config/service';

export const POST: APIRoute = async (context) => {
  const session = await requireWorkshopApiSession(context);

  if (session instanceof Response) {
    return session;
  }

  const parsedForm = await parseWorkshopFormRequest(context.request);

  if (!parsedForm.ok) {
    return parsedForm.response;
  }

  const verification = ensureWorkshopMutationRequest(
    context.request,
    context.request.url,
    session,
    String(parsedForm.formData.get('csrfToken') ?? ''),
  );

  if (!verification.ok) {
    return new Response(verification.message, {
      status: verification.status,
    });
  }

  const returnTo = sanitizeWorkshopNextPath(
    String(
      parsedForm.formData.get('returnTo') ?? '/workshop/settings/responses',
    ),
  );
  const result = await deleteWorkshopResponseTemplate({
    publicId: context.params.templateId ?? '',
    headers: context.request.headers,
  });

  if (result.status === 'success') {
    const suffix = result.activityLogged ? 'deleted' : 'deleted-with-warning';
    return context.redirect(
      appendWorkshopRedirectParam(returnTo, 'status', suffix),
    );
  }

  if (result.status === 'required-template-conflict') {
    return context.redirect(
      appendWorkshopRedirectParam(
        returnTo,
        'error',
        'required-template-conflict',
      ),
    );
  }

  return context.redirect(
    appendWorkshopRedirectParam(returnTo, 'error', 'not-found'),
  );
};
