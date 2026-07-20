import type { ModerationRules } from '@/config/moderation';
import { securitySettings } from '@/config/security';
import { validateOptionalText } from '@/utils/validation';
import { coercePositivePage, type OwnerActivityAction } from '@/utils/workshop';
import {
  buildModerationRulesFromRuntime,
  findMatchingModerationRule,
  normalizeModerationRuleValue,
} from '@/utils/moderation';
import {
  coerceModerationRuleCategoryFilter,
  coerceModerationRuleStatusFilter,
  coerceModerationRuleTypeFilter,
  getModerationRuleCategoryLabel,
  getModerationRuleTypeLabel,
  getResponseTemplateGroupLabel,
  isModerationRuleCategory,
  isModerationRuleType,
  isResponseTemplateGroup,
  isValidWorkshopRuleId,
  isValidWorkshopTemplateId,
  type ModerationRuleType,
  type ResponseTemplateGroup,
  type RuntimeModerationRule,
  type RuntimeSantaSettings,
  type WorkshopModerationFilters,
} from '@/utils/configuration';
import {
  buildSeasonalCountdownMessage,
  coerceSeasonalPresentationMode,
  DEFAULT_SEASONAL_COUNTDOWN_LABEL,
  getSeasonalPresentationModeLabel,
  normalizeSeasonalPlainText,
  parseCountdownTargetDate,
  SEASONAL_COUNTDOWN_LABEL_MAX_LENGTH,
  SEASONAL_GREETING_MAX_LENGTH,
  SEASONAL_STATUS_MAX_LENGTH,
  type SeasonalPublicPresentation,
} from '@/utils/seasonal';
import type { ConfigurationRepository } from '@/server/config/repository';
import { getConfigurationRepositoryForHeaders } from '@/server/config/test-mode';
import { getRequestNow } from '@/server/rulings/test-mode';
import { getWorkshopRepositoryForHeaders } from '@/server/workshop/test-mode';
import { getSiteTimeZone } from '@/server/env';

const PLACEHOLDER_PATTERN = /\{([^{}]+)\}/g;
const CONFIG_ACTIVITY_LIMIT = 8;
export const REQUIRED_BLOCKED_WARNING_TEMPLATE =
  'THAT IS UNACCEPTABLE. ASK FOR SOMETHING ELSE OR RECEIVE COAL!';

export class RuntimeConfigurationUnavailableError extends Error {
  constructor(message = 'Runtime configuration is unavailable.') {
    super(message);
    this.name = 'RuntimeConfigurationUnavailableError';
  }
}

export type RuntimeConfiguration = {
  moderationRules: ModerationRules;
  activeModerationRules: RuntimeModerationRule[];
  santaSettings: RuntimeSantaSettings;
  responseTemplates: {
    approved: string[];
    coal: string[];
    blockedWarning: string[];
  };
};

export type ModerationTesterResult = {
  blocked: boolean;
  focusField: 'name' | 'request' | 'both' | null;
  name: ReturnType<typeof findMatchingModerationRule>;
  request: ReturnType<typeof findMatchingModerationRule>;
};

type CacheEntry = {
  expiresAt: number;
  value: RuntimeConfiguration;
};

export function parseModerationFilters(
  searchParams: URLSearchParams,
): WorkshopModerationFilters {
  return {
    query: (searchParams.get('q') ?? '')
      .trim()
      .slice(0, securitySettings.workshop.search.maxQueryLength),
    ruleType: coerceModerationRuleTypeFilter(searchParams.get('type')),
    status: coerceModerationRuleStatusFilter(searchParams.get('status')),
    category: coerceModerationRuleCategoryFilter(searchParams.get('category')),
    page: coercePositivePage(searchParams.get('page')),
  };
}

function buildCacheKey(headers: Headers): string {
  return headers.get('x-santa-test-run-id') ?? 'default';
}

function validateRuleValue(
  ruleType: ModerationRuleType,
  value: string,
):
  | { valid: true; value: string; normalizedValue: string }
  | { valid: false; error: string } {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return {
      valid: false,
      error: 'Please enter a moderation rule value.',
    };
  }

  if (
    trimmedValue.length >
    securitySettings.workshop.configuration.ruleValueMaxLength
  ) {
    return {
      valid: false,
      error: `Please keep rule values to ${securitySettings.workshop.configuration.ruleValueMaxLength} characters or fewer.`,
    };
  }

  const normalizedValue = normalizeModerationRuleValue(ruleType, trimmedValue);

  if (!normalizedValue) {
    return {
      valid: false,
      error: 'Please enter a rule value with letters or numbers.',
    };
  }

  if (
    ruleType === 'allowed-exception' &&
    normalizedValue.split(' ').length < 2
  ) {
    return {
      valid: false,
      error:
        'Allowed exceptions must be specific enough to include at least two words.',
    };
  }

  return {
    valid: true,
    value: trimmedValue,
    normalizedValue,
  };
}

function validateRuleNote(note: string) {
  return validateOptionalText(
    note,
    securitySettings.workshop.resolutionNoteMaxLength,
    `Please keep private notes to ${securitySettings.workshop.resolutionNoteMaxLength} characters or fewer.`,
  );
}

