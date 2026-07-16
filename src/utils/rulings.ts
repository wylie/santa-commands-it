import { santaSettings } from '@/config/santa-settings';

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

export type ErrorRulingResponse = {
  status: 'error';
  message: string;
};

export type SubmitRulingResponse =
  | CreatedRulingResponse
  | BlockedRulingResponse
  | InvalidRulingResponse
  | ErrorRulingResponse;

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

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: santaSettings.recentRulings.timeZone,
  }).format(date);
}

export function serializeCreatedAt(value: string | Date): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}
