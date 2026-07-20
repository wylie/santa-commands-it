import { describe, expect, it } from 'vitest';

import {
  listPublicCommandsForHeaders,
  listRecentRulingsForHeaders,
} from '@/server/rulings/service';

function createTestHeaders(scenario: string) {
  return new Headers({
    'x-santa-test-run-id': 'public-rulings-service',
    'x-santa-test-scenario': scenario,
  });
}

describe('public rulings service degradation', () => {
  it('returns an unavailable Latest Answers state during a database outage', async () => {
    const result = await listRecentRulingsForHeaders(
      createTestHeaders('database-unavailable'),
    );

    expect(result).toEqual({
      status: 'unavailable',
      message: 'Please try again in a little while.',
    });
  });

  it('returns an unavailable Browse Requests state when the rulings schema is missing a required column', async () => {
    const result = await listPublicCommandsForHeaders(
      {
        page: 1,
        pageSize: 12,
        decision: 'all',
        sort: 'newest',
        search: '',
        featuredOnly: false,
      },
      createTestHeaders('missing-rulings-column'),
    );

    expect(result).toEqual({
      status: 'unavailable',
      message: 'Please try again in a little while.',
    });
  });

  it('keeps Latest Answers independent from submission-only runtime configuration failures', async () => {
    const result = await listRecentRulingsForHeaders(
      createTestHeaders('configuration-unavailable'),
    );

    expect(result).toEqual({
      status: 'ok',
      rulings: [],
    });
  });
});
