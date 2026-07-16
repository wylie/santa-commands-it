function assertPositiveInteger(value: number, message: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(message);
  }

  return value;
}

export const securitySettings = {
  submissions: {
    rateLimits: {
      shortWindow: {
        maxAttempts: 5,
        windowMs: 10 * 60 * 1000,
      },
      dailyWindow: {
        maxAttempts: 20,
        windowMs: 24 * 60 * 60 * 1000,
      },
    },
    duplicateWindowMs: 60 * 1000,
    minimumCompletionTimeMs: 1000,
    bodyLimitBytes: 12 * 1024,
    idempotency: {
      maxKeyLength: 64,
      retentionMs: 7 * 24 * 60 * 60 * 1000,
    },
  },
  reports: {
    noteMaxLength: 300,
    bodyLimitBytes: 6 * 1024,
    rateLimits: {
      hourlyWindow: {
        maxAttempts: 5,
        windowMs: 60 * 60 * 1000,
      },
      perRulingWindow: {
        maxAttempts: 1,
        windowMs: 24 * 60 * 60 * 1000,
      },
    },
  },
} as const;

export function validateSecuritySettings(): void {
  assertPositiveInteger(
    securitySettings.submissions.rateLimits.shortWindow.maxAttempts,
    'Submission short-window rate limit must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.submissions.rateLimits.shortWindow.windowMs,
    'Submission short-window duration must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.submissions.rateLimits.dailyWindow.maxAttempts,
    'Submission daily rate limit must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.submissions.rateLimits.dailyWindow.windowMs,
    'Submission daily duration must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.submissions.duplicateWindowMs,
    'Submission duplicate window must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.submissions.minimumCompletionTimeMs,
    'Submission minimum completion time must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.submissions.bodyLimitBytes,
    'Submission body limit must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.submissions.idempotency.maxKeyLength,
    'Idempotency key limit must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.submissions.idempotency.retentionMs,
    'Idempotency retention must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.reports.noteMaxLength,
    'Report note limit must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.reports.bodyLimitBytes,
    'Report body limit must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.reports.rateLimits.hourlyWindow.maxAttempts,
    'Report hourly rate limit must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.reports.rateLimits.hourlyWindow.windowMs,
    'Report hourly duration must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.reports.rateLimits.perRulingWindow.maxAttempts,
    'Per-ruling report rate limit must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.reports.rateLimits.perRulingWindow.windowMs,
    'Per-ruling report duration must be a positive integer.',
  );
}

validateSecuritySettings();
