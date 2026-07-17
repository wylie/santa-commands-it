import { isEndToEndTestMode } from '@/server/env';
import {
  createDatabaseWorkshopReportsRepository,
  createTestWorkshopReportsRepository,
} from '@/server/workshop/reports-repository';
import {
  createDatabaseWorkshopAuthRepository,
  createDatabaseWorkshopRepository,
  createTestWorkshopAuthRepository,
  createTestWorkshopRepository,
} from '@/server/workshop/repository';

function isWorkshopTestRequest(headers: Headers): boolean {
  return (
    headers.has('x-santa-test-run-id') &&
    (import.meta.env.DEV || isEndToEndTestMode())
  );
}

export function getWorkshopAuthRepositoryForHeaders(headers: Headers) {
  if (!isWorkshopTestRequest(headers)) {
    return createDatabaseWorkshopAuthRepository();
  }

  const runId = headers.get('x-santa-test-run-id') ?? 'default';

  return createTestWorkshopAuthRepository(runId);
}

export function getWorkshopRepositoryForHeaders(headers: Headers) {
  if (!isWorkshopTestRequest(headers)) {
    return createDatabaseWorkshopRepository();
  }

  const runId = headers.get('x-santa-test-run-id') ?? 'default';

  return createTestWorkshopRepository(runId);
}

export function getWorkshopReportsRepositoryForHeaders(headers: Headers) {
  if (!isWorkshopTestRequest(headers)) {
    return createDatabaseWorkshopReportsRepository();
  }

  const runId = headers.get('x-santa-test-run-id') ?? 'default';

  return createTestWorkshopReportsRepository(runId);
}