function validateTesterField(value: string, label: string) {
  const trimmedValue = value.trim();

  if (
    trimmedValue.length >
    securitySettings.workshop.configuration.testerInputMaxLength
  ) {
    return {
      valid: false as const,
      error: `Please keep ${label} test text to ${securitySettings.workshop.configuration.testerInputMaxLength} characters or fewer.`,
    };
  }

  return {
    valid: true as const,
    value: trimmedValue,
  };
}

function validateTemplateText(
  group: ResponseTemplateGroup,
  value: string,
): { valid: true; value: string } | { valid: false; error: string } {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return {
      valid: false,
      error: 'Please enter template text.',
    };
  }

  if (
    trimmedValue.length >
    securitySettings.workshop.configuration.responseTemplateMaxLength
  ) {
    return {
      valid: false,
      error: `Please keep template text to ${securitySettings.workshop.configuration.responseTemplateMaxLength} characters or fewer.`,
    };
  }

  const matches = [...trimmedValue.matchAll(PLACEHOLDER_PATTERN)];
  const stripped = trimmedValue.replace(PLACEHOLDER_PATTERN, '');

  if (stripped.includes('{') || stripped.includes('}')) {
    return {
      valid: false,
      error: 'Template placeholders must use matched braces like {name}.',
    };
  }

  const allowedPlaceholders =
    group === 'blocked-warning' ? [] : ['name', 'request'];

  for (const match of matches) {
    const placeholder = match[1]?.trim();

    if (!placeholder || !allowedPlaceholders.includes(placeholder)) {
      return {
        valid: false,
        error:
          group === 'blocked-warning'
            ? 'Blocked warning templates cannot use placeholders.'
            : 'Only {name} and {request} placeholders are allowed in this template.',
      };
    }
  }

  return {
    valid: true,
    value: trimmedValue,
  };
}

function validateSortOrder(input: string): number | null {
  const value = Number.parseInt(input, 10);

  return Number.isInteger(value) && value >= 0 ? value : null;
}

async function recordConfigurationActivity(
  headers: Headers,
  input: Parameters<
    ReturnType<typeof getWorkshopRepositoryForHeaders>['createOwnerActivity']
  >[0],
) {
  try {
    await getWorkshopRepositoryForHeaders(headers).createOwnerActivity(input);
    return true;
  } catch {
    return false;
  }
}

function summarizeTemplateText(templateText: string): string {
  return templateText.length > 80
    ? `${templateText.slice(0, 79)}…`
    : templateText;
}

async function loadRuntimeConfigurationFromRepository(
  repository: ConfigurationRepository,
): Promise<RuntimeConfiguration> {
  const [activeModerationRules, settings, activeTemplates] = await Promise.all([
    repository.listActiveModerationRules(),
    repository.getSantaSettings(),
    repository.listActiveResponseTemplates(),
  ]);

  if (!settings) {
    throw new RuntimeConfigurationUnavailableError(
      'Santa settings could not be loaded.',
    );
  }

  const approved = activeTemplates
    .filter((template) => template.group === 'approved')
    .map((template) => template.templateText);
  const coal = activeTemplates
    .filter((template) => template.group === 'coal')
    .map((template) => template.templateText);
  const blockedWarning = activeTemplates
    .filter((template) => template.group === 'blocked-warning')
    .map((template) => template.templateText);

  if (!approved.length) {
    throw new RuntimeConfigurationUnavailableError(
      'At least one active approved template is required.',
    );
  }

  if (!blockedWarning.length) {
    throw new RuntimeConfigurationUnavailableError(
      'At least one active blocked warning template is required.',
    );
  }

  if (!blockedWarning.includes(REQUIRED_BLOCKED_WARNING_TEMPLATE)) {
    throw new RuntimeConfigurationUnavailableError(
      'An active blocked warning template must retain the required core message.',
    );
  }

  if (settings.randomCoalEnabled && !coal.length) {
    throw new RuntimeConfigurationUnavailableError(
      'At least one active coal template is required when random coal is enabled.',
    );
  }

  return {
    moderationRules: buildModerationRulesFromRuntime(activeModerationRules),
    activeModerationRules,
    santaSettings: {
      randomCoalEnabled: settings.randomCoalEnabled,
      randomCoalPercentage: settings.randomCoalPercentage,
      seasonalGreeting: settings.seasonalGreeting,
      seasonalMode: settings.seasonalMode,
      seasonalGreetingEnabled: settings.seasonalGreetingEnabled,
      seasonalStatusEnabled: settings.seasonalStatusEnabled,
      seasonalStatusText: settings.seasonalStatusText,
      seasonalCountdownEnabled: settings.seasonalCountdownEnabled,
      seasonalCountdownTargetDate: settings.seasonalCountdownTargetDate,
      seasonalCountdownLabel:
        settings.seasonalCountdownLabel || DEFAULT_SEASONAL_COUNTDOWN_LABEL,
      version: settings.version,
    },
    responseTemplates: {
      approved,
      coal,
      blockedWarning,
    },
  };
}

export function createRuntimeConfigurationService(input: {
  repository: ConfigurationRepository;
  ttlMs?: number;
  nowProvider?: () => Date;
}) {
  let cache: CacheEntry | null = null;
  const ttlMs =
    input.ttlMs ?? securitySettings.workshop.configuration.cacheTtlMs;
  const nowProvider = input.nowProvider ?? (() => new Date());

  return {
    async getRuntimeConfiguration() {
      const now = nowProvider().getTime();

      if (cache && cache.expiresAt > now) {
        return cache.value;
      }

      const value = await loadRuntimeConfigurationFromRepository(
        input.repository,
      );
      cache = {
        value,
        expiresAt: now + ttlMs,
      };

      return value;
    },
    invalidate() {
      cache = null;
    },
  };
}

