import { describe, expect, it } from 'vitest';

import { REQUEST_LIMITS } from '@/config/request';
import { formatCharacterCount } from '@/utils/characterCount';

describe('request limits', () => {
  it('keeps the name limit at 40 characters', () => {
    expect(REQUEST_LIMITS.nameMaxLength).toBe(40);
  });

  it('keeps the request limit at 500 characters', () => {
    expect(REQUEST_LIMITS.requestMaxLength).toBe(500);
  });
});

describe('formatCharacterCount', () => {
  it('formats the visible request counter', () => {
    expect(formatCharacterCount(0, 500)).toBe('0 / 500');
    expect(formatCharacterCount(128, 500)).toBe('128 / 500');
  });
});
