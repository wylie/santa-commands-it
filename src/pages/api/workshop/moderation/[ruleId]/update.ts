import type { APIRoute } from 'astro';

import {
  appendWorkshopRedirectParam,
  ensureWorkshopMutationRequest,
  requireWorkshopApiSession,
  sanitizeWorkshopNextPath,
} from '@/server/workshop/auth';
import { parseWorkshopFormRequest } from '@/server/workshop/forms';
import { updateWorkshopModerationRule } from '@/server/config/service';

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
      parsedForm.formData.get('returnTo') ??
        `/workshop/moderation/${context.params.ruleId ?? ''}`,
    ),
  );
  const result = await updateWorkshopModerationRule({
    publicId: context.params.ruleId ?? '',
    value: String(parsedForm.formData.get('value') ?? ''),
    category: String(parsedForm.formData.get('category') ?? ''),
    active: String(parsedForm.formData.get('active') ?? '') === 'true',
    privateNote: String(parsedForm.formData.get('privateNote') ?? ''),
    headers: context.request.headers,
  });

  if (result.status === 'success') {
    const suffix = result.activityLogged ? 'updated' : 'updated-with-warning';
    return context.redirect(
      appendWorkshopRedirectParam(returnTo, 'status', suffix),
    );
  }

  if (result.status === 'duplicate') {
    const url = new URL(returnTo, 'http://localhost');
    url.searchParams.set('error', 'duplicate');
    url.searchParams.set('existing', result.existingRule.publicId);
    return context.redirect(`${url.pathname}${url.search}`);
  }

  const error =
    result.status === 'invalid-note'
      ? 'invalid-note'
      : result.status === 'not-found'
        ? 'not-found'
        : 'invalid-value';

  return context.redirect(
    appendWorkshopRedirectParam(returnTo, 'error', error),
  );
};
