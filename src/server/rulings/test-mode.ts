import { createDatabaseRulingsRepository } from '@/server/rulings/repository';
import { createTestRulingsRepository } from '@/server/rulings/test-repository';
import { isEndToEndTestMode } from '@/server/env';

export type RulingsTestScenario =
  'normal' | 'submit-error' | 'recent-unavailable';

export type RequestTestOptions = {
  randomValue?: number;
  scenario: RulingsTestScenario;
};

function isTestRequest(headers: Headers): boolean {
  return (
    headers.has('x-santa-test-run-id') &&
    (import.meta.env.DEV || isEndToEndTestMode())
  );
}

export function readRequestTestOptions(headers: Headers): RequestTestOptions {
  if (!isTestRequest(headers)) {
    return {
      scenario: 'normal',
    };
  }

  const scenarioHeader = headers.get('x-santa-test-scenario');
  const scenario: RulingsTestScenario =
    scenarioHeader === 'submit-error' || scenarioHeader === 'recent-unavailable'
      ? scenarioHeader
      : 'normal';

  const randomHeader = headers.get('x-santa-test-random');
  const parsedRandomValue =
    randomHeader === null ? Number.NaN : Number.parseFloat(randomHeader);

  return {
    scenario,
    randomValue:
      Number.isFinite(parsedRandomValue) &&
      parsedRandomValue >= 0 &&
      parsedRandomValue < 1
        ? parsedRandomValue
        : undefined,
  };
}

export function getRulingsRepositoryForHeaders(headers: Headers) {
  if (!isTestRequest(headers)) {
    return createDatabaseRulingsRepository();
  }

  const runId = headers.get('x-santa-test-run-id') ?? 'default';

  return createTestRulingsRepository(runId);
}
