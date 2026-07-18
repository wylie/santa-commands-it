import { publicSantaUiSettings } from '@/config/public-santa-ui';

export const REQUEST_LIMITS = {
  nameMaxLength: publicSantaUiSettings.limits.name,
  requestMaxLength: publicSantaUiSettings.limits.request,
} as const;

export type RequestLimits = typeof REQUEST_LIMITS;
