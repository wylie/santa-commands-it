import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  REQUIRED_BLOCKED_WARNING_TEMPLATE,
  createRuntimeConfigurationService,
  createWorkshopModerationRule,
  createWorkshopResponseTemplate,
  getRuntimeConfigurationForHeaders,
  runWorkshopModerationTester,
  setWorkshopModerationRuleActive,
  setWorkshopResponseTemplateActive,
  updateWorkshopSeasonalSettings,
  updateWorkshopResponseTemplate,
  updateWorkshopSantaSettings,
} from '@/server/config/service';
import { createTestConfigurationRepository } from '@/server/config/repository';
import { createTestSubmissionRepository } from '@/server/submissions/repository';
import { submitSantaRequest } from '@/server/submissions/service';
import { clearTestRunStore, getTestRunStore } from '@/server/testing/store';
import { normalizeModerationRuleValue } from '@/utils/moderation';

afterEach(() => {
  clearTestRunStore();
});

function createWorkshopHeaders(runId = randomUUID()) {
  return new Headers({
    'x-santa-test-run-id': runId,
  });
}

describe('workshop moderation configuration', () => {
  it('normalizes new rules consistently, rejects duplicates, and exposes private tester metadata', async () => {
    const headers = createWorkshopHeaders();

    const created = await createWorkshopModerationRule({
      ruleType: 'blocked-word',
      value: 'Snow-Punch',
      category: 'spam',
      active: true,
      privateNote: 'Added for owner review.',
      headers,
      now: new Date('2026-07-18T10:00:00.000Z'),
    });

    expect(created).toMatchObject({
      status: 'success',
      rule: {
        ruleType: 'blocked-word',
        normalizedValue: 'snowpunch',
        category: 'spam',
        active: true,
      },
    });
    expect(created.status).toBe('success');
    const createdBlockedWordRule =
      created.status === 'success' ? created.rule : null;

    const duplicate = await createWorkshopModerationRule({
      ruleType: 'blocked-word',
      value: '  snow...punch  ',
      category: 'general',
      active: true,
      privateNote: '',
      headers,
      now: new Date('2026-07-18T10:05:00.000Z'),
    });

    expect(duplicate).toMatchObject({
      status: 'duplicate',
      existingRule: {
        publicId: createdBlockedWordRule?.publicId,
      },
    });

    const tester = await runWorkshopModerationTester({
      name: 'Holly',
      request: 'Please snowpunch the sleigh bells.',
      headers,
    });

    expect(tester).toMatchObject({
      status: 'success',
      result: {
        blocked: true,
        focusField: 'request',
        request: {
          blocked: true,
          matchingRule: {
            publicId: createdBlockedWordRule?.publicId,
            ruleType: 'blocked-word',
            category: 'spam',
          },
        },
      },
    });
  });

  it('stops applying inactive moderation rules after cache invalidation', async () => {
    const headers = createWorkshopHeaders();
    const created = await createWorkshopModerationRule({
      ruleType: 'blocked-phrase',
      value: 'launch a blizzard',
      category: 'dangerous-content',
      active: true,
      privateNote: '',
      headers,
      now: new Date('2026-07-18T10:10:00.000Z'),
    });

    expect(created.status).toBe('success');
    const createdBlockedPhraseRule =
      created.status === 'success' ? created.rule : null;

    const beforeDisable = await getRuntimeConfigurationForHeaders(headers);

    expect(
      beforeDisable.activeModerationRules.some(
        (rule) => rule.publicId === createdBlockedPhraseRule?.publicId,
      ),
    ).toBe(true);

    const disabled = await setWorkshopModerationRuleActive({
      publicId: createdBlockedPhraseRule?.publicId ?? '',
      active: false,
      headers,
      now: new Date('2026-07-18T10:15:00.000Z'),
    });

    expect(disabled).toMatchObject({
      status: 'success',
      rule: {
        active: false,
      },
    });

    const tester = await runWorkshopModerationTester({
      name: 'Holly',
      request: 'Please launch a blizzard tonight.',
      headers,
    });
    const afterDisable = await getRuntimeConfigurationForHeaders(headers);

    expect(tester).toMatchObject({
      status: 'success',
      result: {
        blocked: false,
      },
    });
    expect(
      afterDisable.activeModerationRules.some(
        (rule) => rule.publicId === createdBlockedPhraseRule?.publicId,
      ),
    ).toBe(false);
  });
});

