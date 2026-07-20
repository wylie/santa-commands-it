import type { PublicRuling } from '@/utils/rulings';
import type { ReportReason } from '@/config/reports';
import type {
  OwnerActivityAction,
  OwnerActivityTargetType,
  RulingVisibility,
  WorkshopReportStatus,
} from '@/utils/workshop';
import type {
  ModerationRuleCategory,
  ModerationRuleType,
  ResponseTemplateGroup,
} from '@/utils/configuration';
import { configurationSeedDefaults } from '@/utils/configuration';
import { normalizeModerationRuleValue } from '@/utils/moderation';

export type TestStoredRuling = PublicRuling & {
  id: number;
  visibility: RulingVisibility;
  featuredAt: string | null;
  hiddenAt: string | null;
  hiddenReason: string | null;
};

export type TestSubmissionAttempt = {
  clientKeyHash: string;
  createdAt: string;
};

export type TestIdempotencyRecord = {
  clientKeyHash: string;
  idempotencyKey: string;
  normalizedName: string;
  normalizedRequest: string;
  rulingPublicId: string;
  createdAt: string;
  expiresAt: string;
};

export type TestReportRecord = {
  id: number;
  publicId: string;
  rulingId: number;
  clientKeyHash: string;
  reason: ReportReason;
  note: string | null;
  status: WorkshopReportStatus;
  reviewedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
};

export type TestWorkshopSession = {
  id: number;
  tokenHash: string;
  csrfToken: string;
  expiresAt: string;
  createdAt: string;
};

export type TestWorkshopLoginAttempt = {
  clientKeyHash: string;
  successful: boolean;
  createdAt: string;
};

export type TestOwnerActivityRecord = {
  id: number;
  action: OwnerActivityAction;
  targetType: OwnerActivityTargetType;
  targetPublicId: string | null;
  relatedPublicId: string | null;
  details: string | null;
  createdAt: string;
};

