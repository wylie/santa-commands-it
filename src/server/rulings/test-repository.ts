import { santaSettings } from '@/config/santa-settings';
import type {
  CreateRulingInput,
  RulingsRepository,
  StoredRuling,
} from '@/server/rulings/repository';
import {
  clearTestRunStore,
  getTestRunStore,
  type TestStoredRuling,
} from '@/server/testing/store';
import type { PublicRuling } from '@/utils/rulings';

export function createTestRulingsRepository(runId: string): RulingsRepository {
  return {
    async createRuling(input: CreateRulingInput) {
      const storedRuling = await this.createStoredRuling(input);

      return storedRuling.publicRuling;
    },
    async createStoredRuling(input: CreateRulingInput): Promise<StoredRuling> {
      const store = getTestRunStore(runId);
      const ruling = {
        id: store.rulings.length + 1,
        publicId: input.publicId,
        displayName: input.displayName,
        requestText: input.requestText,
        decision: input.decision,
        santaResponse: input.santaResponse,
        createdAt: new Date().toISOString(),
        visibility: 'public' as const,
        hiddenAt: null,
        hiddenReason: null,
      };

      store.rulings.unshift(ruling);

      return {
        id: ruling.id,
        publicRuling: toPublicRuling(ruling),
      };
    },
    async listRecentRulings(limit = santaSettings.recentRulings.visibleLimit) {
      return getTestRunStore(runId)
        .rulings.filter((ruling) => ruling.visibility === 'public')
        .slice(0, limit)
        .map(toPublicRuling);
    },
    async getRulingByPublicId(publicId: string) {
      const ruling = getTestRunStore(runId).rulings.find(
        (entry) => entry.publicId === publicId && entry.visibility === 'public',
      );

      return ruling ? toPublicRuling(ruling) : null;
    },
    async getRulingReferenceByPublicId(publicId: string) {
      const store = getTestRunStore(runId);
      const ruling = store.rulings.find(
        (entry) => entry.publicId === publicId && entry.visibility === 'public',
      );

      if (!ruling) {
        return null;
      }

      return {
        id: ruling.id,
        publicId,
      };
    },
  };
}

function toPublicRuling(ruling: TestStoredRuling): PublicRuling {
  return {
    publicId: ruling.publicId,
    displayName: ruling.displayName,
    requestText: ruling.requestText,
    decision: ruling.decision,
    santaResponse: ruling.santaResponse,
    createdAt: ruling.createdAt,
  };
}

export function clearTestRulingsStore(runId?: string): void {
  clearTestRunStore(runId);
}
