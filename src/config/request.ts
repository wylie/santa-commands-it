export const REQUEST_LIMITS = {
  nameMaxLength: 40,
  requestMaxLength: 500,
} as const;

export type RequestLimits = typeof REQUEST_LIMITS;
