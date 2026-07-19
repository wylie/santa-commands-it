import { afterEach, describe, expect, it } from 'vitest';

import { createTestRulingReportsRepository } from '@/server/reports/repository';
import { createTestRulingsRepository } from '@/server/rulings/test-repository';
import { getTestRunStore, clearTestRunStore } from '@/server/testing/store';
import {
  getWorkshopReportDetailData,
  getWorkshopReportsPageState,
  getWorkshopReportsPageData,
  getWorkshopRulingDetailData,
  hideWorkshopRulingFromReport,
  transitionWorkshopReport,
} from '@/server/workshop/service';

afterEach(() => {
  clearTestRunStore();
});

function createWorkshopHeaders(runId: string) {
  return new Headers({
    'x-santa-test-run-id': runId,
  });
}

async function seedRuling(runId: string) {
  const publicRepository = createTestRulingsRepository(runId);

  await publicRepository.createRuling({
    publicId: '550e8400-e29b-41d4-a716-446655440000',
    displayName: 'Holly',
    requestText: 'A brass telescope',
    decision: 'approved',
    santaResponse: 'VERY WELL, Holly.',
  });
}

async function seedReport(
  runId: string,
  input: {
    clientKeyHash: string;
    reason: 'spam' | 'hate' | 'bullying' | 'other';
    note?: string;
  },
) {
  const reportsRepository = createTestRulingReportsRepository(runId);

  await reportsRepository.createReport({
    rulingId: 1,
    clientKeyHash: input.clientKeyHash,
    reason: input.reason,
    note: input.note ?? '',
  });

  return getTestRunStore(runId).reports.at(-1);
}

