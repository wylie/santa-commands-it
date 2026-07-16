import { moderationRules } from '@/config/moderation';
import { REQUEST_LIMITS } from '@/config/request';
import { santaResponses } from '@/config/responses';
import { securitySettings } from '@/config/security';
import type {
  BlockedRulingResponse,
  BotRejectedResponse,
  DuplicateRulingResponse,
  InvalidRulingResponse,
  RateLimitedResponse,
  SubmitRulingResponse,
} from '@/utils/rulings';
import {
  evaluateSantaRequest,
  formatResponseTemplate,
  getBlockedField,
} from '@/utils/santa-decision';
import {
  isValidIdempotencyKey,
  normalizeForDuplicateComparison,
} from '@/utils/submission';
import { validateName, validateRequest } from '@/utils/validation';
import type { SubmissionRepository } from '@/server/submissions/repository';

export const GENERIC_ERROR_MESSAGE =
  "Santa's workshop had a small mishap. Please try again.";
export const RATE_LIMITED_MESSAGE =
  'SANTA NEEDS A MOMENT. PLEASE TRY AGAIN LATER.';
export const RATE_LIMITED_SUPPORTING_MESSAGE =
  'The workshop has received quite a few requests from here recently.';
export const DUPLICATE_SUBMISSION_MESSAGE =
  'Santa has already answered that request.';
export const BOT_REJECTED_MESSAGE = RATE_LIMITED_MESSAGE;

type SubmissionPayload = {
  name: string;
  request: string;
  website: string;
  formElapsedMs?: number;
};

export type SubmitRulingDependencies = {
  submissionRepository: SubmissionRepository;
  randomProvider: () => number;
  publicIdGenerator: () => string;
  nowProvider: () => Date;
  scenario: 'normal' | 'submit-error';
};

export type SubmitRulingRequestContext = {
  clientKeyHash: string;
  idempotencyKey: string;
};

