import {
  DatabaseConfigurationError,
  RateLimitSecretConfigurationError,
  SiteUrlConfigurationError,
} from '@/server/env';
import { SubmissionPersistenceError } from '@/server/submissions/service';

export type SubmissionErrorSummary = {
  statusCode: 500 | 503;
  log: {
    operation: 'submit-ruling';
    category: 'configuration' | 'dependency-unavailable' | 'unexpected';
    name: string;
    code?: string;
    detail?: string;
    causeName?: string;
    causeCode?: string;
    causeDetail?: string;
  };
};

type ErrorLike = {
  name?: unknown;
  code?: unknown;
  message?: unknown;
  cause?: unknown;
  table?: unknown;
  column?: unknown;
};

function asErrorLike(value: unknown): ErrorLike | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as ErrorLike;
}

function getErrorName(value: unknown): string {
  if (value instanceof Error && value.name) {
    return value.name;
  }

  const errorLike = asErrorLike(value);
  return typeof errorLike?.name === 'string' ? errorLike.name : 'UnknownError';
}

function getErrorCode(value: unknown): string | undefined {
  const errorLike = asErrorLike(value);
  return typeof errorLike?.code === 'string' ? errorLike.code : undefined;
}

function getErrorMessage(value: unknown): string | undefined {
  if (value instanceof Error && value.message) {
    return value.message;
  }

  const errorLike = asErrorLike(value);
  return typeof errorLike?.message === 'string' ? errorLike.message : undefined;
}

function getSafeDetail(value: unknown): string | undefined {
  if (
    value instanceof DatabaseConfigurationError ||
    value instanceof RateLimitSecretConfigurationError ||
    value instanceof SiteUrlConfigurationError
  ) {
    return value.message;
  }

  const errorLike = asErrorLike(value);
  const code = getErrorCode(value);
  const message = getErrorMessage(value);

  if (message === 'No transactions support in neon-http driver') {
    return message;
  }

  if (code === '42P01') {
    return typeof errorLike?.table === 'string'
      ? `Missing database table: ${errorLike.table}`
      : 'Missing database relation required for ruling submissions.';
  }

  if (code === '42703') {
    return typeof errorLike?.column === 'string'
      ? `Missing database column: ${errorLike.column}`
      : 'Missing database column required for ruling submissions.';
  }

  if (value instanceof SubmissionPersistenceError) {
    return value.message;
  }

  if (code?.startsWith('08')) {
    return 'Database connectivity is unavailable for ruling submissions.';
  }

  return undefined;
}

function isConfigurationError(error: unknown): boolean {
  return (
    error instanceof DatabaseConfigurationError ||
    error instanceof RateLimitSecretConfigurationError ||
    error instanceof SiteUrlConfigurationError
  );
}

function isDependencyUnavailableError(error: unknown): boolean {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);

  return (
    code === '42P01' ||
    code === '42703' ||
    code?.startsWith('08') === true ||
    message === 'No transactions support in neon-http driver'
  );
}

export function classifySubmissionRouteError(
  error: unknown,
): SubmissionErrorSummary {
  const cause = asErrorLike(error)?.cause;

  if (isConfigurationError(error)) {
    return {
      statusCode: 503,
      log: {
        operation: 'submit-ruling',
        category: 'configuration',
        name: getErrorName(error),
        detail: getSafeDetail(error),
      },
    };
  }

  if (
    isDependencyUnavailableError(error) ||
    isDependencyUnavailableError(cause)
  ) {
    return {
      statusCode: 503,
      log: {
        operation: 'submit-ruling',
        category: 'dependency-unavailable',
        name: getErrorName(error),
        code: getErrorCode(error),
        detail: getSafeDetail(error),
        causeName: cause ? getErrorName(cause) : undefined,
        causeCode: cause ? getErrorCode(cause) : undefined,
        causeDetail: cause ? getSafeDetail(cause) : undefined,
      },
    };
  }

  return {
    statusCode: 500,
    log: {
      operation: 'submit-ruling',
      category: 'unexpected',
      name: getErrorName(error),
      code: getErrorCode(error),
      detail: getSafeDetail(error),
      causeName: cause ? getErrorName(cause) : undefined,
      causeCode: cause ? getErrorCode(cause) : undefined,
      causeDetail: cause ? getSafeDetail(cause) : undefined,
    },
  };
}
