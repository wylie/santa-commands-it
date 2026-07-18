import type { APIRoute } from 'astro';

import { json, methodNotAllowed } from '@/server/api/responses';
import {
  ensureWorkshopMutationRequest,
  requireWorkshopApiSession,
} from '@/server/workshop/auth';
import { parseWorkshopFormRequest } from '@/server/workshop/forms';
import { runWorkshopModerationTester } from '@/server/config/service';
import {
  getModerationRuleCategoryLabel,
  getModerationRuleTypeLabel,
} from '@/utils/configuration';

function summarizeTesterField(
  label: string,
  input: {
    blocked: boolean;
    normalizedValue: string;
    matchingRule: {
      publicId: string;
      ruleType: import('@/utils/configuration').ModerationRuleType;
      category: import('@/utils/configuration').ModerationRuleCategory | null;
    } | null;
  },
) {
  if (!input.blocked || !input.matchingRule) {
    return `${label}: allowed. Normalized input: ${input.normalizedValue || '(empty)'}.`;
  }

  return `${label}: blocked by ${getModerationRuleTypeLabel(input.matchingRule.ruleType)} ${input.matchingRule.publicId}${input.matchingRule.category ? ` in ${getModerationRuleCategoryLabel(input.matchingRule.category)}` : ''}. Normalized input: ${input.normalizedValue}.`;
}

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
    return json(
      {
        status: 'forbidden',
        message: verification.message,
      },
      { status: verification.status },
    );
  }

  const result = await runWorkshopModerationTester({
    name: String(parsedForm.formData.get('name') ?? ''),
    request: String(parsedForm.formData.get('request') ?? ''),
    headers: context.request.headers,
  });

  if (result.status !== 'success') {
    return json(
      {
        status: 'invalid',
        message: result.message,
      },
      { status: 422 },
    );
  }

  return json({
    status: 'success',
    blocked: result.result.blocked,
    headline: result.result.blocked
      ? `Blocked by current active rules (${result.result.focusField ?? 'unknown field'}).`
      : 'Allowed by current active rules.',
    nameSummary: summarizeTesterField('Name', result.result.name),
    requestSummary: summarizeTesterField('Request', result.result.request),
  });
};

export const ALL: APIRoute = async () => methodNotAllowed('POST');
