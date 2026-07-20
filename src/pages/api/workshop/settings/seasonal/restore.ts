import type { APIRoute } from 'astro';

import {
  appendWorkshopRedirectParam,
  ensureWorkshopMutationRequest,
  requireWorkshopApiSession,
  sanitizeWorkshopNextPath,
} from '@/server/workshop/auth';
import { parseWorkshopFormRequest } from '@/server/workshop/forms';
import { restoreWorkshopSeasonalSettings } from '@/server/config/service';

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

  if (String(parsedForm.formData.get('restoreConfirm') ?? '') !== 'RESTORE') {
    return context.redirect(
      appendWorkshopRedirectParam(returnTo, 'error', 'restore-confirm'),
    );
  }

  const result = await restoreWorkshopSeasonalSettings({
    expectedVersion: String(parsedForm.formData.get('expectedVersion') ?? ''),
    headers: context.request.headers,
  });

  if (result.status === 'success') {
    const suffix = result.activityLogged ? 'restored' : 'restored-with-warning';
    return context.redirect(
      appendWorkshopRedirectParam(returnTo, 'status', suffix),
    );
  }

  return context.redirect(
    appendWorkshopRedirectParam(
      returnTo,
      'error',
      result.status === 'conflict' ? 'conflict' : 'not-found',
    ),
  );
};