const runtimeConfigurationCaches = new Map<
  string,
  ReturnType<typeof createRuntimeConfigurationService>
>();

export async function getRuntimeConfigurationForHeaders(headers: Headers) {
  const cacheKey = buildCacheKey(headers);
  const existing = runtimeConfigurationCaches.get(cacheKey);

  if (existing) {
    return existing.getRuntimeConfiguration();
  }

  const service = createRuntimeConfigurationService({
    repository: getConfigurationRepositoryForHeaders(headers),
  });
  runtimeConfigurationCaches.set(cacheKey, service);

  return service.getRuntimeConfiguration();
}

export function invalidateRuntimeConfigurationCache(headers: Headers) {
  runtimeConfigurationCaches.get(buildCacheKey(headers))?.invalidate();
}

export async function getPublicSeasonalPresentation(
  headers: Headers,
): Promise<SeasonalPublicPresentation> {
  try {
    const configuration = await getRuntimeConfigurationForHeaders(headers);
    const settings = configuration.santaSettings;
    const greeting =
      settings.seasonalGreetingEnabled && settings.seasonalGreeting
        ? settings.seasonalGreeting
        : '';
    const status =
      settings.seasonalStatusEnabled && settings.seasonalStatusText
        ? settings.seasonalStatusText
        : '';
    const countdown = settings.seasonalCountdownEnabled
      ? buildSeasonalCountdownMessage({
          targetDate: settings.seasonalCountdownTargetDate,
          label: settings.seasonalCountdownLabel,
          timeZone: getSiteTimeZone(),
          now: getRequestNow(headers),
        })
      : null;

    return {
      mode: settings.seasonalMode,
      greeting,
      status,
      countdown,
    };
  } catch {
    return {
      mode: 'standard',
      greeting: '',
      status: '',
      countdown: null,
    };
  }
}

async function getRelevantConfigurationActivity(
  headers: Headers,
  actions: OwnerActivityAction[],
) {
  const activity = await getWorkshopRepositoryForHeaders(
    headers,
  ).listRecentOwnerActivity(CONFIG_ACTIVITY_LIMIT);

  return activity.filter((entry) => actions.includes(entry.action)).slice(0, 5);
}

export async function getWorkshopModerationPageData(
  headers: Headers,
  searchParams: URLSearchParams,
) {
  const repository = getConfigurationRepositoryForHeaders(headers);
  const filters = parseModerationFilters(searchParams);
  const [result, recentActivity] = await Promise.all([
    repository.listModerationRules(filters),
    getRelevantConfigurationActivity(headers, [
      'moderation-rule-created',
      'moderation-rule-updated',
      'moderation-rule-enabled',
      'moderation-rule-disabled',
      'moderation-rule-deleted',
    ]),
  ]);

  return {
    filters,
    recentActivity,
    ...result,
  };
}

export async function getWorkshopModerationRuleDetailData(
  publicId: string,
  headers: Headers,
) {
  if (!isValidWorkshopRuleId(publicId)) {
    return null;
  }

  const repository = getConfigurationRepositoryForHeaders(headers);

  return repository.getModerationRuleByPublicId(publicId);
}

export async function createWorkshopModerationRule(input: {
  ruleType: string;
  value: string;
  category: string;
  active: boolean;
  privateNote: string;
  headers: Headers;
  now?: Date;
}) {
  if (!isModerationRuleType(input.ruleType)) {
    return {
      status: 'invalid-type' as const,
      message: 'Please choose a moderation rule type.',
    };
  }

  const validatedValue = validateRuleValue(input.ruleType, input.value);

  if (!validatedValue.valid) {
    return {
      status: 'invalid-value' as const,
      message: validatedValue.error,
    };
  }

  const validatedNote = validateRuleNote(input.privateNote);

  if (!validatedNote.valid) {
    return {
      status: 'invalid-note' as const,
      message: validatedNote.error,
    };
  }

  const category = isModerationRuleCategory(input.category)
    ? input.category
    : null;
  const repository = getConfigurationRepositoryForHeaders(input.headers);
  const duplicate = await repository.getModerationRuleByTypeAndNormalizedValue(
    input.ruleType,
    validatedValue.normalizedValue,
  );

  if (duplicate) {
    return {
      status: 'duplicate' as const,
      existingRule: duplicate,
      message: duplicate.active
        ? 'A moderation rule with that normalized value already exists.'
        : 'That rule already exists in an inactive state. Open it to re-enable or edit it.',
    };
  }

  const now = input.now ?? new Date();
  const rule = await repository.createModerationRule({
    ruleType: input.ruleType,
    value: validatedValue.value,
    normalizedValue: validatedValue.normalizedValue,
    category,
    privateNote: validatedNote.value || null,
    active: input.active,
    createdSource: null,
    now,
  });
  invalidateRuntimeConfigurationCache(input.headers);
  const activityLogged = await recordConfigurationActivity(input.headers, {
    action: 'moderation-rule-created',
    targetType: 'moderation-rule',
    targetPublicId: rule.publicId,
    details: `${getModerationRuleTypeLabel(rule.ruleType)} · ${getModerationRuleCategoryLabel(rule.category)}`,
  });

  return {
    status: 'success' as const,
    rule,
    activityLogged,
  };
}

