import { isEndToEndTestMode } from '@/server/env';
import {
  createDatabaseConfigurationRepository,
  createTestConfigurationRepository,
} from '@/server/config/repository';

function isConfigurationTestRequest(headers: Headers): boolean {
  return (
    headers.has('x-santa-test-run-id') &&
    (import.meta.env.DEV || isEndToEndTestMode())
  );
}

export function getConfigurationRepositoryForHeaders(headers: Headers) {
  if (!isConfigurationTestRequest(headers)) {
    return createDatabaseConfigurationRepository();
  }

  const runId = headers.get('x-santa-test-run-id') ?? 'default';

  return createTestConfigurationRepository(runId);
}
