import { publicSantaUiSettings } from '@/config/public-santa-ui';

export type PersistedRulingDecision = 'approved' | 'random-coal';
export type FocusField = 'name' | 'request' | 'both';

export type PublicRuling = {
  publicId: string;
  displayName: string;
  requestText: string;
  decision: PersistedRulingDecision;
  santaResponse: string;
  createdAt: string;
};

export type CreatedRulingResponse = {
  status: 'created';
  ruling: PublicRuling;
};

export type DuplicateRulingResponse = {
  status: 'duplicate';
  ruling?: PublicRuling;
  message: string;
};

export type BlockedRulingResponse = {
  status: 'blocked';
  focusField: FocusField;
  message: string;
  supportingMessage?: string;
};

export type InvalidRulingResponse = {
  status: 'invalid';
  fieldErrors: {
    name?: string;
    request?: string;
  };
};

export type RateLimitedResponse = {
  status: 'rate-limited';
  message: string;
  supportingMessage?: string;
  retryAfterSeconds?: number;
};

export type BotRejectedResponse = {
  status: 'bot-rejected';
  message: string;
};

export type UnsupportedMediaResponse = {
  status: 'unsupported-media';
  message: string;
};

export type PayloadTooLargeResponse = {
  status: 'payload-too-large';
  message: string;
};

export type ForbiddenResponse = {
  status: 'forbidden';
  message: string;
};

export type ErrorRulingResponse = {
  status: 'error';
  message: string;
};

export type SubmitRulingResponse =
  | CreatedRulingResponse
  | DuplicateRulingResponse
  | BlockedRulingResponse
  | InvalidRulingResponse
  | RateLimitedResponse
  | BotRejectedResponse
  | UnsupportedMediaResponse
  | PayloadTooLargeResponse
  | ForbiddenResponse
  | ErrorRulingResponse;

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: publicSantaUiSettings.recentRulings.timeZone,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isPersistedRulingDecision(
  value: unknown,
): value is PersistedRulingDecision {
  return value === 'approved' || value === 'random-coal';
}

export function isPublicRuling(value: unknown): value is PublicRuling {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.publicId === 'string' &&
    typeof value.displayName === 'string' &&
    typeof value.requestText === 'string' &&
    isPersistedRulingDecision(value.decision) &&
    typeof value.santaResponse === 'string' &&
    typeof value.createdAt === 'string'
  );
}

export function isSubmitRulingResponse(
  value: unknown,
): value is SubmitRulingResponse {
  if (!isRecord(value) || typeof value.status !== 'string') {
    return false;
  }

  if (value.status === 'created') {
    return isPublicRuling(value.ruling);
  }

  if (value.status === 'duplicate') {
    return (
      (value.ruling === undefined || isPublicRuling(value.ruling)) &&
      typeof value.message === 'string'
    );
  }

  if (value.status === 'blocked') {
    return (
      (value.focusField === 'name' ||
        value.focusField === 'request' ||
        value.focusField === 'both') &&
      typeof value.message === 'string' &&
      (value.supportingMessage === undefined ||
        typeof value.supportingMessage === 'string')
    );
  }

  if (value.status === 'invalid') {
    if (!isRecord(value.fieldErrors)) {
      return false;
    }

    return (
      (value.fieldErrors.name === undefined ||
        typeof value.fieldErrors.name === 'string') &&
      (value.fieldErrors.request === undefined ||
        typeof value.fieldErrors.request === 'string')
    );
  }

  if (value.status === 'error') {
    return typeof value.message === 'string';
  }

  if (
    value.status === 'rate-limited' ||
    value.status === 'bot-rejected' ||
    value.status === 'unsupported-media' ||
    value.status === 'payload-too-large' ||
    value.status === 'forbidden'
  ) {
    return (
      typeof value.message === 'string' &&
      (value.supportingMessage === undefined ||
        typeof value.supportingMessage === 'string') &&
      (value.retryAfterSeconds === undefined ||
        typeof value.retryAfterSeconds === 'number')
    );
  }

  return false;
}

export function getDecisionPanelTitle(
  decision: PersistedRulingDecision,
): string {
  return decision === 'approved' ? 'SANTA COMMANDS IT!' : 'COAL!';
}

export function getDecisionLabel(decision: PersistedRulingDecision): string {
  return decision === 'approved' ? 'SANTA COMMANDS IT' : 'COAL';
}

export function formatRulingTimestamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'an unknown workshop time';
  }

  return timestampFormatter.format(date);
}

export function serializeCreatedAt(value: string | Date): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}
