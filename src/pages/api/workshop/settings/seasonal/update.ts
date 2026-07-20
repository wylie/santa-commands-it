import type { APIRoute } from 'astro';

import {
  appendWorkshopRedirectParam,
  ensureWorkshopMutationRequest,
  requireWorkshopApiSession,
  sanitizeWorkshopNextPath,
} from '@/server/workshop/auth';
import { parseWorkshopFormRequest } from '@/server/workshop/forms';
import { updateWorkshopSeasonalSettings } from '@/server/config/service';

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
      parsedForm.formData.get('returnTo') ?? '/workshop/settings/seasonal',
    ),
  );
  const result = await updateWorkshopSeasonalSettings({
    expectedVersion: String(parsedForm.formData.get('expectedVersion') ?? ''),
    seasonalMode: String(parsedForm.formData.get('seasonalMode') ?? ''),
    greetingEnabled:
      String(parsedForm.formData.get('greetingEnabled') ?? '') === 'true',
    greetingText: String(parsedForm.formData.get('greetingText') ?? ''),
    statusEnabled:
      String(parsedForm.formData.get('statusEnabled') ?? '') === 'true',
    statusText: String(parsedForm.formData.get('statusText') ?? ''),
    countdownEnabled:
      String(parsedForm.formData.get('countdownEnabled') ?? '') === 'true',
    countdownTargetDate: String(
      parsedForm.formData.get('countdownTargetDate') ?? '',
    ),
    countdownLabel: String(parsedForm.formData.get('countdownLabel') ?? ''),
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
        : result.status === 'invalid-greeting'
          ? 'invalid-greeting'
          : result.status === 'invalid-status'
            ? 'invalid-status'
            : 'invalid-countdown';

  return context.redirect(
    appendWorkshopRedirectParam(returnTo, 'error', error),
  );
};