export async function updateWorkshopModerationRule(input: {
  publicId: string;
  value: string;
  category: string;
  active: boolean;
  privateNote: string;
  headers: Headers;
  now?: Date;
}) {
  if (!isValidWorkshopRuleId(input.publicId)) {
    return { status: 'not-found' as const };
  }

  const repository = getConfigurationRepositoryForHeaders(input.headers);
  const existing = await repository.getModerationRuleByPublicId(input.publicId);

  if (!existing) {
    return { status: 'not-found' as const };
  }

  const validatedValue = validateRuleValue(existing.ruleType, input.value);

  if (!validatedValue.valid) {
    return {
      status: 'invalid-value' as const,
      message: validatedValue.error,
    };
  }

  const validatedNote = validateRuleNote(input.privateNote);

  if (!validatedNote.valid) {
    return {
      status: 'invalid-note' as const,
      message: validatedNote.error,
    };
  }

  const duplicate = await repository.getModerationRuleByTypeAndNormalizedValue(
    existing.ruleType,
    validatedValue.normalizedValue,
  );

  if (duplicate && duplicate.publicId !== existing.publicId) {
    return {
      status: 'duplicate' as const,
      existingRule: duplicate,
      message: duplicate.active
        ? 'A moderation rule with that normalized value already exists.'
        : 'That normalized value already belongs to an inactive rule.',
    };
  }

  const category = isModerationRuleCategory(input.category)
    ? input.category
    : null;
  const rule = await repository.updateModerationRule({
    publicId: existing.publicId,
    value: validatedValue.value,
    normalizedValue: validatedValue.normalizedValue,
    category,
    privateNote: validatedNote.value || null,
    active: input.active,
    now: input.now ?? new Date(),
  });

  if (!rule) {
    return { status: 'not-found' as const };
  }

  invalidateRuntimeConfigurationCache(input.headers);
  const activityLogged = await recordConfigurationActivity(input.headers, {
    action: 'moderation-rule-updated',
    targetType: 'moderation-rule',
    targetPublicId: rule.publicId,
    details: `${getModerationRuleTypeLabel(rule.ruleType)} updated`,
  });

  return {
    status: 'success' as const,
    rule,
    activityLogged,
  };
}

export async function setWorkshopModerationRuleActive(input: {
  publicId: string;
  active: boolean;
  headers: Headers;
  now?: Date;
}) {
  if (!isValidWorkshopRuleId(input.publicId)) {
    return { status: 'not-found' as const };
  }

  const repository = getConfigurationRepositoryForHeaders(input.headers);
  const existing = await repository.getModerationRuleByPublicId(input.publicId);

  if (!existing) {
    return { status: 'not-found' as const };
  }

  if (existing.active === input.active) {
    return { status: 'no-op' as const, rule: existing };
  }

  const rule = await repository.setModerationRuleActive(
    input.publicId,
    input.active,
    input.now ?? new Date(),
  );

  if (!rule) {
    return { status: 'not-found' as const };
  }

  invalidateRuntimeConfigurationCache(input.headers);
  const activityLogged = await recordConfigurationActivity(input.headers, {
    action: input.active
      ? 'moderation-rule-enabled'
      : 'moderation-rule-disabled',
    targetType: 'moderation-rule',
    targetPublicId: rule.publicId,
    details: `${getModerationRuleTypeLabel(rule.ruleType)} · ${rule.value.slice(0, 40)}`,
  });

  return {
    status: 'success' as const,
    rule,
    activityLogged,
  };
}

export async function deleteWorkshopModerationRule(input: {
  publicId: string;
  headers: Headers;
}) {
  if (!isValidWorkshopRuleId(input.publicId)) {
    return { status: 'not-found' as const };
  }

  const repository = getConfigurationRepositoryForHeaders(input.headers);
  const existing = await repository.getModerationRuleByPublicId(input.publicId);

  if (!existing) {
    return { status: 'not-found' as const };
  }

  const deleted = await repository.deleteModerationRule(input.publicId);

  if (!deleted) {
    return { status: 'not-found' as const };
  }

  invalidateRuntimeConfigurationCache(input.headers);
  const activityLogged = await recordConfigurationActivity(input.headers, {
    action: 'moderation-rule-deleted',
    targetType: 'moderation-rule',
    targetPublicId: existing.publicId,
    details: `${getModerationRuleTypeLabel(existing.ruleType)} deleted`,
  });

  return {
    status: 'success' as const,
    activityLogged,
  };
}

export async function runWorkshopModerationTester(input: {
  name: string;
  request: string;
  headers: Headers;
}) {
  const validatedName = validateTesterField(input.name, 'name');
  const validatedRequest = validateTesterField(input.request, 'request');

  if (!validatedName.valid) {
    return { status: 'invalid' as const, message: validatedName.error };
  }

  if (!validatedRequest.valid) {
    return { status: 'invalid' as const, message: validatedRequest.error };
  }

  if (!validatedName.value && !validatedRequest.value) {
    return {
      status: 'invalid' as const,
      message: 'Enter a sample name or request to test moderation.',
    };
  }

  const runtimeConfiguration = await getRuntimeConfigurationForHeaders(
    input.headers,
  );
  const name = findMatchingModerationRule(
    validatedName.value,
    runtimeConfiguration.activeModerationRules,
  );
  const request = findMatchingModerationRule(
    validatedRequest.value,
    runtimeConfiguration.activeModerationRules,
  );

  return {
    status: 'success' as const,
    result: {
      blocked: name.blocked || request.blocked,
      focusField:
        name.blocked && request.blocked
          ? 'both'
          : name.blocked
            ? 'name'
            : request.blocked
              ? 'request'
              : null,
      name,
      request,
    } satisfies ModerationTesterResult,
  };
}

