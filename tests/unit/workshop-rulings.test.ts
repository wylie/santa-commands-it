import { afterEach, describe, expect, it } from 'vitest';

import { createTestRulingReportsRepository } from '@/server/reports/repository';
import { createTestRulingsRepository } from '@/server/rulings/test-repository';
import { createTestSubmissionRepository } from '@/server/submissions/repository';
import { getTestRunStore } from '@/server/testing/store';
import { clearTestRunStore } from '@/server/testing/store';
import { createTestWorkshopRepository } from '@/server/workshop/repository';

afterEach(() => {
  clearTestRunStore();
});

describe('workshop ruling visibility', () => {
  it('features, unfeatures, and clears featured state when a ruling is hidden', async () => {
    const runId = 'workshop-featured';
    const publicRepository = createTestRulingsRepository(runId);
    const workshopRepository = createTestWorkshopRepository(runId);

    await publicRepository.createRuling({
      publicId: '550e8400-e29b-41d4-a716-446655440010',
      displayName: 'Holly',
      requestText: 'A brass telescope',
      decision: 'approved',
      santaResponse: 'VERY WELL, Holly.',
    });

    const featured = await workshopRepository.setRulingFeatured(
      '550e8400-e29b-41d4-a716-446655440010',
      true,
      new Date('2026-07-18T12:00:00.000Z'),
    );

    expect(featured).toMatchObject({
      isFeatured: true,
      featuredAt: '2026-07-18T12:00:00.000Z',
    });
    await expect(publicRepository.listFeaturedRulings()).resolves.toMatchObject(
      [{ publicId: '550e8400-e29b-41d4-a716-446655440010' }],
    );

    const unfeatured = await workshopRepository.setRulingFeatured(
      '550e8400-e29b-41d4-a716-446655440010',
      false,
      new Date('2026-07-18T12:05:00.000Z'),
    );

    expect(unfeatured).toMatchObject({
      isFeatured: false,
      featuredAt: null,
    });

    await workshopRepository.setRulingFeatured(
      '550e8400-e29b-41d4-a716-446655440010',
      true,
      new Date('2026-07-18T12:10:00.000Z'),
    );
    const hidden = await workshopRepository.hideRuling(
      '550e8400-e29b-41d4-a716-446655440010',
      'Private moderation note',
      new Date('2026-07-18T12:15:00.000Z'),
    );

    expect(hidden).toMatchObject({
      visibility: 'hidden',
      isFeatured: false,
      featuredAt: null,
    });
    expect(
      await workshopRepository.setRulingFeatured(
        '550e8400-e29b-41d4-a716-446655440010',
        true,
        new Date('2026-07-18T12:20:00.000Z'),
      ),
    ).toBe('hidden');
    await expect(publicRepository.listFeaturedRulings()).resolves.toEqual([]);
  });

  it('hides a ruling from public queries and restores it later', async () => {
    const runId = 'workshop-visibility';
    const publicRepository = createTestRulingsRepository(runId);
    const workshopRepository = createTestWorkshopRepository(runId);

    await publicRepository.createRuling({
      publicId: '550e8400-e29b-41d4-a716-446655440000',
      displayName: 'Holly',
      requestText: 'A brass telescope',
      decision: 'approved',
      santaResponse: 'VERY WELL, Holly.',
    });

    const hidden = await workshopRepository.hideRuling(
      '550e8400-e29b-41d4-a716-446655440000',
      'Private moderation note',
      new Date('2026-07-17T12:00:00.000Z'),
    );

    expect(hidden).not.toBe('not-found');
    expect(hidden).not.toBe('already-hidden');
    expect(
      await publicRepository.getRulingByPublicId(
        '550e8400-e29b-41d4-a716-446655440000',
      ),
    ).toBeNull();
    expect(await publicRepository.listRecentRulings()).toHaveLength(0);

    const restored = await workshopRepository.restoreRuling(
      '550e8400-e29b-41d4-a716-446655440000',
    );

    expect(restored).not.toBe('not-found');
    expect(restored).not.toBe('already-public');
    expect(
      await publicRepository.getRulingByPublicId(
        '550e8400-e29b-41d4-a716-446655440000',
      ),
    ).toMatchObject({
      publicId: '550e8400-e29b-41d4-a716-446655440000',
      decision: 'approved',
    });
  });
});

