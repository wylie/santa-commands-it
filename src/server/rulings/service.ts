import { moderationRules } from '@/config/moderation';
import { santaResponses } from '@/config/responses';
import { REQUEST_LIMITS } from '@/config/request';
import { santaSettings } from '@/config/santa-settings';
import type {
  BlockedRulingResponse,
  CreatedRulingResponse,
  InvalidRulingResponse,
  PersistedRulingDecision,
  PublicRuling,
  SubmitRulingResponse,
} from '@/utils/rulings';
import { isValidPublicRulingId } from '@/utils/rulingPages';
import {
  evaluateSantaRequest,
  formatResponseTemplate,
  getBlockedField,
} from '@/utils/santa-decision';
import { validateName, validateRequest } from '@/utils/validation';
import type {
  CreateRulingInput,
  RulingsRepository,
} from '@/server/rulings/repository';
import {
  getRulingsRepositoryForHeaders,
  readRequestTestOptions,
} from '@/server/rulings/test-mode';

export const GENERIC_ERROR_MESSAGE =
  "Santa's workshop had a small mishap. Please try again.";
export const RECENT_RULINGS_UNAVAILABLE_MESSAGE =
  "Santa's announcement board is temporarily unavailable.";
export const RULING_LOOKUP_ERROR_MESSAGE =
  "SANTA'S WORKSHOP IS HAVING A SMALL MISHAP. Please try again in a moment.";

type SubmissionPayload = {
  name: string;
  request: string;
};

export type SubmitRulingDependencies = {
  repository: RulingsRepository;
  randomProvider: () => number;
  publicIdGenerator: () => string;
  scenario: 'normal' | 'submit-error';
};

export type RecentRulingsResult =
  | {
      status: 'ok';
      rulings: CreatedRulingResponse['ruling'][];
    }
  | {
      status: 'unavailable';
      message: string;
    };

export type PublicRulingLookupResult =
  | {
      status: 'ok';
      ruling: PublicRuling;
    }
  | {
      status: 'not-found';
    }
  | {
      status: 'unavailable';
      message: string;
    };

function coerceSubmissionPayload(input: unknown): SubmissionPayload {
  if (typeof input !== 'object' || input === null) {
    return {
      name: '',
      request: '',
    };
  }

  const record = input as Record<string, unknown>;

  return {
    name: typeof record.name === 'string' ? record.name : '',
    request: typeof record.request === 'string' ? record.request : '',
  };
}

export function buildSubmitDependencies(
  headers: Headers,
): SubmitRulingDependencies {
  const testOptions = readRequestTestOptions(headers);

  return {
    repository: getRulingsRepositoryForHeaders(headers),
    randomProvider: () => testOptions.randomValue ?? Math.random(),
    publicIdGenerator: () => crypto.randomUUID(),
    scenario:
      testOptions.scenario === 'submit-error' ? 'submit-error' : 'normal',
  };
}

export async function listRecentRulingsForHeaders(
  headers: Headers,
): Promise<RecentRulingsResult> {
  const repository = getRulingsRepositoryForHeaders(headers);
  const testOptions = readRequestTestOptions(headers);

  if (testOptions.scenario === 'recent-unavailable') {
    return {
      status: 'unavailable',
      message: RECENT_RULINGS_UNAVAILABLE_MESSAGE,
    };
  }

  try {
    const rulings = await repository.listRecentRulings(
      santaSettings.recentRulings.visibleLimit,
    );

    return {
      status: 'ok',
      rulings,
    };
  } catch {
    return {
      status: 'unavailable',
      message: RECENT_RULINGS_UNAVAILABLE_MESSAGE,
    };
  }
}

export async function getPublicRulingForHeaders(
  publicId: string,
  headers: Headers,
): Promise<PublicRulingLookupResult> {
  if (!isValidPublicRulingId(publicId)) {
    return {
      status: 'not-found',
    };
  }

  try {
    const repository = getRulingsRepositoryForHeaders(headers);
    const ruling = await repository.getRulingByPublicId(publicId);

    if (!ruling) {
      return {
        status: 'not-found',
      };
    }

    return {
      status: 'ok',
      ruling,
    };
  } catch {
    return {
      status: 'unavailable',
      message: RULING_LOOKUP_ERROR_MESSAGE,
    };
  }
}

function buildInvalidResponse(
  name: ReturnType<typeof validateName>,
  request: ReturnType<typeof validateRequest>,
): InvalidRulingResponse {
  return {
    status: 'invalid',
    fieldErrors: {
      name: name.valid ? undefined : name.error,
      request: request.valid ? undefined : request.error,
    },
  };
}

function buildBlockedResponse(
  blockedField: 'name' | 'request' | 'both',
): BlockedRulingResponse {
  const [response] = santaResponses.blocked;

  return {
    status: 'blocked',
    focusField: blockedField,
    message: response.title,
    supportingMessage: response.supporting,
  };
}

function getPersistedDecisionResponse(
  decision: Extract<
    ReturnType<typeof evaluateSantaRequest>,
    { type: PersistedRulingDecision }
  >,
): string {
  const template = decision.response.supporting ?? decision.response.title;

  return formatResponseTemplate(template, {
    name: decision.name,
    request: decision.request,
  });
}

export async function submitSantaRequest(
  input: unknown,
  dependencies: SubmitRulingDependencies,
): Promise<SubmitRulingResponse> {
  if (dependencies.scenario === 'submit-error') {
    throw new Error('Simulated test submission failure.');
  }

  const payload = coerceSubmissionPayload(input);
  const validatedName = validateName(
    payload.name,
    REQUEST_LIMITS.nameMaxLength,
  );
  const validatedRequest = validateRequest(
    payload.request,
    REQUEST_LIMITS.requestMaxLength,
  );

  if (!validatedName.valid || !validatedRequest.valid) {
    return buildInvalidResponse(validatedName, validatedRequest);
  }

  const blockedField = getBlockedField(
    validatedName.value,
    validatedRequest.value,
    moderationRules,
  );

  if (blockedField) {
    return buildBlockedResponse(blockedField);
  }

  const decision = evaluateSantaRequest({
    name: validatedName.value,
    request: validatedRequest.value,
    moderation: moderationRules,
    randomValue: dependencies.randomProvider(),
    templateValue: dependencies.randomProvider(),
  });

  if (decision.type === 'blocked') {
    throw new Error('Blocked decisions must return before persistence.');
  }

  const createdInput: CreateRulingInput = {
    publicId: dependencies.publicIdGenerator(),
    displayName: decision.name,
    requestText: decision.request,
    decision: decision.type,
    santaResponse: getPersistedDecisionResponse(decision),
  };

  const createdRuling =
    await dependencies.repository.createRuling(createdInput);

  return {
    status: 'created',
    ruling: createdRuling,
  };
}
