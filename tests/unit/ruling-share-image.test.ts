import { describe, expect, it } from 'vitest';

import {
  buildShareImageErrorResponse,
  normalizeShareImageText,
  prepareRulingShareImage,
  renderRulingShareImage,
  RULING_SHARE_IMAGE_PRIVATE_CACHE_CONTROL,
  RULING_SHARE_IMAGE_PUBLIC_CACHE_CONTROL,
  selectShareImageTreatment,
  wrapShareImageText,
} from '@/server/rulings/share-image';
import type { PublicRuling } from '@/utils/rulings';

const approvedRuling: PublicRuling = {
  publicId: '550e8400-e29b-41d4-a716-446655440000',
  displayName: 'Holly',
  requestText:
    'Please Santa bring me a telescope with a supercalifragilisticexpialidociouswinterwraparoundlens.',
  decision: 'approved',
  santaResponse: 'VERY WELL. SANTA COMMANDS IT!',
  createdAt: '2026-07-18T12:00:00.000Z',
};

describe('share image text shaping', () => {
  it('normalizes control characters and line breaks into safe plain text', () => {
    expect(
      normalizeShareImageText('Holly\tasked\r\nfor\u0007 a\n\nbrass telescope'),
    ).toBe('Holly asked for a brass telescope');
  });

  it('strips bidirectional controls without removing ordinary unicode text', () => {
    expect(normalizeShareImageText('Holly \u202Easked 🎁 北極')).toBe(
      'Holly asked 🎁 北極',
    );
  });

  it('wraps long unbroken strings deterministically within the requested limit', () => {
    const lines = wrapShareImageText('northpole'.repeat(6), {
      maxCharsPerLine: 12,
      maxLines: 3,
    });

    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines.every((line) => Array.from(line).length <= 12)).toBe(true);
    expect(lines.at(-1)).toContain('...');
  });

  it('prepares hidden previews without leaking raw control characters', () => {
    const prepared = prepareRulingShareImage(
      {
        ...approvedRuling,
        displayName: 'Ho\u0000lly',
        santaResponse: 'KEEP\r\nCALM\tAND\tMERRY',
      },
      {
        visibility: 'hidden',
      },
    );

    expect(prepared.visibility).toBe('hidden');
    expect(prepared.displayName.text).toBe('Holly');
    expect(prepared.santaResponse.text).toBe('KEEP CALM AND MERRY');
  });
});

describe('share image treatment and responses', () => {
  it('uses distinct copy for approved and coal treatments', () => {
    expect(selectShareImageTreatment('approved')).toMatchObject({
      headline: 'SANTA COMMANDS IT!',
      decisionLabel: 'APPROVED BY SANTA',
    });
    expect(selectShareImageTreatment('random-coal')).toMatchObject({
      headline: 'COAL',
      decisionLabel: 'SANTA CHOSE COAL',
    });
  });

  it('renders png responses with a short shared cache policy', async () => {
    const response = await renderRulingShareImage(approvedRuling, {
      visibility: 'public',
      cacheControl: RULING_SHARE_IMAGE_PUBLIC_CACHE_CONTROL,
    });

    expect(response.headers.get('content-type')).toContain('image/png');
    expect(response.headers.get('cache-control')).toBe(
      RULING_SHARE_IMAGE_PUBLIC_CACHE_CONTROL,
    );
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');

    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(bytes.slice(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
  });

  it('keeps error responses out of caches and out of image/png mime types', () => {
    const response = buildShareImageErrorResponse(
      404,
      'Share image unavailable.',
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe(
      RULING_SHARE_IMAGE_PRIVATE_CACHE_CONTROL,
    );
    expect(response.headers.get('content-type')).toContain('text/plain');
  });
});
