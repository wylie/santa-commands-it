import { afterEach, describe, expect, it } from 'vitest';

import {
  clearTestRulingsStore,
  createTestRulingsRepository,
} from '@/server/rulings/test-repository';
import type { PublicRuling } from '@/utils/rulings';
import {
  buildCanonicalUrl,
  buildRulingPageDescription,
  buildRulingPageTitle,
  buildRulingPath,
  buildRulingSharePayload,
  isValidPublicRulingId,
  truncateMetadataText,
} from '@/utils/rulingPages';

const approvedRuling: PublicRuling = {
  publicId: '550e8400-e29b-41d4-a716-446655440000',
  displayName: '<Holly>',
  requestText:
    '<img src=x onerror=alert(1)> A brass telescope for winter stargazing',
  decision: 'approved',
  santaResponse: 'VERY WELL, Holly. SANTA COMMANDS IT!',
  createdAt: '2026-07-15T23:30:00.000Z',
};

const coalRuling: PublicRuling = {
  ...approvedRuling,
  publicId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  decision: 'random-coal',
  santaResponse: 'SANTA HAS SPOKEN. YOU GET COAL.',
};

afterEach(() => {
  clearTestRulingsStore();
});

describe('public ruling identifiers', () => {
  it('accepts valid UUID-shaped public identifiers', () => {
    expect(isValidPublicRulingId(approvedRuling.publicId)).toBe(true);
  });

  it('rejects invalid identifier shapes', () => {
    expect(isValidPublicRulingId('not-a-ruling-id')).toBe(false);
  });

  it('rejects empty identifiers', () => {
    expect(isValidPublicRulingId('')).toBe(false);
  });

  it('rejects unexpected characters', () => {
    expect(
      isValidPublicRulingId('550e8400-e29b-41d4-a716-44665544000<script>'),
    ).toBe(false);
  });
});

describe('public ruling lookup helpers', () => {
  it('returns a safe public ruling from repository lookup', async () => {
    const repository = createTestRulingsRepository('lookup-run');
    await repository.createRuling({
      publicId: approvedRuling.publicId,
      displayName: approvedRuling.displayName,
      requestText: approvedRuling.requestText,
      decision: approvedRuling.decision,
      santaResponse: approvedRuling.santaResponse,
    });

    const ruling = await repository.getRulingByPublicId(
      approvedRuling.publicId,
    );

    expect(ruling).not.toBeNull();
    expect(ruling).toMatchObject({
      publicId: approvedRuling.publicId,
      displayName: approvedRuling.displayName,
      requestText: approvedRuling.requestText,
      decision: 'approved',
    });
    expect(ruling && 'id' in ruling).toBe(false);
  });

  it('returns null for an unknown public identifier', async () => {
    const repository = createTestRulingsRepository('lookup-run');

    await expect(
      repository.getRulingByPublicId('550e8400-e29b-41d4-a716-446655440999'),
    ).resolves.toBeNull();
  });
});

describe('ruling metadata', () => {
  it('formats approved titles predictably', () => {
    expect(buildRulingPageTitle(approvedRuling)).toBe(
      "Santa Commands It! - <Holly>'s Request",
    );
  });

  it('formats coal titles predictably', () => {
    expect(buildRulingPageTitle(coalRuling)).toBe(
      "Coal from Santa - <Holly>'s Request",
    );
  });

  it('truncates long metadata descriptions safely', () => {
    const description = buildRulingPageDescription(
      {
        ...approvedRuling,
        requestText: `An observatory for ${'winter '.repeat(40)}nights`,
      },
      120,
    );

    expect(description.length).toBeLessThanOrEqual(120);
    expect(description.endsWith('...')).toBe(true);
  });

  it('keeps HTML-like input as plain text in metadata', () => {
    const description = buildRulingPageDescription(approvedRuling, 160);

    expect(description).toContain('<img src=x onerror=alert(1)>');
  });

  it('builds canonical URLs from the configured site URL', () => {
    expect(
      buildCanonicalUrl(buildRulingPath(approvedRuling.publicId), {
        siteUrl: 'https://santa.example',
      }),
    ).toBe(`https://santa.example/rulings/${approvedRuling.publicId}`);
  });

  it('falls back to the request URL when no site URL is configured', () => {
    expect(
      buildCanonicalUrl(buildRulingPath(approvedRuling.publicId), {
        requestUrl: 'http://127.0.0.1:4321/elsewhere',
      }),
    ).toBe(`http://127.0.0.1:4321/rulings/${approvedRuling.publicId}`);
  });

  it('returns null when no canonical origin is available', () => {
    expect(buildCanonicalUrl('/rulings/example')).toBeNull();
  });

  it('truncates metadata text without breaking emoji boundaries', () => {
    expect(truncateMetadataText('🎁🎁🎁🎁🎁', 4)).toBe('🎁...');
  });
});

describe('ruling share payloads', () => {
  it('builds approved share text with the canonical URL', () => {
    expect(
      buildRulingSharePayload(
        approvedRuling,
        'https://santa.example/rulings/approved',
      ),
    ).toEqual({
      title: "Santa Commands It! - <Holly>'s Request",
      text: 'Santa approved this request with "Santa Commands It!"',
      url: 'https://santa.example/rulings/approved',
    });
  });

  it('builds coal share text with the canonical URL', () => {
    expect(
      buildRulingSharePayload(coalRuling, 'https://santa.example/rulings/coal'),
    ).toEqual({
      title: "Coal from Santa - <Holly>'s Request",
      text: 'Santa decided this request deserved coal.',
      url: 'https://santa.example/rulings/coal',
    });
  });
});
