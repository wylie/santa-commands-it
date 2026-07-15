import { describe, expect, it } from 'vitest';

import type { ModerationRules } from '@/config/moderation';
import { REQUEST_LIMITS } from '@/config/request';
import {
  formatCharacterCount,
  getCharacterCountState,
} from '@/utils/characterCount';
import {
  isBlockedByModeration,
  normalizeForModeration,
} from '@/utils/moderation';
import {
  evaluateSantaRequest,
  formatResponseTemplate,
  shouldReceiveCoal,
} from '@/utils/santa-decision';
import { validateName, validateRequest } from '@/utils/validation';

const testModerationRules: ModerationRules = {
  blockedWords: ['blocked-example', 'coal'],
  blockedPhrases: ['coal for my enemy', 'hurt someone'],
  allowedExceptions: ['blocked-example parade'],
};

describe('request limits', () => {
  it('keeps the name limit at 40 characters', () => {
    expect(REQUEST_LIMITS.nameMaxLength).toBe(40);
  });

  it('keeps the request limit at 500 characters', () => {
    expect(REQUEST_LIMITS.requestMaxLength).toBe(500);
  });
});

describe('field validation', () => {
  it('trims and accepts a valid name', () => {
    expect(validateName('  Holly  ', REQUEST_LIMITS.nameMaxLength)).toEqual({
      valid: true,
      value: 'Holly',
    });
  });

  it('rejects a whitespace-only name', () => {
    expect(validateName('   ', REQUEST_LIMITS.nameMaxLength)).toEqual({
      valid: false,
      value: '',
      error: 'Please tell Santa what to call you.',
    });
  });

  it('accepts a name at the 40-character boundary', () => {
    expect(
      validateName(
        'H'.repeat(REQUEST_LIMITS.nameMaxLength),
        REQUEST_LIMITS.nameMaxLength,
      ),
    ).toEqual({
      valid: true,
      value: 'H'.repeat(REQUEST_LIMITS.nameMaxLength),
    });
  });

  it('trims and accepts a valid request', () => {
    expect(
      validateRequest(
        '  A train set please.  ',
        REQUEST_LIMITS.requestMaxLength,
      ),
    ).toEqual({
      valid: true,
      value: 'A train set please.',
    });
  });

  it('rejects a whitespace-only request', () => {
    expect(validateRequest(' \n\t ', REQUEST_LIMITS.requestMaxLength)).toEqual({
      valid: false,
      value: '',
      error: 'Please tell Santa what you would like.',
    });
  });

  it('accepts a request at the 500-character boundary', () => {
    expect(
      validateRequest(
        'R'.repeat(REQUEST_LIMITS.requestMaxLength),
        REQUEST_LIMITS.requestMaxLength,
      ),
    ).toEqual({
      valid: true,
      value: 'R'.repeat(REQUEST_LIMITS.requestMaxLength),
    });
  });
});

describe('character counter', () => {
  it('formats the visible request counter', () => {
    expect(formatCharacterCount(0, 500)).toBe('0 / 500');
    expect(formatCharacterCount(128, 500)).toBe('128 / 500');
  });

  it('adds warning and limit labels near the maximum', () => {
    expect(formatCharacterCount(450, 500)).toBe('450 / 500 - nearly full');
    expect(formatCharacterCount(500, 500)).toBe('500 / 500 - limit reached');
    expect(formatCharacterCount(700, 500)).toBe('500 / 500 - limit reached');
  });

  it('reports normal, warning, and limit states', () => {
    expect(getCharacterCountState(449, 500)).toBe('normal');
    expect(getCharacterCountState(450, 500)).toBe('warning');
    expect(getCharacterCountState(500, 500)).toBe('limit');
  });
});

describe('moderation normalization', () => {
  it('lowercases, trims, and collapses repeated whitespace', () => {
    expect(normalizeForModeration('  HELLO   THERE  ')).toBe('hello there');
  });

  it('normalizes accented characters without changing the original display text', () => {
    const original = '  Café Noël  ';

    expect(normalizeForModeration(original)).toBe('cafe noel');
    expect(original).toBe('  Café Noël  ');
  });

  it('detects blocked words separated by punctuation', () => {
    const rules: ModerationRules = {
      blockedWords: ['blockedexample'],
      blockedPhrases: [],
      allowedExceptions: [],
    };

    expect(isBlockedByModeration('blocked...example', rules)).toBe(true);
  });
});

