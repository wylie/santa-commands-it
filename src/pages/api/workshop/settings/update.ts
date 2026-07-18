import type { APIRoute } from 'astro';

import {
  appendWorkshopRedirectParam,
  ensureWorkshopMutationRequest,
  requireWorkshopApiSession,
  sanitizeWorkshopNextPath,
} from '@/server/workshop/auth';
import { parseWorkshopFormRequest } from '@/server/workshop/forms';
import { updateWorkshopSantaSettings } from '@/server/config/service';

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
    String(parsedForm.formData.get('returnTo') ?? '/workshop/settings'),
  );
  const result = await updateWorkshopSantaSettings({
    expectedVersion: String(parsedForm.formData.get('expectedVersion') ?? ''),
    randomCoalEnabled:
      String(parsedForm.formData.get('randomCoalEnabled') ?? '') === 'true',
    randomCoalPercentage: String(
      parsedForm.formData.get('randomCoalPercentage') ?? '',
    ),
    headers: context.request.headers,
  });

  if (result.status === 'success') {
    const suffix = result.activityLogged ? 'saved' : 'saved-with-warning';
    return context.redirect(
      appendWorkshopRedirectParam(returnTo, 'status', suffix),
    );
  }

  const error =
    result.status === 'conflict'
      ? 'conflict'
      : result.status === 'not-found'
        ? 'not-found'
        : 'invalid-percentage';

  return context.redirect(
    appendWorkshopRedirectParam(returnTo, 'error', error),
  );
};
