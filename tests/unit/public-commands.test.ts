import { afterEach, describe, expect, it } from 'vitest';

import {
  buildPublicCommandsPagePath,
  buildPublicCommandsPath,
  createPublicExcerpt,
  getPublicCommandsSummary,
  PUBLIC_RULING_CARD_EXCERPT_LIMITS,
  parsePublicCommandsQuery,
} from '@/utils/publicCommands';
import {
  clearTestRulingsStore,
  createTestRulingsRepository,
} from '@/server/rulings/test-repository';

function parse(query = '') {
  return parsePublicCommandsQuery(new URLSearchParams(query));
}

afterEach(() => {
  clearTestRulingsStore();
});

describe('public Commands query parsing', () => {
  it('uses defaults for an empty query', () => {
    expect(parse()).toEqual({
      search: '',
      decision: 'all',
      featuredOnly: false,
      sort: 'newest',
      page: 1,
      pageSize: 12,
    });
  });

  it('normalizes search whitespace and keeps unicode text', () => {
    expect(parse('q=%20%20snow%09bike%20%E2%98%83%EF%B8%8F%20').search).toBe(
      'snow bike ☃️',
    );
  });

  it('bounds overlong search values', () => {
    expect(parse(`q=${'a'.repeat(120)}`).search).toHaveLength(80);
  });

  it('keeps emoji and HTML-like search as plain text', () => {
    expect(parse('q=%3Cimg%3E%20%F0%9F%8E%81').search).toBe('<img> 🎁');
  });

  it('parses supported decisions and falls invalid values back to all', () => {
    expect(parse('decision=all').decision).toBe('all');
    expect(parse('decision=approved').decision).toBe('approved');
    expect(parse('decision=coal').decision).toBe('coal');
    expect(parse('decision=featured').decision).toBe('all');
    expect(parse('decision=hidden').decision).toBe('all');
  });

  it('parses featured-only filtering from the dedicated query parameter', () => {
    expect(parse('featured=true').featuredOnly).toBe(true);
    expect(parse('featured=false').featuredOnly).toBe(false);
    expect(parse('featured=pony').featuredOnly).toBe(false);
  });

  it('parses supported sorting and falls invalid values back to newest', () => {
    expect(parse('sort=newest').sort).toBe('newest');
    expect(parse('sort=oldest').sort).toBe('oldest');
    expect(parse('sort=popular').sort).toBe('newest');
  });

  it('validates page values before they can reach the repository', () => {
    expect(parse('page=2').page).toBe(2);
    expect(parse('page=0').page).toBe(1);
    expect(parse('page=-3').page).toBe(1);
    expect(parse('page=2.5').page).toBe(1);
    expect(parse('page=999999999').page).toBe(1000);
  });

  it('uses the first repeated query parameter and ignores unsupported parameters', () => {
    expect(parse('q=bike&q=pony&utm_source=test').search).toBe('bike');
  });

  it('generates stable normalized discovery URLs', () => {
    expect(buildPublicCommandsPath()).toBe('/commands');
    expect(
      buildPublicCommandsPath({
        search: ' bike ',
        decision: 'approved',
        featuredOnly: true,
        sort: 'oldest',
        page: 2,
      }),
    ).toBe(
      '/commands?q=bike&decision=approved&featured=true&sort=oldest&page=2',
    );
    expect(buildPublicCommandsPagePath(parse('q=bike&sort=oldest'), 1)).toBe(
      '/commands?q=bike&sort=oldest',
    );
  });

  it('summarizes active filters without private counts', () => {
    expect(getPublicCommandsSummary(3, parse('q=bike&decision=approved'))).toBe(
      'Showing 3 approved requests matching "bike".',
    );
    expect(getPublicCommandsSummary(0, parse('decision=coal'))).toBe(
      'No coal requests matched.',
    );
    expect(getPublicCommandsSummary(1, parse('featured=true'))).toBe(
      'Showing 1 featured request.',
    );
    expect(
      getPublicCommandsSummary(2, parse('decision=approved&featured=true')),
    ).toBe('Showing 2 featured approved requests.');
  });
});

describe('public excerpts', () => {
  it('normalizes line endings and truncates at a safe boundary', () => {
    expect(createPublicExcerpt('First\r\nSecond\nThird', 20)).toBe(
      'First Second Third',
    );
    expect(createPublicExcerpt('🎁'.repeat(12), 12)).toBe('🎁🎁🎁🎁...');
  });

  it('does not interpret HTML-like content', () => {
    expect(createPublicExcerpt('<script>alert(1)</script>')).toBe(
      '<script>alert(1)</script>',
    );
  });

  it('keeps compact card excerpts shorter than browse card excerpts', () => {
    expect(PUBLIC_RULING_CARD_EXCERPT_LIMITS.compact.request).toBeLessThan(
      PUBLIC_RULING_CARD_EXCERPT_LIMITS.browse.request,
    );
    expect(PUBLIC_RULING_CARD_EXCERPT_LIMITS.compact.response).toBeLessThan(
      PUBLIC_RULING_CARD_EXCERPT_LIMITS.browse.response,
    );
  });
});

