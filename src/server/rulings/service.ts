import type { CreatedRulingResponse, PublicRuling } from '@/utils/rulings';
import type {
  PublicCommandsQuery,
  PublicCommandsDiscoveryRuling,
} from '@/utils/publicCommands';
import { isValidPublicRulingId } from '@/utils/rulingPages';
import {
  getRulingsRepositoryForHeaders,
  readRequestTestOptions,
} from '@/server/rulings/test-mode';
import { summarizeDependencyFailure } from '@/server/dependency-errors';
import { santaSettings } from '@/config/santa-settings';

export const RECENT_RULINGS_UNAVAILABLE_MESSAGE =
  'Please try again in a little while.';
export const RULING_LOOKUP_ERROR_MESSAGE =
  "SANTA'S WORKSHOP IS HAVING A SMALL MISHAP. Please try again in a moment.";
export const PUBLIC_COMMANDS_UNAVAILABLE_MESSAGE =
  'Please try again in a little while.';
export const FEATURED_RULINGS_UNAVAILABLE_MESSAGE =
  "Santa's featured requests are temporarily unavailable.";

export type RecentRulingsResult =
  | {
      status: 'ok';
      rulings: CreatedRulingResponse['ruling'][];
    }
  | {
      status: 'unavailable';
      message: string;
    };

export type PublicRulingLookupResult =
  | {
      status: 'ok';
      ruling: PublicRuling;
    }
  | {
      status: 'not-found';
    }
  | {
      status: 'unavailable';
      message: string;
    };

export type PublicCommandsDiscoveryResult =
  | {
      status: 'ok';
      rulings: PublicCommandsDiscoveryRuling[];
      total: number;
      totalPages: number;
      page: number;
      pageSize: number;
    }
  | {
      status: 'unavailable';
      message: string;
    };

function createSimulatedPublicRulingsError(
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

function maybeThrowSimulatedPublicRulingsFailure(
  scenario: ReturnType<typeof readRequestTestOptions>['scenario'],
) {
  if (scenario === 'database-unavailable') {
    throw createSimulatedPublicRulingsError('08006', {
      message: 'Simulated database outage for public rulings.',
    });
  }

  if (scenario === 'missing-rulings-column') {
    throw createSimulatedPublicRulingsError('42703', {
      message: 'Simulated missing rulings column for public reads.',
      column: 'public_id',
    });
  }
}

function logPublicRulingsFailure(
  operation:
    | 'latest-answers'
    | 'featured-requests'
    | 'public-ruling'
    | 'browse-requests',
  error: unknown,
) {
  console.error('[santa-commands-it]', {
    route: operation,
    ...summarizeDependencyFailure(error),
  });
}

export async function listRecentRulingsForHeaders(
  headers: Headers,
): Promise<RecentRulingsResult> {
  const repository = getRulingsRepositoryForHeaders(headers);
  const testOptions = readRequestTestOptions(headers);

  if (testOptions.scenario === 'recent-unavailable') {
    return {
      status: 'unavailable',
      message: RECENT_RULINGS_UNAVAILABLE_MESSAGE,
    };
  }

  try {
    maybeThrowSimulatedPublicRulingsFailure(testOptions.scenario);
    const rulings = await repository.listRecentRulings(
      santaSettings.recentRulings.visibleLimit,
    );

    return {
      status: 'ok',
      rulings,
    };
  } catch (error) {
    logPublicRulingsFailure('latest-answers', error);

    return {
      status: 'unavailable',
      message: RECENT_RULINGS_UNAVAILABLE_MESSAGE,
    };
  }
}

export async function listFeaturedRulingsForHeaders(
  headers: Headers,
): Promise<RecentRulingsResult> {
  const repository = getRulingsRepositoryForHeaders(headers);
  const testOptions = readRequestTestOptions(headers);

  try {
    maybeThrowSimulatedPublicRulingsFailure(testOptions.scenario);
    const rulings = await repository.listFeaturedRulings(3);

    return {
      status: 'ok',
      rulings,
    };
  } catch (error) {
    logPublicRulingsFailure('featured-requests', error);

    return {
      status: 'unavailable',
      message: FEATURED_RULINGS_UNAVAILABLE_MESSAGE,
    };
  }
}

export async function getPublicRulingForHeaders(
  publicId: string,
  headers: Headers,
): Promise<PublicRulingLookupResult> {
  if (!isValidPublicRulingId(publicId)) {
    return {
      status: 'not-found',
    };
  }

  try {
    const repository = getRulingsRepositoryForHeaders(headers);
    maybeThrowSimulatedPublicRulingsFailure(
      readRequestTestOptions(headers).scenario,
    );
    const ruling = await repository.getRulingByPublicId(publicId);

    if (!ruling) {
      return {
        status: 'not-found',
      };
    }

    return {
      status: 'ok',
      ruling,
    };
  } catch (error) {
    logPublicRulingsFailure('public-ruling', error);

    return {
      status: 'unavailable',
      message: RULING_LOOKUP_ERROR_MESSAGE,
    };
  }
}

export async function listPublicCommandsForHeaders(
  query: PublicCommandsQuery,
  headers: Headers,
): Promise<PublicCommandsDiscoveryResult> {
  const repository = getRulingsRepositoryForHeaders(headers);
  const testOptions = readRequestTestOptions(headers);

  if (testOptions.scenario === 'commands-unavailable') {
    return {
      status: 'unavailable',
      message: PUBLIC_COMMANDS_UNAVAILABLE_MESSAGE,
    };
  }

  try {
    maybeThrowSimulatedPublicRulingsFailure(testOptions.scenario);
    const result = await repository.listPublicRulingsForDiscovery(query);

    return {
      status: 'ok',
      ...result,
    };
  } catch (error) {
    logPublicRulingsFailure('browse-requests', error);

    return {
      status: 'unavailable',
      message: PUBLIC_COMMANDS_UNAVAILABLE_MESSAGE,
    };
  }
}