describe('workshop deletion behavior', () => {
  it('deletes the ruling and cascades test-only related records while leaving activity independent', async () => {
    const runId = 'workshop-delete';
    const submissionRepository = createTestSubmissionRepository(runId);
    const reportsRepository = createTestRulingReportsRepository(runId);
    const publicRepository = createTestRulingsRepository(runId);
    const workshopRepository = createTestWorkshopRepository(runId);

    await submissionRepository.createRulingWithIdempotency({
      publicId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      displayName: 'Holly',
      requestText: 'A brass telescope',
      decision: 'approved',
      santaResponse: 'VERY WELL, Holly.',
      clientKeyHash: 'client-a',
      idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      normalizedName: 'holly',
      normalizedRequest: 'a brass telescope',
      expiresAt: new Date('2026-07-24T12:00:00.000Z'),
    });

    await reportsRepository.createReport({
      rulingId: 1,
      clientKeyHash: 'client-a',
      reason: 'spam',
      note: '',
    });
    await workshopRepository.createOwnerActivity({
      action: 'ruling-hidden',
      targetType: 'ruling',
      targetPublicId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      details: 'Note',
    });

    expect(
      await workshopRepository.deleteRuling(
        '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      ),
    ).toBe(true);
    expect(
      await publicRepository.getRulingByPublicId(
        '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      ),
    ).toBeNull();
    expect(getTestRunStore(runId).reports).toHaveLength(0);
    expect(getTestRunStore(runId).idempotencyRecords).toHaveLength(0);
    expect(getTestRunStore(runId).ownerActivity).toHaveLength(1);
  });
});

describe('workshop search and pagination', () => {
  it('filters by decision, visibility, search text, and page', async () => {
    const runId = 'workshop-search';
    const publicRepository = createTestRulingsRepository(runId);
    const workshopRepository = createTestWorkshopRepository(runId);

    for (let index = 0; index < 30; index += 1) {
      await publicRepository.createRuling({
        publicId: `550e8400-e29b-41d4-a716-4466554400${String(index).padStart(2, '0')}`,
        displayName: index % 2 === 0 ? 'Holly' : 'Juniper',
        requestText:
          index === 29 ? 'An observatory dome' : `Gift request ${index}`,
        decision: index % 3 === 0 ? 'random-coal' : 'approved',
        santaResponse: `Response ${index}`,
      });
    }

    await workshopRepository.hideRuling(
      '550e8400-e29b-41d4-a716-446655440029',
      'Private note',
      new Date('2026-07-17T12:00:00.000Z'),
    );

    const result = await workshopRepository.listWorkshopRulings({
      query: 'observatory',
      decision: 'approved',
      visibility: 'hidden',
      featured: 'all',
      sort: 'newest',
      page: 1,
    });
    const secondPage = await workshopRepository.listWorkshopRulings({
      query: '',
      decision: 'all',
      visibility: 'all',
      featured: 'all',
      sort: 'newest',
      page: 2,
    });

    expect(result.total).toBe(1);
    expect(result.rulings[0]).toMatchObject({
      displayName: 'Juniper',
      visibility: 'hidden',
    });
    expect(secondPage.rulings).toHaveLength(5);
    expect(secondPage.pageSize).toBe(25);
  });

  it('filters workshop rulings by featured state', async () => {
    const runId = 'workshop-featured-filter';
    const publicRepository = createTestRulingsRepository(runId);
    const workshopRepository = createTestWorkshopRepository(runId);

    await publicRepository.createRuling({
      publicId: '550e8400-e29b-41d4-a716-446655440031',
      displayName: 'Featured Holly',
      requestText: 'A snow globe',
      decision: 'approved',
      santaResponse: 'VERY WELL.',
    });
    await publicRepository.createRuling({
      publicId: '550e8400-e29b-41d4-a716-446655440032',
      displayName: 'Plain Juniper',
      requestText: 'A warm scarf',
      decision: 'approved',
      santaResponse: 'APPROVED.',
    });

    await workshopRepository.setRulingFeatured(
      '550e8400-e29b-41d4-a716-446655440031',
      true,
      new Date('2026-07-19T12:00:00.000Z'),
    );

    const featured = await workshopRepository.listWorkshopRulings({
      query: '',
      decision: 'all',
      visibility: 'all',
      featured: 'featured',
      sort: 'newest',
      page: 1,
    });
    const notFeatured = await workshopRepository.listWorkshopRulings({
      query: '',
      decision: 'all',
      visibility: 'all',
      featured: 'not-featured',
      sort: 'newest',
      page: 1,
    });

    expect(featured.total).toBe(1);
    expect(featured.rulings[0]?.displayName).toBe('Featured Holly');
    expect(notFeatured.rulings.some((ruling) => ruling.isFeatured)).toBe(false);
  });
});
