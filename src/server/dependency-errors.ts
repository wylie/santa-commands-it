import {
  DatabaseConfigurationError,
  RateLimitSecretConfigurationError,
  SiteTimeZoneConfigurationError,
  SiteUrlConfigurationError,
  WorkshopConfigurationError,
} from '@/server/env';
import { RuntimeConfigurationUnavailableError } from '@/server/config/service';
import { SubmissionPersistenceError } from '@/server/submissions/service';

type ErrorLike = {
  name?: unknown;
  code?: unknown;
  message?: unknown;
  cause?: unknown;
  table?: unknown;
  column?: unknown;
};

export type SanitizedDependencyFailure = {
  category: 'configuration' | 'dependency-unavailable' | 'unexpected';
  name: string;
  code?: string;
  detail?: string;
  causeName?: string;
  causeCode?: string;
  causeDetail?: string;
};

function asErrorLike(value: unknown): ErrorLike | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as ErrorLike;
}

export function getErrorName(value: unknown): string {
  if (value instanceof Error && value.name) {
    return value.name;
  }

  const errorLike = asErrorLike(value);
  return typeof errorLike?.name === 'string' ? errorLike.name : 'UnknownError';
}

export function getErrorCode(value: unknown): string | undefined {
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

export function getSafeDependencyDetail(value: unknown): string | undefined {
  if (
    value instanceof DatabaseConfigurationError ||
    value instanceof RateLimitSecretConfigurationError ||
    value instanceof SiteUrlConfigurationError ||
    value instanceof SiteTimeZoneConfigurationError ||
    value instanceof WorkshopConfigurationError ||
    value instanceof RuntimeConfigurationUnavailableError
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
      : 'Missing database relation required by the current deployment.';
  }

  if (code === '42703') {
    return typeof errorLike?.column === 'string'
      ? `Missing database column: ${errorLike.column}`
      : 'Missing database column required by the current deployment.';
  }

  if (value instanceof SubmissionPersistenceError) {
    return value.message;
  }

  if (code?.startsWith('08')) {
    return 'Database connectivity is unavailable.';
  }

  return undefined;
}

export function isConfigurationError(error: unknown): boolean {
  return (
    error instanceof DatabaseConfigurationError ||
    error instanceof RateLimitSecretConfigurationError ||
    error instanceof SiteUrlConfigurationError ||
    error instanceof SiteTimeZoneConfigurationError ||
    error instanceof WorkshopConfigurationError ||
    error instanceof RuntimeConfigurationUnavailableError
  );
}

export function isDependencyUnavailableError(error: unknown): boolean {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);

  return (
    code === '42P01' ||
    code === '42703' ||
    code?.startsWith('08') === true ||
    message === 'No transactions support in neon-http driver'
  );
}

export function summarizeDependencyFailure(
  error: unknown,
): SanitizedDependencyFailure {
  const cause = asErrorLike(error)?.cause;

  if (isConfigurationError(error)) {
    return {
      category: 'configuration',
      name: getErrorName(error),
      detail: getSafeDependencyDetail(error),
    };
  }

  if (
    isDependencyUnavailableError(error) ||
    isDependencyUnavailableError(cause)
  ) {
    return {
      category: 'dependency-unavailable',
      name: getErrorName(error),
      code: getErrorCode(error),
      detail: getSafeDependencyDetail(error),
      causeName: cause ? getErrorName(cause) : undefined,
      causeCode: cause ? getErrorCode(cause) : undefined,
      causeDetail: cause ? getSafeDependencyDetail(cause) : undefined,
    };
  }

  return {
    category: 'unexpected',
    name: getErrorName(error),
    code: getErrorCode(error),
    detail: getSafeDependencyDetail(error),
    causeName: cause ? getErrorName(cause) : undefined,
    causeCode: cause ? getErrorCode(cause) : undefined,
    causeDetail: cause ? getSafeDependencyDetail(cause) : undefined,
  };
}