describe('runtime configuration cache', () => {
  it('uses ttl-based caching and refreshes after expiry or explicit invalidation', async () => {
    const runId = randomUUID();
    const repository = createTestConfigurationRepository(runId);
    const store = getTestRunStore(runId);
    let now = new Date('2026-07-18T11:00:00.000Z').getTime();
    const service = createRuntimeConfigurationService({
      repository,
      ttlMs: 1_000,
      nowProvider: () => new Date(now),
    });

    const first = await service.getRuntimeConfiguration();

    store.moderationRules.push({
      id: store.moderationRules.length + 1,
      publicId: 'rule_cache-refresh-000000000001',
      ruleType: 'blocked-word',
      value: 'cache-flurry',
      normalizedValue: normalizeModerationRuleValue(
        'blocked-word',
        'cache-flurry',
      ),
      category: 'general',
      privateNote: null,
      active: true,
      createdSource: null,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    });

    now += 500;

    const cached = await service.getRuntimeConfiguration();

    expect(
      cached.activeModerationRules.some(
        (rule) => rule.publicId === 'rule_cache-refresh-000000000001',
      ),
    ).toBe(false);
    expect(cached).toBe(first);

    now += 1_000;

    const refreshed = await service.getRuntimeConfiguration();

    expect(
      refreshed.activeModerationRules.some(
        (rule) => rule.publicId === 'rule_cache-refresh-000000000001',
      ),
    ).toBe(true);

    store.santaSettings.randomCoalPercentage = 77;
    service.invalidate();

    const invalidated = await service.getRuntimeConfiguration();

    expect(invalidated.santaSettings.randomCoalPercentage).toBe(77);
  });
});

