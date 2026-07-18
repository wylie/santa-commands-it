import { getSubmissionRepositoryForHeaders } from '@/server/rulings/test-mode';
import { readRequestTestOptions } from '@/server/rulings/test-mode';
import { getRuntimeConfigurationForHeaders } from '@/server/config/service';
import type { SubmitRulingDependencies } from '@/server/submissions/service';

export function buildSubmitDependencies(
  headers: Headers,
): SubmitRulingDependencies {
  const testOptions = readRequestTestOptions(headers);

  return {
    submissionRepository: getSubmissionRepositoryForHeaders(headers),
    loadRuntimeConfiguration: () => getRuntimeConfigurationForHeaders(headers),
    randomProvider: () => testOptions.randomValue ?? Math.random(),
    publicIdGenerator: () => crypto.randomUUID(),
    nowProvider: () => new Date(),
    scenario:
      testOptions.scenario === 'submit-error' ? 'submit-error' : 'normal',
  };
}
