const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export function normalizeForDuplicateComparison(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function isValidIdempotencyKey(
  value: string,
  maximumLength: number,
): boolean {
  return value.length <= maximumLength && IDEMPOTENCY_KEY_PATTERN.test(value);
}
