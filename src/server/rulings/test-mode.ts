import { createTestRulingReportsRepository } from '@/server/reports/repository';
import { createDatabaseRulingsRepository } from '@/server/rulings/repository';
import { createDatabaseRulingReportsRepository } from '@/server/reports/repository';
import { createDatabaseSubmissionRepository } from '@/server/submissions/repository';
import { createTestRulingsRepository } from '@/server/rulings/test-repository';
import { createTestSubmissionRepository } from '@/server/submissions/repository';
import { isEndToEndTestMode } from '@/server/env';

export type RulingsTestScenario =
  | 'normal'
  | 'submit-error'
  | 'database-unavailable'
  | 'missing-rulings-column'
  | 'configuration-unavailable'
  | 'recent-unavailable'
  | 'commands-unavailable'
  | 'report-error';

export type RequestTestOptions = {
  randomValue?: number;
  scenario: RulingsTestScenario;
  nowIso: string | null;
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
      nowIso: null,
    };
  }

  const scenarioHeader = headers.get('x-santa-test-scenario');
  const scenario: RulingsTestScenario =
    scenarioHeader === 'submit-error' ||
    scenarioHeader === 'database-unavailable' ||
    scenarioHeader === 'missing-rulings-column' ||
    scenarioHeader === 'configuration-unavailable' ||
    scenarioHeader === 'recent-unavailable' ||
    scenarioHeader === 'commands-unavailable' ||
    scenarioHeader === 'report-error'
      ? scenarioHeader
      : 'normal';

  const randomHeader = headers.get('x-santa-test-random');
  const parsedRandomValue =
    randomHeader === null ? Number.NaN : Number.parseFloat(randomHeader);
  const nowHeader = headers.get('x-santa-test-now');
  const parsedNow = nowHeader ? new Date(nowHeader) : null;

  return {
    scenario,
    randomValue:
      Number.isFinite(parsedRandomValue) &&
      parsedRandomValue >= 0 &&
      parsedRandomValue < 1
        ? parsedRandomValue
        : undefined,
    nowIso:
      parsedNow && !Number.isNaN(parsedNow.getTime())
        ? parsedNow.toISOString()
        : null,
  };
}

export function getRequestNow(headers: Headers): Date {
  const nowIso = readRequestTestOptions(headers).nowIso;

  return nowIso ? new Date(nowIso) : new Date();
}

export function getRulingsRepositoryForHeaders(headers: Headers) {
  if (!isTestRequest(headers)) {
    return createDatabaseRulingsRepository();
  }

  const runId = headers.get('x-santa-test-run-id') ?? 'default';

  return createTestRulingsRepository(runId);
}

export function getSubmissionRepositoryForHeaders(headers: Headers) {
  if (!isTestRequest(headers)) {
    return createDatabaseSubmissionRepository();
  }

  const runId = headers.get('x-santa-test-run-id') ?? 'default';

  return createTestSubmissionRepository(runId);
}

export function getRulingReportsRepositoryForHeaders(headers: Headers) {
  if (!isTestRequest(headers)) {
    return createDatabaseRulingReportsRepository();
  }

  const runId = headers.get('x-santa-test-run-id') ?? 'default';

  return createTestRulingReportsRepository(runId);
}
