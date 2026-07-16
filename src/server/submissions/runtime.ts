import { getSubmissionRepositoryForHeaders } from '@/server/rulings/test-mode';
import { readRequestTestOptions } from '@/server/rulings/test-mode';
import type { SubmitRulingDependencies } from '@/server/submissions/service';

export function buildSubmitDependencies(
  headers: Headers,
): SubmitRulingDependencies {
  const testOptions = readRequestTestOptions(headers);

  return {
    submissionRepository: getSubmissionRepositoryForHeaders(headers),
    randomProvider: () => testOptions.randomValue ?? Math.random(),
    publicIdGenerator: () => crypto.randomUUID(),
    nowProvider: () => new Date(),
    scenario:
      testOptions.scenario === 'submit-error' ? 'submit-error' : 'normal',
  };
}
