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
import type { PublicCommandsQuery } from '@/utils/publicCommands';
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
        isFeatured: false,
        featuredAt: null,
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
    async listFeaturedRulings(limit = 3) {
      return getTestRunStore(runId)
        .rulings.filter(
          (ruling) => ruling.visibility === 'public' && ruling.isFeatured,
        )
        .sort((left, right) => {
          const leftTime = left.featuredAt
            ? new Date(left.featuredAt).getTime()
            : 0;
          const rightTime = right.featuredAt
            ? new Date(right.featuredAt).getTime()
            : 0;

          if (rightTime !== leftTime) {
            return rightTime - leftTime;
          }

          return right.id - left.id;
        })
        .slice(0, limit)
        .map(toPublicRuling);
    },
    async listPublicRulingsForDiscovery(query: PublicCommandsQuery) {
      const filtered = getTestRunStore(runId)
        .rulings.filter((ruling) => ruling.visibility === 'public')
        .filter((ruling) => {
          if (query.decision === 'approved') {
            return ruling.decision === 'approved';
          }

          if (query.decision === 'coal') {
            return ruling.decision === 'random-coal';
          }

          if (query.featuredOnly) {
            return ruling.isFeatured;
          }

          return true;
        })
        .filter((ruling) => {
          if (!query.search) {
            return true;
          }

          const needle = query.search.toLocaleLowerCase();

          return (
            ruling.displayName.toLocaleLowerCase().includes(needle) ||
            ruling.requestText.toLocaleLowerCase().includes(needle)
          );
        })
        .sort((left, right) => {
          const leftTime = new Date(left.createdAt).getTime();
          const rightTime = new Date(right.createdAt).getTime();
          const timeComparison =
            query.sort === 'oldest'
              ? leftTime - rightTime
              : rightTime - leftTime;

          if (timeComparison !== 0) {
            return timeComparison;
          }

          return query.sort === 'oldest'
            ? left.id - right.id
            : right.id - left.id;
        });
      const offset = (query.page - 1) * query.pageSize;
      const pageRulings = filtered.slice(offset, offset + query.pageSize);

      return {
        rulings: pageRulings.map(toPublicRuling),
        total: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / query.pageSize)),
        page: query.page,
        pageSize: query.pageSize,
      };
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
    isFeatured: ruling.isFeatured,
    createdAt: ruling.createdAt,
  };
}

export function clearTestRulingsStore(runId?: string): void {
  clearTestRunStore(runId);
}
