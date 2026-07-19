import { afterEach, describe, expect, it } from 'vitest';

import { createTestRulingReportsRepository } from '@/server/reports/repository';
import { createTestSubmissionRepository } from '@/server/submissions/repository';
import { clearTestRunStore, getTestRunStore } from '@/server/testing/store';
import {
  buildDashboardTimeWindow,
  getWorkshopDashboardPageData,
} from '@/server/workshop/dashboard';

afterEach(() => {
  clearTestRunStore();
});

describe('workshop dashboard date windows', () => {
  it('builds stable UTC boundaries for the default 30 day range', () => {
    const window = buildDashboardTimeWindow(
      '30d',
      'UTC',
      new Date('2026-07-18T15:30:00.000Z'),
    );

    expect(window.currentStart?.toISOString()).toBe('2026-06-19T00:00:00.000Z');
    expect(window.currentEnd.toISOString()).toBe('2026-07-19T00:00:00.000Z');
    expect(window.previousStart?.toISOString()).toBe(
      '2026-05-20T00:00:00.000Z',
    );
    expect(window.previousEnd?.toISOString()).toBe('2026-06-19T00:00:00.000Z');
  });
});

describe('workshop dashboard data', () => {
  it('summarizes selected-range rulings, reports, trend buckets, and configuration counts', async () => {
    const runId = 'dashboard-range-summary';
    const headers = new Headers({
      'x-santa-test-run-id': runId,
      'x-santa-test-now': '2026-07-18T12:00:00.000Z',
    });
    const submissionRepository = createTestSubmissionRepository(runId);
    const reportsRepository = createTestRulingReportsRepository(runId);

    await submissionRepository.createRulingWithIdempotency({
      publicId: '00000000-0000-4000-8000-000000000001',
      displayName: 'Holly',
      requestText: 'A brass telescope',
      decision: 'approved',
      santaResponse: 'VERY WELL, Holly.',
      createdAt: new Date('2026-07-18T08:00:00.000Z'),
      clientKeyHash: 'client-a',
      idempotencyKey: '11111111-1111-4111-8111-111111111111',
      normalizedName: 'holly',
      normalizedRequest: 'a brass telescope',
      expiresAt: new Date('2026-07-25T12:00:00.000Z'),
    });
    await submissionRepository.createRulingWithIdempotency({
      publicId: '00000000-0000-4000-8000-000000000002',
      displayName: 'Juniper',
      requestText: 'A moonlit observatory',
      decision: 'random-coal',
      santaResponse: 'NO, Juniper.',
      createdAt: new Date('2026-07-16T08:00:00.000Z'),
      clientKeyHash: 'client-b',
      idempotencyKey: '22222222-2222-4222-8222-222222222222',
      normalizedName: 'juniper',
      normalizedRequest: 'a moonlit observatory',
      expiresAt: new Date('2026-07-25T12:00:00.000Z'),
    });
    await submissionRepository.createRulingWithIdempotency({
      publicId: '00000000-0000-4000-8000-000000000003',
      displayName: 'Peppermint',
      requestText: 'A train conductor set',
      decision: 'approved',
      santaResponse: 'VERY WELL, Peppermint.',
      createdAt: new Date('2026-06-21T08:00:00.000Z'),
      clientKeyHash: 'client-c',
      idempotencyKey: '33333333-3333-4333-8333-333333333333',
      normalizedName: 'peppermint',
      normalizedRequest: 'a train conductor set',
      expiresAt: new Date('2026-07-25T12:00:00.000Z'),
    });
    await submissionRepository.createRulingWithIdempotency({
      publicId: '00000000-0000-4000-8000-000000000004',
      displayName: 'Mistletoe',
      requestText: 'A weather vane',
      decision: 'approved',
      santaResponse: 'VERY WELL, Mistletoe.',
      createdAt: new Date('2026-04-05T08:00:00.000Z'),
      clientKeyHash: 'client-d',
      idempotencyKey: '44444444-4444-4444-8444-444444444444',
      normalizedName: 'mistletoe',
      normalizedRequest: 'a weather vane',
      expiresAt: new Date('2026-07-25T12:00:00.000Z'),
    });

    const store = getTestRunStore(runId);
    const hiddenRuling = store.rulings.find(
      (ruling) => ruling.publicId === '00000000-0000-4000-8000-000000000003',
    );

    if (!hiddenRuling) {
      throw new Error('Expected hidden ruling fixture.');
    }

    hiddenRuling.visibility = 'hidden';
    hiddenRuling.hiddenAt = '2026-06-22T10:00:00.000Z';
    const featuredRuling = store.rulings.find(
      (ruling) => ruling.publicId === '00000000-0000-4000-8000-000000000001',
    );

    if (!featuredRuling) {
      throw new Error('Expected featured ruling fixture.');
    }

    featuredRuling.isFeatured = true;
    featuredRuling.featuredAt = '2026-07-18T10:00:00.000Z';
    store.ownerActivity.push(
      {
        id: 1,
        action: 'ruling-featured',
        targetType: 'ruling',
        targetPublicId: featuredRuling.publicId,
        relatedPublicId: null,
        details: null,
        createdAt: '2026-07-18T10:00:00.000Z',
      },
      {
        id: 2,
        action: 'ruling-unfeatured',
        targetType: 'ruling',
        targetPublicId: '00000000-0000-4000-8000-000000000002',
        relatedPublicId: null,
        details: null,
        createdAt: '2026-07-17T10:00:00.000Z',
      },
    );

    await reportsRepository.createReport({
      rulingId: 1,
      clientKeyHash: 'reporter-a',
      reason: 'spam',
      note: 'Open report one',
      createdAt: new Date('2026-07-18T09:00:00.000Z'),
    });
    await reportsRepository.createReport({
      rulingId: 1,
      clientKeyHash: 'reporter-b',
      reason: 'hate',
      note: 'Open report two',
      createdAt: new Date('2026-07-17T09:00:00.000Z'),
    });
    await reportsRepository.createReport({
      rulingId: 3,
      clientKeyHash: 'reporter-c',
      reason: 'other',
      note: 'Dismissed report',
      createdAt: new Date('2026-07-10T09:00:00.000Z'),
    });

    const dismissedReport = store.reports.find(
      (report) => report.clientKeyHash === 'reporter-c',
    );

    if (!dismissedReport) {
      throw new Error('Expected dismissed report fixture.');
    }

    dismissedReport.status = 'dismissed';
    dismissedReport.reviewedAt = '2026-07-11T09:00:00.000Z';
    dismissedReport.resolvedAt = '2026-07-12T09:00:00.000Z';

    store.moderationRules[0]!.active = false;
    store.responseTemplates[0]!.active = false;
    store.santaSettings.randomCoalPercentage = 35;
    store.santaSettings.updatedAt = '2026-07-17T12:00:00.000Z';

    const dashboard = await getWorkshopDashboardPageData(
      headers,
      new URL('http://localhost/workshop?range=30d'),
    );

    expect(dashboard.range).toBe('30d');
    expect(dashboard.timeZone).toBe('UTC');
    expect(dashboard.overview.status).toBe('ready');
    expect(dashboard.trend.status).toBe('ready');
    expect(dashboard.reports.status).toBe('ready');
    expect(dashboard.configuration.status).toBe('ready');
    expect(dashboard.health.status).toBe('ready');

    if (
      dashboard.overview.status !== 'ready' ||
      dashboard.trend.status !== 'ready' ||
      dashboard.reports.status !== 'ready' ||
      dashboard.configuration.status !== 'ready' ||
      dashboard.health.status !== 'ready'
    ) {
      throw new Error('Expected ready dashboard sections.');
    }

    expect(
      dashboard.overview.data.primaryMetrics.map((metric) => [
        metric.label,
        metric.value,
      ]),
    ).toEqual([
      ['Total rulings', 3],
      ['Approved rulings', 2],
      ['Coal rulings', 1],
      ['Public rulings', 2],
      ['Hidden rulings', 1],
      ['Featured Commands', 1],
      ['Open reports', 2],
    ]);
    expect(dashboard.overview.data.coalSummary.configuredCoalPercentage).toBe(
      35,
    );
    expect(
      dashboard.overview.data.coalSummary.actualCoalPercentage,
    ).toBeCloseTo(33.333, 2);
    expect(dashboard.reports.data).toMatchObject({
      currentOpenReports: 2,
      currentReviewedReports: 0,
      reportsCreatedInRange: 3,
      reportsDismissedInRange: 1,
      reportsActionedInRange: 0,
      rulingsWithMultipleOpenReports: 1,
    });
    expect(dashboard.configuration.data.moderation.inactiveRules).toBe(1);
    expect(dashboard.configuration.data.templates.inactiveTemplates).toBe(1);
    expect(dashboard.recentFeaturedActivity.status).toBe('ready');
    if (dashboard.recentFeaturedActivity.status !== 'ready') {
      throw new Error('Expected featured activity to be ready.');
    }
    expect(dashboard.recentFeaturedActivity.data).toMatchObject([
      {
        label: 'Ruling featured',
        targetReference: featuredRuling.publicId,
      },
      {
        label: 'Ruling unfeatured',
      },
    ]);
    expect(
      dashboard.health.data.checks.find(
        (check) => check.label === 'Santa artwork asset',
      ),
    ).toMatchObject({
      status: 'healthy',
      detail:
        'The canonical public Santa artwork exists at /images/santa-solo.png and is PNG image data.',
    });
    expect(dashboard.trend.data).toHaveLength(30);
    expect(
      dashboard.trend.data.find((point) => point.bucketKey === '2026-07-17'),
    ).toMatchObject({
      totalRulings: 0,
      approvedRulings: 0,
      coalRulings: 0,
    });
    expect(
      dashboard.trend.data.find((point) => point.bucketKey === '2026-07-18'),
    ).toMatchObject({
      totalRulings: 1,
      approvedRulings: 1,
      coalRulings: 0,
    });
  });

  it('keeps the rest of the dashboard usable when one section fails', async () => {
    const runId = 'dashboard-section-failure';
    const headers = new Headers({
      'x-santa-test-run-id': runId,
      'x-santa-test-now': '2026-07-18T12:00:00.000Z',
      'x-santa-test-dashboard-failure': 'trend',
    });
    const submissionRepository = createTestSubmissionRepository(runId);

    await submissionRepository.createRulingWithIdempotency({
      publicId: '00000000-0000-4000-8000-000000000101',
      displayName: 'Tinsel',
      requestText: 'A sled bell',
      decision: 'approved',
      santaResponse: 'VERY WELL, Tinsel.',
      createdAt: new Date('2026-07-18T08:00:00.000Z'),
      clientKeyHash: 'client-z',
      idempotencyKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      normalizedName: 'tinsel',
      normalizedRequest: 'a sled bell',
      expiresAt: new Date('2026-07-25T12:00:00.000Z'),
    });

    const dashboard = await getWorkshopDashboardPageData(
      headers,
      new URL('http://localhost/workshop?range=30d'),
    );

    expect(dashboard.overview.status).toBe('ready');
    expect(dashboard.trend).toEqual({
      status: 'unavailable',
      message: 'This section is temporarily unavailable.',
    });
    expect(dashboard.warningMessages.join(' ')).toContain(
      'trend is temporarily unavailable',
    );
  });
});
