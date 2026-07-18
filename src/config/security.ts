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
  workshop: {
    search: {
      maxQueryLength: 120,
      pageSize: 25,
      recentActivityLimit: 10,
      recentRulingsLimit: 5,
      relatedReportsLimit: 20,
    },
    configuration: {
      ruleValueMaxLength: 200,
      responseTemplateMaxLength: 500,
      testerInputMaxLength: 500,
      cacheTtlMs: 30 * 1000,
    },
    auth: {
      sessionDurationMs: 12 * 60 * 60 * 1000,
      failedLoginMessage:
        'Santa cannot open the workshop with those credentials.',
      rateLimitMessage:
        'Workshop access is temporarily limited. Please try again later.',
      deleteConfirmationPhrase: 'DELETE',
      loginRateLimit: {
        maxAttempts: 5,
        windowMs: 15 * 60 * 1000,
      },
    },
    hideReasonMaxLength: 300,
    resolutionNoteMaxLength: 500,
    formBodyLimitBytes: 10 * 1024,
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
  assertPositiveInteger(
    securitySettings.workshop.search.maxQueryLength,
    'Workshop search query limit must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.workshop.search.pageSize,
    'Workshop page size must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.workshop.search.recentActivityLimit,
    'Workshop recent activity limit must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.workshop.search.recentRulingsLimit,
    'Workshop recent rulings limit must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.workshop.search.relatedReportsLimit,
    'Workshop related-reports limit must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.workshop.configuration.ruleValueMaxLength,
    'Workshop rule value limit must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.workshop.configuration.responseTemplateMaxLength,
    'Workshop response-template limit must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.workshop.configuration.testerInputMaxLength,
    'Workshop moderation-tester input limit must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.workshop.configuration.cacheTtlMs,
    'Workshop configuration cache TTL must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.workshop.auth.sessionDurationMs,
    'Workshop session duration must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.workshop.auth.loginRateLimit.maxAttempts,
    'Workshop login max attempts must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.workshop.auth.loginRateLimit.windowMs,
    'Workshop login rate-limit window must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.workshop.hideReasonMaxLength,
    'Workshop hide-reason limit must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.workshop.resolutionNoteMaxLength,
    'Workshop resolution-note limit must be a positive integer.',
  );
  assertPositiveInteger(
    securitySettings.workshop.formBodyLimitBytes,
    'Workshop form body limit must be a positive integer.',
  );
}

validateSecuritySettings();
