import { publicSantaUiSettings } from '@/config/public-santa-ui';
import { configurationSeedDefaults } from '@/utils/configuration';

export const santaSettings = {
  randomCoalEnabled: configurationSeedDefaults.santaSettings.randomCoalEnabled,
  randomCoalPercentage:
    configurationSeedDefaults.santaSettings.randomCoalPercentage,
  ...publicSantaUiSettings,
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
