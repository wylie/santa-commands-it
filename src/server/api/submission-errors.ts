import {
  summarizeDependencyFailure,
  type SanitizedDependencyFailure,
} from '@/server/dependency-errors';

export type SubmissionErrorSummary = {
  statusCode: 500 | 503;
  log: {
    operation: 'submit-ruling';
  } & SanitizedDependencyFailure;
};

export function classifySubmissionRouteError(
  error: unknown,
): SubmissionErrorSummary {
  const summary = summarizeDependencyFailure(error);

  return {
    statusCode:
      summary.category === 'configuration' ||
      summary.category === 'dependency-unavailable'
        ? 503
        : 500,
    log: {
      operation: 'submit-ruling',
      ...summary,
    },
  };
}
