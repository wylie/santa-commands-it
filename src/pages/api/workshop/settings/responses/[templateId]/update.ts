import type { APIRoute } from 'astro';

import {
  appendWorkshopRedirectParam,
  ensureWorkshopMutationRequest,
  requireWorkshopApiSession,
  sanitizeWorkshopNextPath,
} from '@/server/workshop/auth';
import { parseWorkshopFormRequest } from '@/server/workshop/forms';
import { updateWorkshopResponseTemplate } from '@/server/config/service';

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
  const result = await updateWorkshopResponseTemplate({
    publicId: context.params.templateId ?? '',
    templateText: String(parsedForm.formData.get('templateText') ?? ''),
    active: String(parsedForm.formData.get('active') ?? '') === 'true',
    sortOrder: String(parsedForm.formData.get('sortOrder') ?? ''),
    privateNote: String(parsedForm.formData.get('privateNote') ?? ''),
    headers: context.request.headers,
  });

  if (result.status === 'success') {
    const suffix = result.activityLogged ? 'updated' : 'updated-with-warning';
    return context.redirect(
      appendWorkshopRedirectParam(returnTo, 'status', suffix),
    );
  }

  const error =
    result.status === 'required-template-conflict'
      ? 'required-template-conflict'
      : result.status === 'invalid-sort-order'
        ? 'invalid-sort-order'
        : result.status === 'invalid-note'
          ? 'invalid-note'
          : result.status === 'not-found'
            ? 'not-found'
            : 'invalid-text';

  return context.redirect(
    appendWorkshopRedirectParam(returnTo, 'error', error),
  );
};
