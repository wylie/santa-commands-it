import { santaSettings } from '@/config/santa-settings';

export const REQUEST_LIMITS = {
  nameMaxLength: santaSettings.limits.name,
  requestMaxLength: santaSettings.limits.request,
} as const;

export type RequestLimits = typeof REQUEST_LIMITS;