export async function getWorkshopSantaSettingsPageData(headers: Headers) {
  const repository = getConfigurationRepositoryForHeaders(headers);
  const [settings, recentActivity] = await Promise.all([
    repository.getSantaSettings(),
    getRelevantConfigurationActivity(headers, ['santa-settings-updated']),
  ]);

  return {
    settings,
    recentActivity,
  };
}

export async function updateWorkshopSantaSettings(input: {
  expectedVersion: string;
  randomCoalEnabled: boolean;
  randomCoalPercentage: string;
  headers: Headers;
  now?: Date;
}) {
  const expectedVersion = Number.parseInt(input.expectedVersion, 10);
  const parsedPercentage = Number.parseInt(input.randomCoalPercentage, 10);

  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return { status: 'conflict' as const };
  }

  if (
    !Number.isInteger(parsedPercentage) ||
    parsedPercentage < 0 ||
    parsedPercentage > 100
  ) {
    return {
      status: 'invalid-percentage' as const,
      message: 'Random coal percentage must be a whole number from 0 to 100.',
    };
  }

  const repository = getConfigurationRepositoryForHeaders(input.headers);
  const existing = await repository.getSantaSettings();

  if (!existing) {
    return { status: 'not-found' as const };
  }

  const updated = await repository.updateSantaSettings({
    expectedVersion,
    randomCoalEnabled: input.randomCoalEnabled,
    randomCoalPercentage: parsedPercentage,
    seasonalGreeting: existing.seasonalGreeting || null,
    seasonalMode: existing.seasonalMode,
    seasonalGreetingEnabled: existing.seasonalGreetingEnabled,
    seasonalStatusEnabled: existing.seasonalStatusEnabled,
    seasonalStatusText: existing.seasonalStatusText || null,
    seasonalCountdownEnabled: existing.seasonalCountdownEnabled,
    seasonalCountdownTargetDate: existing.seasonalCountdownTargetDate || null,
    seasonalCountdownLabel: existing.seasonalCountdownLabel || null,
    now: input.now ?? new Date(),
  });

  if (updated === 'conflict') {
    return { status: 'conflict' as const, current: existing };
  }

  if (!updated) {
    return { status: 'not-found' as const };
  }

  invalidateRuntimeConfigurationCache(input.headers);
  const activityLogged = await recordConfigurationActivity(input.headers, {
    action: 'santa-settings-updated',
    targetType: 'setting',
    targetPublicId: 'santa-settings',
    details: [
      `Random coal ${existing.randomCoalEnabled ? 'enabled' : 'disabled'} → ${updated.randomCoalEnabled ? 'enabled' : 'disabled'} · ${existing.randomCoalPercentage}% → ${updated.randomCoalPercentage}%`,
    ]
      .filter(Boolean)
      .join(' · '),
  });

  return {
    status: 'success' as const,
    settings: updated,
    activityLogged,
  };
}

export async function getWorkshopSeasonalSettingsPageData(headers: Headers) {
  const repository = getConfigurationRepositoryForHeaders(headers);
  const [settings, recentActivity] = await Promise.all([
    repository.getSantaSettings(),
    getRelevantConfigurationActivity(headers, [
      'seasonal-mode-updated',
      'seasonal-greeting-enabled',
      'seasonal-greeting-disabled',
      'seasonal-greeting-updated',
      'seasonal-status-enabled',
      'seasonal-status-disabled',
      'seasonal-status-updated',
      'seasonal-countdown-enabled',
      'seasonal-countdown-disabled',
      'seasonal-countdown-updated',
      'seasonal-defaults-restored',
    ]),
  ]);

  return {
    settings,
    recentActivity,
  };
}

function validateSeasonalMessage(
  value: string,
  maximum: number,
  fieldLabel: string,
) {
  const normalizedValue = normalizeSeasonalPlainText(value);

  if (normalizedValue.length > maximum) {
    return {
      valid: false as const,
      message: `Please keep the ${fieldLabel} to ${maximum} characters or fewer.`,
    };
  }

  return {
    valid: true as const,
    value: normalizedValue,
  };
}