describe('workshop report moderation workflow', () => {
  it('reviews, dismisses, reopens, and actions a report while recording owner activity', async () => {
    const runId = 'workshop-report-transitions';
    const headers = createWorkshopHeaders(runId);
    await seedRuling(runId);
    const seededReport = await seedReport(runId, {
      clientKeyHash: 'client-a',
      reason: 'spam',
      note: 'Looks suspicious.',
    });

    expect(seededReport?.publicId).toMatch(/^report_/);

    const reviewed = await transitionWorkshopReport({
      publicId: seededReport?.publicId ?? '',
      action: 'review',
      headers,
      now: new Date('2026-07-17T12:00:00.000Z'),
    });
    const dismissed = await transitionWorkshopReport({
      publicId: seededReport?.publicId ?? '',
      action: 'dismiss',
      resolutionNote: 'No issue found.',
      headers,
      now: new Date('2026-07-17T12:05:00.000Z'),
    });
    const reopened = await transitionWorkshopReport({
      publicId: seededReport?.publicId ?? '',
      action: 'reopen',
      headers,
      now: new Date('2026-07-17T12:10:00.000Z'),
    });
    const actioned = await transitionWorkshopReport({
      publicId: seededReport?.publicId ?? '',
      action: 'action',
      resolutionNote: 'Escalated for moderation recordkeeping.',
      headers,
      now: new Date('2026-07-17T12:15:00.000Z'),
    });

    expect(reviewed).toMatchObject({
      status: 'success',
      report: {
        status: 'reviewed',
      },
    });
    expect(dismissed).toMatchObject({
      status: 'success',
      report: {
        status: 'dismissed',
        resolutionNote: 'No issue found.',
      },
    });
    expect(reopened).toMatchObject({
      status: 'success',
      report: {
        status: 'open',
        resolvedAt: null,
        resolutionNote: null,
      },
    });
    expect(actioned).toMatchObject({
      status: 'success',
      report: {
        status: 'actioned',
        resolutionNote: 'Escalated for moderation recordkeeping.',
      },
    });

    const activity = getTestRunStore(runId).ownerActivity.map((entry) => ({
      action: entry.action,
      targetPublicId: entry.targetPublicId,
      relatedPublicId: entry.relatedPublicId,
      details: entry.details,
    }));

    expect(activity).toEqual([
      {
        action: 'report-actioned',
        targetPublicId: seededReport?.publicId ?? null,
        relatedPublicId: '550e8400-e29b-41d4-a716-446655440000',
        details: 'Escalated for moderation recordkeeping.',
      },
      {
        action: 'report-reopened',
        targetPublicId: seededReport?.publicId ?? null,
        relatedPublicId: '550e8400-e29b-41d4-a716-446655440000',
        details: null,
      },
      {
        action: 'report-dismissed',
        targetPublicId: seededReport?.publicId ?? null,
        relatedPublicId: '550e8400-e29b-41d4-a716-446655440000',
        details: 'No issue found.',
      },
      {
        action: 'report-reviewed',
        targetPublicId: seededReport?.publicId ?? null,
        relatedPublicId: '550e8400-e29b-41d4-a716-446655440000',
        details: null,
      },
    ]);
  });

  it('hides a ruling from a report and actions related open or reviewed reports only', async () => {
    const runId = 'workshop-hide-from-report';
    const headers = createWorkshopHeaders(runId);
    await seedRuling(runId);
    const targetReport = await seedReport(runId, {
      clientKeyHash: 'client-a',
      reason: 'hate',
      note: 'This feels off.',
    });
    const relatedOpen = await seedReport(runId, {
      clientKeyHash: 'client-b',
      reason: 'bullying',
      note: 'Second report.',
    });
    const relatedReviewed = await seedReport(runId, {
      clientKeyHash: 'client-c',
      reason: 'other',
      note: 'Third report.',
    });
    const dismissed = await seedReport(runId, {
      clientKeyHash: 'client-d',
      reason: 'spam',
      note: 'Dismiss me.',
    });

    await transitionWorkshopReport({
      publicId: relatedReviewed?.publicId ?? '',
      action: 'review',
      headers,
      now: new Date('2026-07-17T09:00:00.000Z'),
    });
    await transitionWorkshopReport({
      publicId: dismissed?.publicId ?? '',
      action: 'dismiss',
      resolutionNote: 'Already handled.',
      headers,
      now: new Date('2026-07-17T09:15:00.000Z'),
    });

    const result = await hideWorkshopRulingFromReport({
      publicId: targetReport?.publicId ?? '',
      hideReason: 'Confirmed harmful content.',
      resolutionNote: 'Hide the public ruling and close out the reports.',
      headers,
      now: new Date('2026-07-17T12:30:00.000Z'),
    });

    expect(result).toMatchObject({
      status: 'success',
      relatedActionedCount: 2,
      report: {
        publicId: targetReport?.publicId,
        status: 'actioned',
        rulingVisibility: 'hidden',
        resolutionNote: 'Hide the public ruling and close out the reports.',
      },
    });

    const store = getTestRunStore(runId);
    expect(store.rulings.find((entry) => entry.id === 1)).toMatchObject({
      visibility: 'hidden',
      hiddenReason: 'Confirmed harmful content.',
    });
    expect(
      store.reports.find((entry) => entry.publicId === targetReport?.publicId),
    ).toMatchObject({
      status: 'actioned',
    });
    expect(
      store.reports.find((entry) => entry.publicId === relatedOpen?.publicId),
    ).toMatchObject({
      status: 'actioned',
    });
    expect(
      store.reports.find(
        (entry) => entry.publicId === relatedReviewed?.publicId,
      ),
    ).toMatchObject({
      status: 'actioned',
    });
    expect(
      store.reports.find((entry) => entry.publicId === dismissed?.publicId),
    ).toMatchObject({
      status: 'dismissed',
      resolutionNote: 'Already handled.',
    });

    expect(
      store.ownerActivity.slice(0, 3).map((entry) => entry.action),
    ).toEqual([
      'related-reports-actioned',
      'ruling-hidden-from-report',
      'report-actioned',
    ]);

    const reportDetail = await getWorkshopReportDetailData(
      targetReport?.publicId ?? '',
      headers,
    );
    const rulingDetail = await getWorkshopRulingDetailData(
      '550e8400-e29b-41d4-a716-446655440000',
      headers,
    );

    expect(reportDetail?.relatedReports).toHaveLength(3);
    expect(reportDetail?.activity.map((entry) => entry.action)).toEqual([
      'related-reports-actioned',
      'ruling-hidden-from-report',
      'report-actioned',
    ]);
    expect(rulingDetail?.ruling).toMatchObject({
      visibility: 'hidden',
      reportCount: 4,
      openReportCount: 0,
    });
  });

  it('filters the report queue and exposes ruling report summaries in owner detail data', async () => {
    const runId = 'workshop-report-queue';
    const headers = createWorkshopHeaders(runId);
    await seedRuling(runId);
    const first = await seedReport(runId, {
      clientKeyHash: 'client-a',
      reason: 'spam',
      note: 'First queue item.',
    });
    await seedReport(runId, {
      clientKeyHash: 'client-b',
      reason: 'hate',
      note: 'Second queue item.',
    });

    await transitionWorkshopReport({
      publicId: first?.publicId ?? '',
      action: 'review',
      headers,
      now: new Date('2026-07-17T13:00:00.000Z'),
    });

    const queue = await getWorkshopReportsPageData(
      headers,
      new URLSearchParams('status=reviewed&q=First'),
    );
    const rulingDetail = await getWorkshopRulingDetailData(
      '550e8400-e29b-41d4-a716-446655440000',
      headers,
    );

    expect(queue.total).toBe(1);
    expect(queue.reports[0]).toMatchObject({
      publicId: first?.publicId,
      status: 'reviewed',
      totalReportsForRuling: 2,
      openReportsForRuling: 1,
    });
    expect(rulingDetail?.reports).toHaveLength(2);
    expect(rulingDetail?.reports[0]?.publicId).toMatch(/^report_/);
    expect(rulingDetail?.ruling).toMatchObject({
      reportCount: 2,
      openReportCount: 1,
      latestReportAt: expect.any(String),
    });
  });

  it('returns a private unavailable state instead of throwing when the report queue cannot load', async () => {
    const runId = 'workshop-report-queue-unavailable';
    const headers = new Headers({
      'x-santa-test-run-id': runId,
      'x-santa-test-workshop-reports-failure': 'list',
    });

    const state = await getWorkshopReportsPageState(
      headers,
      new URLSearchParams('q=holiday&page=3'),
    );

    expect(state).toMatchObject({
      status: 'unavailable',
      data: {
        filters: {
          query: 'holiday',
          page: 3,
        },
        reports: [],
        total: 0,
      },
    });
    if (state.status !== 'unavailable') {
      throw new Error('Expected unavailable report queue state.');
    }

    expect(state.message).not.toMatch(/database|sql|stack/i);
  });
});
