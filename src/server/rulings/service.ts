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
import { santaSettings } from '@/config/santa-settings';

export const RECENT_RULINGS_UNAVAILABLE_MESSAGE =
  "Santa's announcement board is temporarily unavailable.";
export const RULING_LOOKUP_ERROR_MESSAGE =
  "SANTA'S WORKSHOP IS HAVING A SMALL MISHAP. Please try again in a moment.";
export const PUBLIC_COMMANDS_UNAVAILABLE_MESSAGE =
  'Please try again in a little while.';

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
    const rulings = await repository.listRecentRulings(
      santaSettings.recentRulings.visibleLimit,
    );

    return {
      status: 'ok',
      rulings,
    };
  } catch {
    return {
      status: 'unavailable',
      message: RECENT_RULINGS_UNAVAILABLE_MESSAGE,
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
  } catch {
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
    const result = await repository.listPublicRulingsForDiscovery(query);

    return {
      status: 'ok',
      ...result,
    };
  } catch {
    return {
      status: 'unavailable',
      message: PUBLIC_COMMANDS_UNAVAILABLE_MESSAGE,
    };
  }
}
