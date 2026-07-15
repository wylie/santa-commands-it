import type { ModerationRules } from '@/config/moderation';
import { santaResponses, type SantaResponseTemplate } from '@/config/responses';
import {
  assertCoalPercentage,
  assertRandomValue,
  santaSettings,
} from '@/config/santa-settings';
import { isBlockedByModeration } from '@/utils/moderation';

export type BlockedField = 'name' | 'request' | 'both';

export type SantaDecision =
  | {
      type: 'blocked';
      field: BlockedField;
      response: SantaResponseTemplate;
      name: string;
      request: string;
    }
  | {
      type: 'random-coal';
      response: SantaResponseTemplate;
      name: string;
      request: string;
    }
  | {
      type: 'approved';
      response: SantaResponseTemplate;
      name: string;
      request: string;
    };

export function formatResponseTemplate(
  template: string,
  values: { name: string; request: string },
): string {
  return template
    .replaceAll('{name}', values.name)
    .replaceAll('{request}', values.request);
}

export function selectResponseTemplate<T>(
  templates: readonly T[],
  randomValue: number,
): T {
  assertRandomValue(randomValue);

  if (!templates.length) {
    throw new Error('At least one response template is required.');
  }

  return templates[Math.floor(randomValue * templates.length)];
}

export function shouldReceiveCoal(
  percentage: number,
  randomValue: number,
  enabled = true,
): boolean {
  assertRandomValue(randomValue);
  assertCoalPercentage(percentage);

  if (!enabled || percentage === 0) {
    return false;
  }

  if (percentage === 100) {
    return true;
  }

  return randomValue < percentage / 100;
}

export function evaluateSantaRequest({
  name,
  request,
  settings = santaSettings,
  moderation,
  randomValue,
  templateValue = randomValue,
}: {
  name: string;
  request: string;
  settings?: typeof santaSettings;
  moderation: ModerationRules;
  randomValue: number;
  templateValue?: number;
}): SantaDecision {
  const blockedName = isBlockedByModeration(name, moderation);
  const blockedRequest = isBlockedByModeration(request, moderation);

  if (blockedName || blockedRequest) {
    const [response] = santaResponses.blocked;

    return {
      type: 'blocked',
      field:
        blockedName && blockedRequest
          ? 'both'
          : blockedName
            ? 'name'
            : 'request',
      response,
      name,
      request,
    };
  }

  const coal = shouldReceiveCoal(
    settings.randomCoalPercentage,
    randomValue,
    settings.randomCoalEnabled,
  );

  const templates: readonly SantaResponseTemplate[] = coal
    ? santaResponses.coal
    : santaResponses.approved;
  const response = selectResponseTemplate(templates, templateValue);

  return {
    type: coal ? 'random-coal' : 'approved',
    response,
    name,
    request,
  };
}
