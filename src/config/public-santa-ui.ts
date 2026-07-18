export const publicSantaUiSettings = {
  consideringDelay: {
    minimum: 900,
    maximum: 1400,
  },
  limits: {
    name: 40,
    request: 500,
  },
  recentRulings: {
    visibleLimit: 10,
    timeZone: 'America/New_York',
  },
  network: {
    requestTimeoutMs: 12000,
  },
} as const;