function summarizeSeasonalChanges(input: {
  existing: Awaited<ReturnType<ConfigurationRepository['getSantaSettings']>>;
  updated: Awaited<ReturnType<ConfigurationRepository['getSantaSettings']>>;
}) {
  if (!input.existing || !input.updated) {
    return 'Seasonal settings updated.';
  }

  const details: string[] = [];

  if (input.existing.seasonalMode !== input.updated.seasonalMode) {
    details.push(
      `Mode: ${getSeasonalPresentationModeLabel(input.updated.seasonalMode)}`,
    );
  }

  if (
    input.existing.seasonalGreetingEnabled !==
    input.updated.seasonalGreetingEnabled
  ) {
    details.push(
      `Greeting ${input.updated.seasonalGreetingEnabled ? 'enabled' : 'disabled'}`,
    );
  } else if (
    input.existing.seasonalGreeting !== input.updated.seasonalGreeting
  ) {
    details.push('Greeting text updated');
  }

  if (
    input.existing.seasonalStatusEnabled !== input.updated.seasonalStatusEnabled
  ) {
    details.push(
      `Status ${input.updated.seasonalStatusEnabled ? 'enabled' : 'disabled'}`,
    );
  } else if (
    input.existing.seasonalStatusText !== input.updated.seasonalStatusText
  ) {
    details.push('Status text updated');
  }

  if (
    input.existing.seasonalCountdownEnabled !==
    input.updated.seasonalCountdownEnabled
  ) {
    details.push(
      `Countdown ${input.updated.seasonalCountdownEnabled ? 'enabled' : 'disabled'}`,
    );
  } else if (
    input.existing.seasonalCountdownTargetDate !==
      input.updated.seasonalCountdownTargetDate ||
    input.existing.seasonalCountdownLabel !==
      input.updated.seasonalCountdownLabel
  ) {
    details.push('Countdown updated');
  }

  return details.join(' · ') || 'Seasonal settings updated.';
}

export async function updateWorkshopSeasonalSettings(input: {
  expectedVersion: string;
  seasonalMode: string;
  greetingEnabled: boolean;
  greetingText: string;
  statusEnabled: boolean;
  statusText: string;
  countdownEnabled: boolean;
  countdownTargetDate: string;
  countdownLabel: string;
  headers: Headers;
  now?: Date;
}) {
  const expectedVersion = Number.parseInt(input.expectedVersion, 10);

  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return { status: 'conflict' as const };
  }

  const seasonalMode = coerceSeasonalPresentationMode(input.seasonalMode);
  const greeting = validateSeasonalMessage(
    input.greetingText,
    SEASONAL_GREETING_MAX_LENGTH,
    'seasonal greeting',
  );

  if (!greeting.valid) {
    return { status: 'invalid-greeting' as const, message: greeting.message };
  }

  if (input.greetingEnabled && !greeting.value) {
    return {
      status: 'invalid-greeting' as const,
      message: 'Please enter seasonal greeting text before enabling it.',
    };
  }

  const statusText = validateSeasonalMessage(
    input.statusText,
    SEASONAL_STATUS_MAX_LENGTH,
    'seasonal status',
  );

  if (!statusText.valid) {
    return { status: 'invalid-status' as const, message: statusText.message };
  }

  if (input.statusEnabled && !statusText.value) {
    return {
      status: 'invalid-status' as const,
      message: 'Please enter seasonal status text before enabling it.',
    };
  }

  const countdownLabel = validateSeasonalMessage(
    input.countdownLabel || DEFAULT_SEASONAL_COUNTDOWN_LABEL,
    SEASONAL_COUNTDOWN_LABEL_MAX_LENGTH,
    'countdown label',
  );

  if (!countdownLabel.valid) {
    return {
      status: 'invalid-countdown' as const,
      message: countdownLabel.message,
    };
  }

  const countdownTargetDate = parseCountdownTargetDate(
    input.countdownTargetDate,
  );

  if (input.countdownEnabled && !countdownTargetDate) {
    return {
      status: 'invalid-countdown' as const,
      message: 'Please choose a valid countdown target date.',
    };
  }

  const repository = getConfigurationRepositoryForHeaders(input.headers);
  const existing = await repository.getSantaSettings();

  if (!existing) {
    return { status: 'not-found' as const };
  }

  const updated = await repository.updateSantaSettings({
    expectedVersion,
    randomCoalEnabled: existing.randomCoalEnabled,
    randomCoalPercentage: existing.randomCoalPercentage,
    seasonalGreeting: greeting.value || null,
    seasonalMode,
    seasonalGreetingEnabled: input.greetingEnabled,
    seasonalStatusEnabled: input.statusEnabled,
    seasonalStatusText: statusText.value || null,
    seasonalCountdownEnabled: input.countdownEnabled,
    seasonalCountdownTargetDate: countdownTargetDate || null,
    seasonalCountdownLabel: countdownLabel.value || null,
    now: input.now ?? new Date(),
  });

  if (updated === 'conflict') {
    return { status: 'conflict' as const, current: existing };
  }

  if (!updated) {
    return { status: 'not-found' as const };
  }

  invalidateRuntimeConfigurationCache(input.headers);
  const activityLogged = await recordConfigurationActivity(input.headers, {
    action: 'seasonal-mode-updated',
    targetType: 'setting',
    targetPublicId: 'seasonal-settings',
    details: summarizeSeasonalChanges({
      existing,
      updated,
    }),
  });

  return {
    status: 'success' as const,
    settings: updated,
    activityLogged,
  };
}