describe('public Commands repository behavior', () => {
  async function seedRepository() {
    const repository = createTestRulingsRepository('commands-run');
    const records = [
      {
        publicId: '550e8400-e29b-41d4-a716-446655440001',
        displayName: 'Bike Dad',
        requestText: 'A red bicycle',
        decision: 'approved' as const,
        santaResponse: 'VERY WELL. SANTA COMMANDS IT!',
      },
      {
        publicId: '550e8400-e29b-41d4-a716-446655440002',
        displayName: 'Coal Cousin',
        requestText: 'A loud drum kit',
        decision: 'random-coal' as const,
        santaResponse: 'SANTA HAS SPOKEN. YOU GET COAL.',
      },
      {
        publicId: '550e8400-e29b-41d4-a716-446655440003',
        displayName: 'Book Kid',
        requestText: 'A winter book',
        decision: 'approved' as const,
        santaResponse: 'APPROVED BY SANTA.',
      },
    ];

    for (const record of records) {
      await repository.createRuling(record);
    }

    return repository;
  }

  it('lists newest and oldest public rulings deterministically', async () => {
    const repository = await seedRepository();

    await expect(
      repository.listPublicRulingsForDiscovery(parse()),
    ).resolves.toMatchObject({
      total: 3,
      totalPages: 1,
      rulings: [
        { displayName: 'Book Kid' },
        { displayName: 'Coal Cousin' },
        { displayName: 'Bike Dad' },
      ],
    });
    await expect(
      repository.listPublicRulingsForDiscovery(parse('sort=oldest')),
    ).resolves.toMatchObject({
      rulings: [
        { displayName: 'Bike Dad' },
        { displayName: 'Coal Cousin' },
        { displayName: 'Book Kid' },
      ],
    });
  });

  it('filters by decision and searches display name or request text case-insensitively', async () => {
    const repository = await seedRepository();

    await expect(
      repository.listPublicRulingsForDiscovery(parse('decision=coal')),
    ).resolves.toMatchObject({
      total: 1,
      rulings: [{ displayName: 'Coal Cousin', decision: 'random-coal' }],
    });
    await expect(
      repository.listPublicRulingsForDiscovery(parse('q=BIKE')),
    ).resolves.toMatchObject({
      total: 1,
      rulings: [{ displayName: 'Bike Dad' }],
    });
    await expect(
      repository.listPublicRulingsForDiscovery(
        parse('q=book&decision=approved'),
      ),
    ).resolves.toMatchObject({
      total: 1,
      rulings: [{ displayName: 'Book Kid' }],
    });
  });

  it('filters featured rulings by newest featured time without changing all-result ordering', async () => {
    const repository = await seedRepository();
    const store = await import('@/server/testing/store');
    const testStore = store.getTestRunStore('commands-run');
    const bikeDad = testStore.rulings.find(
      (ruling) => ruling.displayName === 'Bike Dad',
    );
    const coalCousin = testStore.rulings.find(
      (ruling) => ruling.displayName === 'Coal Cousin',
    );

    if (!bikeDad || !coalCousin) {
      throw new Error('Expected seeded rulings.');
    }

    bikeDad.isFeatured = true;
    bikeDad.featuredAt = '2026-07-18T12:00:00.000Z';
    coalCousin.isFeatured = true;
    coalCousin.featuredAt = '2026-07-19T12:00:00.000Z';

    await expect(
      repository.listPublicRulingsForDiscovery(parse('featured=true')),
    ).resolves.toMatchObject({
      total: 2,
      rulings: [
        { displayName: 'Coal Cousin', isFeatured: true },
        { displayName: 'Bike Dad', isFeatured: true },
      ],
    });
    await expect(
      repository.listPublicRulingsForDiscovery(parse()),
    ).resolves.toMatchObject({
      rulings: [
        { displayName: 'Book Kid' },
        { displayName: 'Coal Cousin' },
        { displayName: 'Bike Dad' },
      ],
    });
  });

  it('paginates with a fixed page size and excludes hidden rulings', async () => {
    const repository = await seedRepository();
    await repository.createRuling({
      publicId: '550e8400-e29b-41d4-a716-446655440004',
      displayName: 'Hidden Helper',
      requestText: 'A hidden sled',
      decision: 'approved',
      santaResponse: 'APPROVED.',
    });
    const store = await import('@/server/testing/store');
    store.getTestRunStore('commands-run').rulings[0].visibility = 'hidden';

    await expect(
      repository.listPublicRulingsForDiscovery({ ...parse(), pageSize: 2 }),
    ).resolves.toMatchObject({
      total: 3,
      totalPages: 2,
      rulings: [{ displayName: 'Book Kid' }, { displayName: 'Coal Cousin' }],
    });
    await expect(
      repository.listPublicRulingsForDiscovery({
        ...parse('page=2'),
        pageSize: 2,
      }),
    ).resolves.toMatchObject({
      total: 3,
      rulings: [{ displayName: 'Bike Dad' }],
    });
    await expect(
      repository.listPublicRulingsForDiscovery({
        ...parse('page=3'),
        pageSize: 2,
      }),
    ).resolves.toMatchObject({
      total: 3,
      rulings: [],
    });
  });
});