describe('moderation matching', () => {
  it('matches a blocked standalone word case-insensitively', () => {
    expect(
      isBlockedByModeration('Please BLOCKED-example now', testModerationRules),
    ).toBe(true);
  });

  it('matches a blocked phrase in the request', () => {
    expect(
      isBlockedByModeration(
        'Could Santa arrange coal for my enemy?',
        testModerationRules,
      ),
    ).toBe(true);
  });

  it('matches blocked content in the name field', () => {
    const decision = evaluateSantaRequest({
      name: 'blocked-example',
      request: 'A sled, please.',
      moderation: testModerationRules,
      randomValue: 0,
      templateValue: 0,
    });

    expect(decision).toMatchObject({
      type: 'blocked',
      field: 'name',
    });
  });

  it('matches blocked content in the request field', () => {
    const decision = evaluateSantaRequest({
      name: 'Holly',
      request: 'Please hurt someone with my gift.',
      moderation: testModerationRules,
      randomValue: 0,
      templateValue: 0,
    });

    expect(decision).toMatchObject({
      type: 'blocked',
      field: 'request',
    });
  });

  it('returns a blocked decision when both fields are blocked', () => {
    const decision = evaluateSantaRequest({
      name: 'blocked-example',
      request: 'Please arrange coal for my enemy.',
      moderation: testModerationRules,
      randomValue: 0,
      templateValue: 0.8,
    });

    expect(decision).toMatchObject({
      type: 'blocked',
      field: 'both',
    });
    expect(decision.response.title).toBe(
      'THAT IS UNACCEPTABLE. ASK FOR SOMETHING ELSE OR RECEIVE COAL!',
    );
  });

  it('does not match an innocent longer word when only the short standalone word is blocked', () => {
    expect(
      isBlockedByModeration('A coalition of elves', testModerationRules),
    ).toBe(false);
  });

  it('allows an approved exception that would otherwise false-positive', () => {
    expect(
      isBlockedByModeration(
        'The blocked-example parade was delightful.',
        testModerationRules,
      ),
    ).toBe(false);
  });

  it('still blocks separate unsafe content even when an exception phrase is present', () => {
    expect(
      isBlockedByModeration(
        'The blocked-example parade was delightful, but please hurt someone.',
        testModerationRules,
      ),
    ).toBe(true);
  });

  it('treats whitespace-only input as a validation problem rather than a moderation match', () => {
    expect(isBlockedByModeration('   ', testModerationRules)).toBe(false);
    expect(validateRequest('   ', REQUEST_LIMITS.requestMaxLength).valid).toBe(
      false,
    );
  });
});

describe('random coal calculation', () => {
  it('never returns coal at 0 percent', () => {
    expect(shouldReceiveCoal(0, 0)).toBe(false);
    expect(shouldReceiveCoal(0, 0.99)).toBe(false);
  });

  it('always returns coal at 100 percent', () => {
    expect(shouldReceiveCoal(100, 0)).toBe(true);
    expect(shouldReceiveCoal(100, 0.99)).toBe(true);
  });

  it('uses deterministic boundary behavior at 5 percent', () => {
    expect(shouldReceiveCoal(5, 0.049)).toBe(true);
    expect(shouldReceiveCoal(5, 0.05)).toBe(false);
  });

  it('never returns coal when the feature is disabled', () => {
    expect(shouldReceiveCoal(5, 0, false)).toBe(false);
  });

  it('rejects invalid percentages', () => {
    expect(() => shouldReceiveCoal(-1, 0.2)).toThrow(
      'Random coal percentage must be between 0 and 100.',
    );
    expect(() => shouldReceiveCoal(101, 0.2)).toThrow(
      'Random coal percentage must be between 0 and 100.',
    );
  });
});

describe('decision engine', () => {
  it('produces approval when moderation passes and the coal roll fails', () => {
    const decision = evaluateSantaRequest({
      name: 'Holly',
      request: 'A brass telescope.',
      moderation: testModerationRules,
      randomValue: 0.5,
      templateValue: 0,
    });

    expect(decision.type).toBe('approved');
  });

  it('produces coal when moderation passes and the coal roll succeeds', () => {
    const decision = evaluateSantaRequest({
      name: 'Holly',
      request: 'A brass telescope.',
      moderation: testModerationRules,
      randomValue: 0.01,
      templateValue: 0,
    });

    expect(decision.type).toBe('random-coal');
  });

  it('runs blocked moderation before the coal decision', () => {
    const decision = evaluateSantaRequest({
      name: 'Holly',
      request: 'Please hurt someone with this gift.',
      moderation: testModerationRules,
      randomValue: 0,
      templateValue: 0,
    });

    expect(decision).toMatchObject({
      type: 'blocked',
      field: 'request',
    });
  });

  it('formats response templates with safe plain-text substitutions', () => {
    expect(
      formatResponseTemplate('Very well, {name}: {request}', {
        name: '<Holly>',
        request: '<img src=x onerror=alert(1)>',
      }),
    ).toBe('Very well, <Holly>: <img src=x onerror=alert(1)>');
  });
});