export async function restoreWorkshopSeasonalSettings(input: {
  expectedVersion: string;
  headers: Headers;
  now?: Date;
}) {
  const expectedVersion = Number.parseInt(input.expectedVersion, 10);

  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return { status: 'conflict' as const };
  }

  const repository = getConfigurationRepositoryForHeaders(input.headers);
  const existing = await repository.getSantaSettings();

  if (!existing) {
    return { status: 'not-found' as const };
  }

  const updated = await repository.updateSantaSettings({
    expectedVersion,
    randomCoalEnabled: existing.randomCoalEnabled,
    randomCoalPercentage: existing.randomCoalPercentage,
    seasonalGreeting: null,
    seasonalMode: 'standard',
    seasonalGreetingEnabled: false,
    seasonalStatusEnabled: false,
    seasonalStatusText: null,
    seasonalCountdownEnabled: false,
    seasonalCountdownTargetDate: null,
    seasonalCountdownLabel: DEFAULT_SEASONAL_COUNTDOWN_LABEL,
    now: input.now ?? new Date(),
  });

  if (updated === 'conflict') {
    return { status: 'conflict' as const, current: existing };
  }

  if (!updated) {
    return { status: 'not-found' as const };
  }

  invalidateRuntimeConfigurationCache(input.headers);
  const activityLogged = await recordConfigurationActivity(input.headers, {
    action: 'seasonal-defaults-restored',
    targetType: 'setting',
    targetPublicId: 'seasonal-settings',
    details: 'Restored the default seasonal presentation settings.',
  });

  return {
    status: 'success' as const,
    settings: updated,
    activityLogged,
  };
}

export async function getWorkshopResponseTemplatesPageData(headers: Headers) {
  const repository = getConfigurationRepositoryForHeaders(headers);
  const [templates, settings, recentActivity] = await Promise.all([
    repository.listResponseTemplates(),
    repository.getSantaSettings(),
    getRelevantConfigurationActivity(headers, [
      'response-template-created',
      'response-template-updated',
      'response-template-enabled',
      'response-template-disabled',
      'response-template-deleted',
    ]),
  ]);

  return {
    templates,
    settings,
    recentActivity,
  };
}

async function ensureTemplateGroupRemainsValid(input: {
  headers: Headers;
  group: ResponseTemplateGroup;
  currentPublicId?: string;
  nextTemplateText?: string;
  nextActive?: boolean;
  removingActiveTemplate: boolean;
}) {
  if (!input.removingActiveTemplate) {
    if (input.group !== 'blocked-warning') {
      return { valid: true as const };
    }
  }

  const repository = getConfigurationRepositoryForHeaders(input.headers);
  const [settings, activeTemplates] = await Promise.all([
    repository.getSantaSettings(),
    repository.listActiveResponseTemplates(),
  ]);
  const remainingTemplates = activeTemplates
    .filter((template) => template.group === input.group)
    .flatMap((template) => {
      if (template.publicId !== input.currentPublicId) {
        return [template];
      }

      if (input.nextActive === false || input.removingActiveTemplate) {
        return [];
      }

      return [
        {
          ...template,
          templateText: input.nextTemplateText ?? template.templateText,
        },
      ];
    });

  if (input.group === 'approved' && remainingTemplates.length < 1) {
    return {
      valid: false as const,
      message: 'Approved responses must keep at least one active template.',
    };
  }

  if (input.group === 'blocked-warning' && remainingTemplates.length < 1) {
    return {
      valid: false as const,
      message:
        'Blocked warning responses must keep at least one active template.',
    };
  }

  if (
    input.group === 'blocked-warning' &&
    !remainingTemplates.some(
      (template) => template.templateText === REQUIRED_BLOCKED_WARNING_TEMPLATE,
    )
  ) {
    return {
      valid: false as const,
      message:
        'Blocked warning responses must keep one active template with the core warning message.',
    };
  }

  if (
    input.group === 'coal' &&
    settings?.randomCoalEnabled &&
    remainingTemplates.length < 1
  ) {
    return {
      valid: false as const,
      message:
        'Coal responses must keep at least one active template while random coal is enabled.',
    };
  }

  return { valid: true as const };
}

export async function createWorkshopResponseTemplate(input: {
  group: string;
  templateText: string;
  active: boolean;
  sortOrder: string;
  privateNote: string;
  headers: Headers;
  now?: Date;
}) {
  if (!isResponseTemplateGroup(input.group)) {
    return {
      status: 'invalid-group' as const,
      message: 'Please choose a response template group.',
    };
  }

  const validatedText = validateTemplateText(input.group, input.templateText);

  if (!validatedText.valid) {
    return {
      status: 'invalid-text' as const,
      message: validatedText.error,
    };
  }

  const sortOrder = validateSortOrder(input.sortOrder);

  if (sortOrder === null) {
    return {
      status: 'invalid-sort-order' as const,
      message: 'Sort order must be a whole number of 0 or greater.',
    };
  }

  const validatedNote = validateRuleNote(input.privateNote);

  if (!validatedNote.valid) {
    return {
      status: 'invalid-note' as const,
      message: validatedNote.error,
    };
  }

  const repository = getConfigurationRepositoryForHeaders(input.headers);
  const template = await repository.createResponseTemplate({
    group: input.group,
    templateText: validatedText.value,
    active: input.active,
    sortOrder,
    privateNote: validatedNote.value || null,
    createdSource: null,
    now: input.now ?? new Date(),
  });

  invalidateRuntimeConfigurationCache(input.headers);
  const activityLogged = await recordConfigurationActivity(input.headers, {
    action: 'response-template-created',
    targetType: 'response-template',
    targetPublicId: template.publicId,
    details: `${getResponseTemplateGroupLabel(template.group)} · ${summarizeTemplateText(template.templateText)}`,
  });

  return {
    status: 'success' as const,
    template,
    activityLogged,
  };
}

