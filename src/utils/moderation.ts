import type { ModerationRules } from '@/config/moderation';

function stripCombiningMarks(value: string): string {
  return value.normalize('NFKD').replace(/\p{Mark}+/gu, '');
}

function lowercaseNormalized(value: string): string {
  return stripCombiningMarks(value).toLocaleLowerCase();
}

export function normalizeForModeration(value: string): string {
  return lowercaseNormalized(value).trim().replace(/\s+/g, ' ');
}

function escapePattern(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenizeForPhrases(value: string): string[] {
  return normalizeForModeration(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function compactWhitespaceSegments(value: string): string[] {
  return normalizeForModeration(value)
    .split(/\s+/)
    .map((segment) => segment.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter(Boolean);
}

function matchesBlockedWord(value: string, blockedWord: string): boolean {
  const blockedCompact = blockedWord.replace(/[^\p{L}\p{N}]+/gu, '');

  if (!blockedCompact) {
    return false;
  }

  const phraseTokens = tokenizeForPhrases(value);
  const compactSegments = compactWhitespaceSegments(value);

  return (
    phraseTokens.includes(blockedCompact) ||
    compactSegments.includes(blockedCompact)
  );
}

function matchesBlockedPhrase(value: string, blockedPhrase: string): boolean {
  const phraseTokens = tokenizeForPhrases(value);
  const blockedTokens = tokenizeForPhrases(blockedPhrase);

  if (!blockedTokens.length || phraseTokens.length < blockedTokens.length) {
    return false;
  }

  for (
    let index = 0;
    index <= phraseTokens.length - blockedTokens.length;
    index += 1
  ) {
    const candidate = phraseTokens.slice(index, index + blockedTokens.length);

    if (candidate.join(' ') === blockedTokens.join(' ')) {
      return true;
    }
  }

  return false;
}

function matchesException(value: string, exception: string): boolean {
  return exception.includes(' ')
    ? matchesBlockedPhrase(value, exception)
    : matchesBlockedWord(value, exception);
}

function stripAllowedExceptions(
  value: string,
  exceptions: readonly string[],
): string {
  return exceptions.reduce((currentValue, exception) => {
    if (!matchesException(currentValue, exception)) {
      return currentValue;
    }

    const exceptionTokens = tokenizeForPhrases(exception);

    if (!exceptionTokens.length) {
      return currentValue;
    }

    const pattern = new RegExp(
      exceptionTokens.map(escapePattern).join('[^\\p{L}\\p{N}]+'),
      'gu',
    );

    return currentValue.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
  }, normalizeForModeration(value));
}

export function isBlockedByModeration(
  value: string,
  rules: ModerationRules,
): boolean {
  const normalizedValue = normalizeForModeration(value);

  if (!normalizedValue) {
    return false;
  }

  const sanitizedValue = stripAllowedExceptions(
    normalizedValue,
    rules.allowedExceptions,
  );

  return (
    rules.blockedWords.some((blockedWord) =>
      matchesBlockedWord(sanitizedValue, blockedWord),
    ) ||
    rules.blockedPhrases.some((blockedPhrase) =>
      matchesBlockedPhrase(sanitizedValue, blockedPhrase),
    )
  );
}
