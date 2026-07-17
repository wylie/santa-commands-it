import { describe, expect, it } from 'vitest';

import { classifySubmissionRouteError } from '@/server/api/submission-errors';
import { DatabaseConfigurationError } from '@/server/env';
import { SubmissionPersistenceError } from '@/server/submissions/service';

describe('submission route error classification', () => {
  it('treats missing database configuration as a dependency outage', () => {
    const result = classifySubmissionRouteError(
      new DatabaseConfigurationError(),
    );

    expect(result).toEqual({
      statusCode: 503,
      log: {
        operation: 'submit-ruling',
        category: 'configuration',
        name: 'DatabaseConfigurationError',
        detail: 'DATABASE_URL is required for Santa rulings persistence.',
      },
    });
  });

  it('treats missing database relations as a dependency outage', () => {
    const error = Object.assign(new Error('relation missing'), {
      code: '42P01',
      table: 'submission_idempotency',
    });

    const result = classifySubmissionRouteError(error);

    expect(result).toEqual({
      statusCode: 503,
      log: {
        operation: 'submit-ruling',
        category: 'dependency-unavailable',
        name: 'Error',
        code: '42P01',
        detail: 'Missing database table: submission_idempotency',
        causeName: undefined,
        causeCode: undefined,
        causeDetail: undefined,
      },
    });
  });

  it('keeps unexpected internal failures as 500 responses while preserving a sanitized cause', () => {
    const result = classifySubmissionRouteError(
      new SubmissionPersistenceError(undefined, {
        cause: new Error('No transactions support in neon-http driver'),
      }),
    );

    expect(result).toEqual({
      statusCode: 503,
      log: {
        operation: 'submit-ruling',
        category: 'dependency-unavailable',
        name: 'SubmissionPersistenceError',
        code: undefined,
        detail: 'Unable to persist ruling submission.',
        causeName: 'Error',
        causeCode: undefined,
        causeDetail: 'No transactions support in neon-http driver',
      },
    });
  });

  it('returns 500 for generic unexpected failures', () => {
    const result = classifySubmissionRouteError(new Error('Unexpected boom'));

    expect(result).toEqual({
      statusCode: 500,
      log: {
        operation: 'submit-ruling',
        category: 'unexpected',
        name: 'Error',
        code: undefined,
        detail: undefined,
        causeName: undefined,
        causeCode: undefined,
        causeDetail: undefined,
      },
    });
  });
});
