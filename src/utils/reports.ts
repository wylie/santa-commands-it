import { isReportReason, type ReportReason } from '@/config/reports';

export type ReportedRulingResponse = {
  status: 'reported';
  message: string;
  supportingMessage?: string;
};

export type DuplicateReportResponse = {
  status: 'duplicate';
  message: string;
  supportingMessage?: string;
};

export type InvalidReportResponse = {
  status: 'invalid';
  fieldErrors: {
    reason?: string;
    note?: string;
  };
};

export type RateLimitedReportResponse = {
  status: 'rate-limited';
  message: string;
  supportingMessage?: string;
  retryAfterSeconds?: number;
};

export type NotFoundReportResponse = {
  status: 'not-found';
  message: string;
};

export type UnsupportedMediaReportResponse = {
  status: 'unsupported-media';
  message: string;
};

export type PayloadTooLargeReportResponse = {
  status: 'payload-too-large';
  message: string;
};

export type ForbiddenReportResponse = {
  status: 'forbidden';
  message: string;
};

export type ErrorReportResponse = {
  status: 'error';
  message: string;
};

export type SubmitReportResponse =
  | ReportedRulingResponse
  | DuplicateReportResponse
  | InvalidReportResponse
  | RateLimitedReportResponse
  | NotFoundReportResponse
  | UnsupportedMediaReportResponse
  | PayloadTooLargeReportResponse
  | ForbiddenReportResponse
  | ErrorReportResponse;

type ReportPayloadRecord = Record<string, unknown>;

export type ReportSubmissionPayload = {
  reason: ReportReason | '';
  note: string;
};

export function coerceReportPayload(input: unknown): ReportSubmissionPayload {
  if (typeof input !== 'object' || input === null) {
    return {
      reason: '',
      note: '',
    };
  }

  const record = input as ReportPayloadRecord;

  return {
    reason: isReportReason(record.reason) ? record.reason : '',
    note: typeof record.note === 'string' ? record.note : '',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isSubmitReportResponse(
  value: unknown,
): value is SubmitReportResponse {
  if (!isRecord(value) || typeof value.status !== 'string') {
    return false;
  }

  if (value.status === 'reported' || value.status === 'duplicate') {
    return (
      typeof value.message === 'string' &&
      (value.supportingMessage === undefined ||
        typeof value.supportingMessage === 'string')
    );
  }

  if (value.status === 'invalid') {
    return (
      isRecord(value.fieldErrors) &&
      (value.fieldErrors.reason === undefined ||
        typeof value.fieldErrors.reason === 'string') &&
      (value.fieldErrors.note === undefined ||
        typeof value.fieldErrors.note === 'string')
    );
  }

  if (
    value.status === 'rate-limited' ||
    value.status === 'not-found' ||
    value.status === 'unsupported-media' ||
    value.status === 'payload-too-large' ||
    value.status === 'forbidden' ||
    value.status === 'error'
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