export type TestModerationRuleRecord = {
  id: number;
  publicId: string;
  ruleType: ModerationRuleType;
  value: string;
  normalizedValue: string;
  category: ModerationRuleCategory | null;
  privateNote: string | null;
  active: boolean;
  createdSource: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TestSantaSettingsRecord = {
  id: number;
  singletonKey: string;
  randomCoalEnabled: boolean;
  randomCoalPercentage: number;
  seasonalGreeting: string;
  seasonalMode: import('@/utils/seasonal').SeasonalPresentationMode;
  seasonalGreetingEnabled: boolean;
  seasonalStatusEnabled: boolean;
  seasonalStatusText: string;
  seasonalCountdownEnabled: boolean;
  seasonalCountdownTargetDate: string;
  seasonalCountdownLabel: string;
  version: number;
  createdSource: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TestResponseTemplateRecord = {
  id: number;
  publicId: string;
  group: ResponseTemplateGroup;
  templateText: string;
  active: boolean;
  sortOrder: number;
  privateNote: string | null;
  createdSource: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TestRunStore = {
  rulings: TestStoredRuling[];
  submissionAttempts: TestSubmissionAttempt[];
  idempotencyRecords: TestIdempotencyRecord[];
  reports: TestReportRecord[];
  workshopSessions: TestWorkshopSession[];
  workshopLoginAttempts: TestWorkshopLoginAttempt[];
  ownerActivity: TestOwnerActivityRecord[];
  moderationRules: TestModerationRuleRecord[];
  santaSettings: TestSantaSettingsRecord;
  responseTemplates: TestResponseTemplateRecord[];
};

const stores = new Map<string, TestRunStore>();

export function getTestRunStore(runId: string): TestRunStore {
  const existingStore = stores.get(runId);

  if (existingStore) {
    return existingStore;
  }

  const seededAt = new Date('2026-07-18T00:00:00.000Z').toISOString();
  const moderationRules: TestModerationRuleRecord[] = [
    ...configurationSeedDefaults.moderationRules.blockedWords.map(
      (value, index) => ({
        id: index + 1,
        publicId: `rule_seed-blocked-word-${String(index + 1).padStart(12, '0')}`,
        ruleType: 'blocked-word' as const,
        value,
        normalizedValue: normalizeModerationRuleValue('blocked-word', value),
        category: null,
        privateNote: null,
        active: true,
        createdSource: 'source-migration',
        createdAt: seededAt,
        updatedAt: seededAt,
      }),
    ),
    ...configurationSeedDefaults.moderationRules.blockedPhrases.map(
      (value, index) => ({
        id:
          configurationSeedDefaults.moderationRules.blockedWords.length +
          index +
          1,
        publicId: `rule_seed-blocked-phrase-${String(index + 1).padStart(10, '0')}`,
        ruleType: 'blocked-phrase' as const,
        value,
        normalizedValue: normalizeModerationRuleValue('blocked-phrase', value),
        category: null,
        privateNote: null,
        active: true,
        createdSource: 'source-migration',
        createdAt: seededAt,
        updatedAt: seededAt,
      }),
    ),
    ...configurationSeedDefaults.moderationRules.allowedExceptions.map(
      (value, index) => ({
        id:
          configurationSeedDefaults.moderationRules.blockedWords.length +
          configurationSeedDefaults.moderationRules.blockedPhrases.length +
          index +
          1,
        publicId: `rule_seed-allowed-exception-${String(index + 1).padStart(7, '0')}`,
        ruleType: 'allowed-exception' as const,
        value,
        normalizedValue: normalizeModerationRuleValue(
          'allowed-exception',
          value,
        ),
        category: null,
        privateNote: null,
        active: true,
        createdSource: 'source-migration',
        createdAt: seededAt,
        updatedAt: seededAt,
      }),
    ),
  ];

  const responseTemplates: TestResponseTemplateRecord[] = [
    ...configurationSeedDefaults.responseTemplates.approved.map(
      (templateText, index) => ({
        id: index + 1,
        publicId: `template_seed-approved-${String(index + 1).padStart(12, '0')}`,
        group: 'approved' as const,
        templateText,
        active: true,
        sortOrder: index,
        privateNote: null,
        createdSource: 'source-migration',
        createdAt: seededAt,
        updatedAt: seededAt,
      }),
    ),
    ...configurationSeedDefaults.responseTemplates.coal.map(
      (templateText, index) => ({
        id:
          configurationSeedDefaults.responseTemplates.approved.length +
          index +
          1,
        publicId: `template_seed-coal-${String(index + 1).padStart(16, '0')}`,
        group: 'coal' as const,
        templateText,
        active: true,
        sortOrder: index,
        privateNote: null,
        createdSource: 'source-migration',
        createdAt: seededAt,
        updatedAt: seededAt,
      }),
    ),
    ...configurationSeedDefaults.responseTemplates.blockedWarning.map(
      (templateText, index) => ({
        id:
          configurationSeedDefaults.responseTemplates.approved.length +
          configurationSeedDefaults.responseTemplates.coal.length +
          index +
          1,
        publicId: `template_seed-blocked-warning-${String(index + 1).padStart(5, '0')}`,
        group: 'blocked-warning' as const,
        templateText,
        active: true,
        sortOrder: index,
        privateNote: null,
        createdSource: 'source-migration',
        createdAt: seededAt,
        updatedAt: seededAt,
      }),
    ),
  ];

  const nextStore: TestRunStore = {
    rulings: [],
    submissionAttempts: [],
    idempotencyRecords: [],
    reports: [],
    workshopSessions: [],
    workshopLoginAttempts: [],
    ownerActivity: [],
    moderationRules,
    santaSettings: {
      id: 1,
      singletonKey: 'primary',
      randomCoalEnabled:
        configurationSeedDefaults.santaSettings.randomCoalEnabled,
      randomCoalPercentage:
        configurationSeedDefaults.santaSettings.randomCoalPercentage,
      seasonalGreeting:
        configurationSeedDefaults.santaSettings.seasonalGreeting ?? '',
      seasonalMode:
        configurationSeedDefaults.santaSettings.seasonalMode ?? 'standard',
      seasonalGreetingEnabled:
        configurationSeedDefaults.santaSettings.seasonalGreetingEnabled ??
        false,
      seasonalStatusEnabled:
        configurationSeedDefaults.santaSettings.seasonalStatusEnabled ?? false,
      seasonalStatusText:
        configurationSeedDefaults.santaSettings.seasonalStatusText ?? '',
      seasonalCountdownEnabled:
        configurationSeedDefaults.santaSettings.seasonalCountdownEnabled ??
        false,
      seasonalCountdownTargetDate:
        configurationSeedDefaults.santaSettings.seasonalCountdownTargetDate ??
        '',
      seasonalCountdownLabel:
        configurationSeedDefaults.santaSettings.seasonalCountdownLabel ??
        'UNTIL CHRISTMAS',
      version: 1,
      createdSource: 'source-migration',
      createdAt: seededAt,
      updatedAt: seededAt,
    },
    responseTemplates,
  };

  stores.set(runId, nextStore);

  return nextStore;
}

export function clearTestRunStore(runId?: string): void {
  if (runId) {
    stores.delete(runId);
    return;
  }

  stores.clear();
}
