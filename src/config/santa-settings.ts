export const santaSettings = {
  randomCoalEnabled: true,
  randomCoalPercentage: 5,
  consideringDelay: {
    minimum: 900,
    maximum: 1400,
  },
  limits: {
    name: 40,
    request: 500,
  },
} as const;

export function assertCoalPercentage(percentage: number): number {
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new Error('Random coal percentage must be between 0 and 100.');
  }

  return percentage;
}

export function assertRandomValue(randomValue: number): number {
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new Error(
      'Random values must be between 0 inclusive and 1 exclusive.',
    );
  }

  return randomValue;
}

export function getConsideringDelay(
  randomValue: number,
  settings = santaSettings,
): number {
  assertRandomValue(randomValue);

  const minimum = Number(settings.consideringDelay.minimum);
  const maximum = Number(settings.consideringDelay.maximum);

  if (maximum < minimum) {
    throw new Error(
      'Considering delay maximum must be greater than or equal to minimum.',
    );
  }

  if (maximum === minimum) {
    return minimum;
  }

  return Math.round(minimum + (maximum - minimum) * randomValue);
}
