import { santaSettings } from '@/config/santa-settings';
import type {
  CreateRulingInput,
  RulingsRepository,
} from '@/server/rulings/repository';
import type { PublicRuling } from '@/utils/rulings';

type TestStore = Map<string, PublicRuling[]>;

const stores: TestStore = new Map();

function getStore(runId: string): PublicRuling[] {
  const store = stores.get(runId);

  if (store) {
    return store;
  }

  const nextStore: PublicRuling[] = [];
  stores.set(runId, nextStore);

  return nextStore;
}

export function createTestRulingsRepository(runId: string): RulingsRepository {
  return {
    async createRuling(input: CreateRulingInput) {
      const store = getStore(runId);
      const ruling: PublicRuling = {
        publicId: input.publicId,
        displayName: input.displayName,
        requestText: input.requestText,
        decision: input.decision,
        santaResponse: input.santaResponse,
        createdAt: new Date().toISOString(),
      };

      store.unshift(ruling);

      return ruling;
    },
    async listRecentRulings(limit = santaSettings.recentRulings.visibleLimit) {
      return getStore(runId).slice(0, limit);
    },
  };
}

export function clearTestRulingsStore(runId?: string): void {
  if (runId) {
    stores.delete(runId);
    return;
  }

  stores.clear();
}
