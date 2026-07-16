import { santaSettings } from '@/config/santa-settings';
import type {
  CreateRulingInput,
  RulingsRepository,
  StoredRuling,
} from '@/server/rulings/repository';
import { clearTestRunStore, getTestRunStore } from '@/server/testing/store';
import type { PublicRuling } from '@/utils/rulings';

export function createTestRulingsRepository(runId: string): RulingsRepository {
  return {
    async createRuling(input: CreateRulingInput) {
      const storedRuling = await this.createStoredRuling(input);

      return storedRuling.publicRuling;
    },
    async createStoredRuling(input: CreateRulingInput): Promise<StoredRuling> {
      const store = getTestRunStore(runId);
      const ruling: PublicRuling = {
        publicId: input.publicId,
        displayName: input.displayName,
        requestText: input.requestText,
        decision: input.decision,
        santaResponse: input.santaResponse,
        createdAt: new Date().toISOString(),
      };

      store.rulings.unshift(ruling);

      return {
        id: store.rulings.length,
        publicRuling: ruling,
      };
    },
    async listRecentRulings(limit = santaSettings.recentRulings.visibleLimit) {
      return getTestRunStore(runId).rulings.slice(0, limit);
    },
    async getRulingByPublicId(publicId: string) {
      return (
        getTestRunStore(runId).rulings.find(
          (ruling) => ruling.publicId === publicId,
        ) ?? null
      );
    },
    async getRulingReferenceByPublicId(publicId: string) {
      const store = getTestRunStore(runId);
      const rulingIndex = store.rulings.findIndex(
        (ruling) => ruling.publicId === publicId,
      );

      if (rulingIndex === -1) {
        return null;
      }

      return {
        id: rulingIndex + 1,
        publicId,
      };
    },
  };
}

export function clearTestRulingsStore(runId?: string): void {
  clearTestRunStore(runId);
}
