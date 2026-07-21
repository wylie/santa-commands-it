import { getSubmissionRepositoryForHeaders } from '@/server/rulings/test-mode';
import { getRequestNow } from '@/server/rulings/test-mode';
import { readRequestTestOptions } from '@/server/rulings/test-mode';
import { RuntimeConfigurationUnavailableError } from '@/server/config/service';
import { getRuntimeConfigurationForHeaders } from '@/server/config/service';
import type { SubmitRulingDependencies } from '@/server/submissions/service';
import type { SubmissionRepository } from '@/server/submissions/repository';

function createSimulatedDatabaseError(
  code: '08006' | '42703',
  options: {
    message: string;
    column?: string;
  },
) {
  return Object.assign(new Error(options.message), {
    code,
    column: options.column,
  });
}

function wrapSubmissionRepositoryForScenario(
  repository: SubmissionRepository,
  scenario: ReturnType<typeof readRequestTestOptions>['scenario'],
): SubmissionRepository {
  if (scenario === 'database-unavailable') {
    return {
      ...repository,
      async createRulingWithIdempotency() {
        throw createSimulatedDatabaseError('08006', {
          message: 'Simulated database outage for ruling persistence.',
        });
      },
    };
  }

  if (scenario === 'missing-rulings-column') {
    return {
      ...repository,
      async createRulingWithIdempotency() {
        throw createSimulatedDatabaseError('42703', {
          message: 'Simulated missing rulings column for persistence.',
          column: 'public_id',
        });
      },
    };
  }

  return repository;
}

export function buildSubmitDependencies(
  headers: Headers,
): SubmitRulingDependencies {
  const testOptions = readRequestTestOptions(headers);
  const repository = wrapSubmissionRepositoryForScenario(
    getSubmissionRepositoryForHeaders(headers),
    testOptions.scenario,
  );

  return {
    submissionRepository: repository,
    loadRuntimeConfiguration: () => {
      if (testOptions.scenario === 'configuration-unavailable') {
        throw new RuntimeConfigurationUnavailableError(
          'At least one active approved template is required.',
        );
      }

      return getRuntimeConfigurationForHeaders(headers);
    },
    randomProvider: () => testOptions.randomValue ?? Math.random(),
    publicIdGenerator: () => crypto.randomUUID(),
    nowProvider: () => getRequestNow(headers),
    scenario:
      testOptions.scenario === 'submit-error' ? 'submit-error' : 'normal',
  };
}