export async function updateWorkshopResponseTemplate(input: {
  publicId: string;
  templateText: string;
  active: boolean;
  sortOrder: string;
  privateNote: string;
  headers: Headers;
  now?: Date;
}) {
  if (!isValidWorkshopTemplateId(input.publicId)) {
    return { status: 'not-found' as const };
  }

  const repository = getConfigurationRepositoryForHeaders(input.headers);
  const existing = await repository.getResponseTemplateByPublicId(
    input.publicId,
  );

  if (!existing) {
    return { status: 'not-found' as const };
  }

  const validatedText = validateTemplateText(
    existing.group,
    input.templateText,
  );

  if (!validatedText.valid) {
    return {
      status: 'invalid-text' as const,
      message: validatedText.error,
    };
  }

  const sortOrder = validateSortOrder(input.sortOrder);

  if (sortOrder === null) {
    return {
      status: 'invalid-sort-order' as const,
      message: 'Sort order must be a whole number of 0 or greater.',
    };
  }

  const validatedNote = validateRuleNote(input.privateNote);

  if (!validatedNote.valid) {
    return {
      status: 'invalid-note' as const,
      message: validatedNote.error,
    };
  }

  const safeguard = await ensureTemplateGroupRemainsValid({
    headers: input.headers,
    group: existing.group,
    currentPublicId: existing.publicId,
    nextTemplateText: validatedText.value,
    nextActive: input.active,
    removingActiveTemplate: existing.active && !input.active,
  });

  if (!safeguard.valid) {
    return {
      status: 'required-template-conflict' as const,
      message: safeguard.message,
    };
  }

  const template = await repository.updateResponseTemplate({
    publicId: existing.publicId,
    templateText: validatedText.value,
    active: input.active,
    sortOrder,
    privateNote: validatedNote.value || null,
    now: input.now ?? new Date(),
  });

  if (!template) {
    return { status: 'not-found' as const };
  }

  invalidateRuntimeConfigurationCache(input.headers);
  const activityLogged = await recordConfigurationActivity(input.headers, {
    action: 'response-template-updated',
    targetType: 'response-template',
    targetPublicId: template.publicId,
    details: `${getResponseTemplateGroupLabel(template.group)} updated`,
  });

  return {
    status: 'success' as const,
    template,
    activityLogged,
  };
}

export async function setWorkshopResponseTemplateActive(input: {
  publicId: string;
  active: boolean;
  headers: Headers;
  now?: Date;
}) {
  if (!isValidWorkshopTemplateId(input.publicId)) {
    return { status: 'not-found' as const };
  }

  const repository = getConfigurationRepositoryForHeaders(input.headers);
  const existing = await repository.getResponseTemplateByPublicId(
    input.publicId,
  );

  if (!existing) {
    return { status: 'not-found' as const };
  }

  if (existing.active === input.active) {
    return { status: 'no-op' as const, template: existing };
  }

  const safeguard = await ensureTemplateGroupRemainsValid({
    headers: input.headers,
    group: existing.group,
    currentPublicId: existing.publicId,
    nextActive: input.active,
    removingActiveTemplate: existing.active && !input.active,
  });

  if (!safeguard.valid) {
    return {
      status: 'required-template-conflict' as const,
      message: safeguard.message,
    };
  }

  const template = await repository.setResponseTemplateActive(
    input.publicId,
    input.active,
    input.now ?? new Date(),
  );

  if (!template) {
    return { status: 'not-found' as const };
  }

  invalidateRuntimeConfigurationCache(input.headers);
  const activityLogged = await recordConfigurationActivity(input.headers, {
    action: input.active
      ? 'response-template-enabled'
      : 'response-template-disabled',
    targetType: 'response-template',
    targetPublicId: template.publicId,
    details: `${getResponseTemplateGroupLabel(template.group)} · ${summarizeTemplateText(template.templateText)}`,
  });

  return {
    status: 'success' as const,
    template,
    activityLogged,
  };
}

export async function deleteWorkshopResponseTemplate(input: {
  publicId: string;
  headers: Headers;
}) {
  if (!isValidWorkshopTemplateId(input.publicId)) {
    return { status: 'not-found' as const };
  }

  const repository = getConfigurationRepositoryForHeaders(input.headers);
  const existing = await repository.getResponseTemplateByPublicId(
    input.publicId,
  );

  if (!existing) {
    return { status: 'not-found' as const };
  }

  const safeguard = await ensureTemplateGroupRemainsValid({
    headers: input.headers,
    group: existing.group,
    currentPublicId: existing.publicId,
    nextActive: false,
    removingActiveTemplate: existing.active,
  });

  if (!safeguard.valid) {
    return {
      status: 'required-template-conflict' as const,
      message: safeguard.message,
    };
  }

  const deleted = await repository.deleteResponseTemplate(input.publicId);

  if (!deleted) {
    return { status: 'not-found' as const };
  }

  invalidateRuntimeConfigurationCache(input.headers);
  const activityLogged = await recordConfigurationActivity(input.headers, {
    action: 'response-template-deleted',
    targetType: 'response-template',
    targetPublicId: existing.publicId,
    details: `${getResponseTemplateGroupLabel(existing.group)} deleted`,
  });

  return {
    status: 'success' as const,
    activityLogged,
  };
}
