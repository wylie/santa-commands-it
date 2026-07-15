export type CharacterCountState = 'normal' | 'warning' | 'limit';

export function clampCharacterCount(count: number, maximum: number): number {
  return Math.min(Math.max(count, 0), maximum);
}

export function getCharacterCountState(
  count: number,
  maximum: number,
  warningThreshold = maximum - 50,
): CharacterCountState {
  const clampedCount = clampCharacterCount(count, maximum);

  if (clampedCount >= maximum) {
    return 'limit';
  }

  if (clampedCount >= warningThreshold) {
    return 'warning';
  }

  return 'normal';
}

export function formatCharacterCount(count: number, maximum: number): string {
  const clampedCount = clampCharacterCount(count, maximum);
  const state = getCharacterCountState(clampedCount, maximum);
  const baseCount = `${clampedCount} / ${maximum}`;

  if (state === 'warning') {
    return `${baseCount} - nearly full`;
  }

  if (state === 'limit') {
    return `${baseCount} - limit reached`;
  }

  return baseCount;
}
