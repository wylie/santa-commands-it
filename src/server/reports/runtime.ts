import { getRulingReportsRepositoryForHeaders } from '@/server/rulings/test-mode';
import { getRulingsRepositoryForHeaders } from '@/server/rulings/test-mode';
import { getRequestNow } from '@/server/rulings/test-mode';
import { readRequestTestOptions } from '@/server/rulings/test-mode';
import type { SubmitRulingReportDependencies } from '@/server/reports/service';

export function buildReportDependencies(
  headers: Headers,
): SubmitRulingReportDependencies {
  const testOptions = readRequestTestOptions(headers);

  return {
    rulingsRepository: getRulingsRepositoryForHeaders(headers),
    reportsRepository: getRulingReportsRepositoryForHeaders(headers),
    nowProvider: () => getRequestNow(headers),
    scenario:
      testOptions.scenario === 'report-error' ? 'report-error' : 'normal',
  };
}