function coerceSubmissionPayload(input: unknown): SubmissionPayload {
  if (typeof input !== 'object' || input === null) {
    return {
      name: '',
      request: '',
      website: '',
    };
  }

  const record = input as Record<string, unknown>;

  return {
    name: typeof record.name === 'string' ? record.name : '',
    request: typeof record.request === 'string' ? record.request : '',
    website: typeof record.website === 'string' ? record.website : '',
    formElapsedMs:
      typeof record.formElapsedMs === 'number' &&
      Number.isFinite(record.formElapsedMs)
        ? record.formElapsedMs
        : undefined,
  };
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

function buildRateLimitedResponse(
  retryAfterSeconds: number,
): RateLimitedResponse {
  return {
    status: 'rate-limited',
    message: RATE_LIMITED_MESSAGE,
    supportingMessage: RATE_LIMITED_SUPPORTING_MESSAGE,
    retryAfterSeconds,
  };
}

function buildBotRejectedResponse(): BotRejectedResponse {
  return {
    status: 'bot-rejected',
    message: BOT_REJECTED_MESSAGE,
  };
}

function getPersistedDecisionResponse(
  decision: Extract<
    ReturnType<typeof evaluateSantaRequest>,
    { type: 'approved' | 'random-coal' }
  >,
): string {
  const template = decision.response.supporting ?? decision.response.title;

  return formatResponseTemplate(template, {
    name: decision.name,
    request: decision.request,
  });
}

async function getRateLimitResponse(
  clientKeyHash: string,
  repository: SubmissionRepository,
  now: Date,
): Promise<RateLimitedResponse | null> {
  const shortWindowStart = new Date(
    now.getTime() -
      securitySettings.submissions.rateLimits.shortWindow.windowMs,
  );
  const dailyWindowStart = new Date(
    now.getTime() -
      securitySettings.submissions.rateLimits.dailyWindow.windowMs,
  );

  const [shortWindowCount, dailyWindowCount] = await Promise.all([
    repository.countSubmissionAttemptsSince(clientKeyHash, shortWindowStart),
    repository.countSubmissionAttemptsSince(clientKeyHash, dailyWindowStart),
  ]);

  if (
    shortWindowCount >=
    securitySettings.submissions.rateLimits.shortWindow.maxAttempts
  ) {
    return buildRateLimitedResponse(
      Math.ceil(
        securitySettings.submissions.rateLimits.shortWindow.windowMs / 1000,
      ),
    );
  }

  if (
    dailyWindowCount >=
    securitySettings.submissions.rateLimits.dailyWindow.maxAttempts
  ) {
    return buildRateLimitedResponse(
      Math.ceil(
        securitySettings.submissions.rateLimits.dailyWindow.windowMs / 1000,
      ),
    );
  }

  return null;
}

export async function submitSantaRequest(
  input: unknown,
  context: SubmitRulingRequestContext,
  dependencies: SubmitRulingDependencies,
): Promise<SubmitRulingResponse> {
  if (dependencies.scenario === 'submit-error') {
    throw new Error('Simulated test submission failure.');
  }

  if (
    !isValidIdempotencyKey(
      context.idempotencyKey,
      securitySettings.submissions.idempotency.maxKeyLength,
    )
  ) {
    return {
      status: 'invalid',
      fieldErrors: {
        name: undefined,
        request: 'Santa could not accept that request. Please try again.',
      },
    };
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

  if (payload.website.trim()) {
    return buildBotRejectedResponse();
  }

  if (
    typeof payload.formElapsedMs === 'number' &&
    payload.formElapsedMs < securitySettings.submissions.minimumCompletionTimeMs
  ) {
    return buildBotRejectedResponse();
  }

  const now = dependencies.nowProvider();
  const existingRuling =
    await dependencies.submissionRepository.getRulingByIdempotencyKey(
      context.clientKeyHash,
      context.idempotencyKey,
      now,
    );

  if (existingRuling) {
    const duplicateResponse: DuplicateRulingResponse = {
      status: 'duplicate',
      ruling: existingRuling,
      message: DUPLICATE_SUBMISSION_MESSAGE,
    };

    return duplicateResponse;
  }

  const normalizedName = normalizeForDuplicateComparison(validatedName.value);
  const normalizedRequest = normalizeForDuplicateComparison(
    validatedRequest.value,
  );
  const duplicateWindowStart = new Date(
    now.getTime() - securitySettings.submissions.duplicateWindowMs,
  );
  const duplicateRuling =
    await dependencies.submissionRepository.findDuplicateRuling(
      context.clientKeyHash,
      normalizedName,
      normalizedRequest,
      duplicateWindowStart,
    );

  if (duplicateRuling) {
    return {
      status: 'duplicate',
      ruling: duplicateRuling,
      message: DUPLICATE_SUBMISSION_MESSAGE,
    };
  }

  const rateLimitedResponse = await getRateLimitResponse(
    context.clientKeyHash,
    dependencies.submissionRepository,
    now,
  );

  if (rateLimitedResponse) {
    return rateLimitedResponse;
  }

  await dependencies.submissionRepository.recordSubmissionAttempt(
    context.clientKeyHash,
  );

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

  let createdRuling;

  try {
    createdRuling =
      await dependencies.submissionRepository.createRulingWithIdempotency({
        publicId: dependencies.publicIdGenerator(),
        displayName: decision.name,
        requestText: decision.request,
        decision: decision.type,
        santaResponse: getPersistedDecisionResponse(decision),
        clientKeyHash: context.clientKeyHash,
        idempotencyKey: context.idempotencyKey,
        normalizedName,
        normalizedRequest,
        expiresAt: new Date(
          now.getTime() + securitySettings.submissions.idempotency.retentionMs,
        ),
      });
  } catch {
    const replayedRuling =
      await dependencies.submissionRepository.getRulingByIdempotencyKey(
        context.clientKeyHash,
        context.idempotencyKey,
        now,
      );

    if (replayedRuling) {
      return {
        status: 'duplicate',
        ruling: replayedRuling,
        message: DUPLICATE_SUBMISSION_MESSAGE,
      };
    }

    throw new Error('Unable to persist ruling submission.');
  }

  return {
    status: 'created',
    ruling: createdRuling,
  };
}