describe('workshop Santa settings and response templates', () => {
  it('applies updated random coal settings to future submissions and rejects stale updates', async () => {
    const headers = createWorkshopHeaders();
    const runId = headers.get('x-santa-test-run-id') ?? 'default';
    const submissionRepository = createTestSubmissionRepository(runId);

    const saved = await updateWorkshopSantaSettings({
      expectedVersion: '1',
      randomCoalEnabled: true,
      randomCoalPercentage: '100',
      headers,
      now: new Date('2026-07-18T12:00:00.000Z'),
    });

    expect(saved).toMatchObject({
      status: 'success',
      settings: {
        randomCoalEnabled: true,
        randomCoalPercentage: 100,
        version: 2,
      },
    });

    const stale = await updateWorkshopSantaSettings({
      expectedVersion: '1',
      randomCoalEnabled: false,
      randomCoalPercentage: '0',
      headers,
      now: new Date('2026-07-18T12:05:00.000Z'),
    });

    expect(stale.status).toBe('conflict');

    await submitSantaRequest(
      {
        name: 'Holly',
        request: 'A brass telescope',
        website: '',
        formElapsedMs: 2_000,
      },
      {
        clientKeyHash: 'client-a',
        idempotencyKey: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      {
        submissionRepository,
        loadRuntimeConfiguration: () =>
          getRuntimeConfigurationForHeaders(headers),
        randomProvider: vi
          .fn<() => number>()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(0),
        publicIdGenerator: vi.fn(() => '550e8400-e29b-41d4-a716-446655440000'),
        nowProvider: vi.fn(() => new Date('2026-07-18T12:10:00.000Z')),
        scenario: 'normal',
      },
    );

    expect(getTestRunStore(runId).rulings[0]?.decision).toBe('random-coal');

    const disabled = await updateWorkshopSantaSettings({
      expectedVersion: '2',
      randomCoalEnabled: false,
      randomCoalPercentage: '100',
      headers,
      now: new Date('2026-07-18T12:15:00.000Z'),
    });
    const refreshedConfiguration =
      await getRuntimeConfigurationForHeaders(headers);

    expect(disabled).toMatchObject({
      status: 'success',
      settings: {
        randomCoalEnabled: false,
      },
    });
    expect(refreshedConfiguration.santaSettings.randomCoalEnabled).toBe(false);

    const secondSubmission = await submitSantaRequest(
      {
        name: 'Juniper',
        request: 'A moonlit observatory',
        website: '',
        formElapsedMs: 2_000,
      },
      {
        clientKeyHash: 'client-b',
        idempotencyKey: 'ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      {
        submissionRepository,
        loadRuntimeConfiguration: () =>
          getRuntimeConfigurationForHeaders(headers),
        randomProvider: vi
          .fn<() => number>()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(0),
        publicIdGenerator: vi.fn(() => '3f2504e0-4f89-41d3-9a0c-0305e82c3301'),
        nowProvider: vi.fn(() => new Date('2026-07-18T12:20:00.000Z')),
        scenario: 'normal',
      },
    );

    expect(secondSubmission.status).toBe('created');
    expect(getTestRunStore(runId).rulings[0]?.decision).toBe('approved');
  });

  it('updates and bounds the seasonal public settings', async () => {
    const headers = createWorkshopHeaders();
    const saved = await updateWorkshopSeasonalSettings({
      expectedVersion: '1',
      seasonalMode: 'festive',
      greetingEnabled: true,
      greetingText: '  Merry Christmas from Santa!  ',
      statusEnabled: true,
      statusText: '  The sleigh is nearly ready.  ',
      countdownEnabled: true,
      countdownTargetDate: '2026-12-25',
      countdownLabel: 'UNTIL CHRISTMAS',
      headers,
      now: new Date('2026-07-18T12:00:00.000Z'),
    });

    expect(saved).toMatchObject({
      status: 'success',
      settings: {
        seasonalMode: 'festive',
        seasonalGreeting: 'Merry Christmas from Santa!',
        seasonalStatusText: 'The sleigh is nearly ready.',
        seasonalCountdownTargetDate: '2026-12-25',
      },
    });

    await expect(
      getRuntimeConfigurationForHeaders(headers),
    ).resolves.toMatchObject({
      santaSettings: {
        seasonalGreeting: 'Merry Christmas from Santa!',
        seasonalStatusText: 'The sleigh is nearly ready.',
        seasonalCountdownTargetDate: '2026-12-25',
      },
    });

    await expect(
      updateWorkshopSeasonalSettings({
        expectedVersion: '2',
        seasonalMode: 'festive',
        greetingEnabled: true,
        greetingText: 'x'.repeat(121),
        statusEnabled: false,
        statusText: '',
        countdownEnabled: false,
        countdownTargetDate: '',
        countdownLabel: '',
        headers,
      }),
    ).resolves.toMatchObject({
      status: 'invalid-greeting',
    });
  });

  it('keeps persisted ruling responses stable and protects required blocked-warning templates', async () => {
    const headers = createWorkshopHeaders();
    const runId = headers.get('x-santa-test-run-id') ?? 'default';
    const submissionRepository = createTestSubmissionRepository(runId);
    const created = await createWorkshopResponseTemplate({
      group: 'approved',
      templateText: 'CERTAINLY, {name}.',
      active: true,
      sortOrder: '999',
      privateNote: 'Deterministic high-sort template.',
      headers,
      now: new Date('2026-07-18T13:00:00.000Z'),
    });

    expect(created).toMatchObject({
      status: 'success',
      template: {
        group: 'approved',
      },
    });
    expect(created.status).toBe('success');
    const createdApprovedTemplate =
      created.status === 'success' ? created.template : null;

    await updateWorkshopSantaSettings({
      expectedVersion: '1',
      randomCoalEnabled: false,
      randomCoalPercentage: '5',
      headers,
      now: new Date('2026-07-18T13:05:00.000Z'),
    });

    await submitSantaRequest(
      {
        name: 'Holly',
        request: 'A silver trumpet',
        website: '',
        formElapsedMs: 2_000,
      },
      {
        clientKeyHash: 'client-a',
        idempotencyKey: '12345678-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      {
        submissionRepository,
        loadRuntimeConfiguration: () =>
          getRuntimeConfigurationForHeaders(headers),
        randomProvider: vi
          .fn<() => number>()
          .mockReturnValueOnce(0.99)
          .mockReturnValueOnce(0.99),
        publicIdGenerator: vi.fn(() => '9f2504e0-4f89-41d3-9a0c-0305e82c3301'),
        nowProvider: vi.fn(() => new Date('2026-07-18T13:10:00.000Z')),
        scenario: 'normal',
      },
    );

    const storedRuling = getTestRunStore(runId).rulings[0];

    expect(storedRuling?.santaResponse).toBe('CERTAINLY, Holly.');

    const updated = await updateWorkshopResponseTemplate({
      publicId: createdApprovedTemplate?.publicId ?? '',
      templateText: 'ABSOLUTELY, {name}.',
      active: true,
      sortOrder: '999',
      privateNote: 'Updated wording.',
      headers,
      now: new Date('2026-07-18T13:15:00.000Z'),
    });

    expect(updated).toMatchObject({
      status: 'success',
      template: {
        templateText: 'ABSOLUTELY, {name}.',
      },
    });
    expect(storedRuling?.santaResponse).toBe('CERTAINLY, Holly.');

    const blockedTemplates = getTestRunStore(runId).responseTemplates.filter(
      (template) => template.group === 'blocked-warning',
    );
    const coreTemplate = blockedTemplates.find(
      (template) => template.templateText === REQUIRED_BLOCKED_WARNING_TEMPLATE,
    );
    const nonCoreTemplate = blockedTemplates.find(
      (template) => template.templateText !== REQUIRED_BLOCKED_WARNING_TEMPLATE,
    );

    expect(coreTemplate).toBeTruthy();
    expect(nonCoreTemplate).toBeTruthy();

    await setWorkshopResponseTemplateActive({
      publicId: nonCoreTemplate?.publicId ?? '',
      active: false,
      headers,
      now: new Date('2026-07-18T13:20:00.000Z'),
    });

    const conflict = await setWorkshopResponseTemplateActive({
      publicId: coreTemplate?.publicId ?? '',
      active: false,
      headers,
      now: new Date('2026-07-18T13:25:00.000Z'),
    });

    expect(conflict).toMatchObject({
      status: 'required-template-conflict',
    });
  });
});
