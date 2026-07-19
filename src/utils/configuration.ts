import seedDefaults from '@/config/configuration-seed-defaults.json';

export const moderationRuleTypes = [
  {
    value: 'blocked-word',
    label: 'Blocked word',
  },
  {
    value: 'blocked-phrase',
    label: 'Blocked phrase',
  },
  {
    value: 'allowed-exception',
    label: 'Allowed exception',
  },
] as const;

export type ModerationRuleType = (typeof moderationRuleTypes)[number]['value'];

export const moderationRuleCategories = [
  {
    value: 'bullying',
    label: 'Bullying',
  },
  {
    value: 'harassment',
    label: 'Harassment',
  },
  {
    value: 'hate',
    label: 'Hate',
  },
  {
    value: 'violence',
    label: 'Violence',
  },
  {
    value: 'sexual-content',
    label: 'Sexual content',
  },
  {
    value: 'personal-information',
    label: 'Personal information',
  },
  {
    value: 'dangerous-content',
    label: 'Dangerous content',
  },
  {
    value: 'spam',
    label: 'Spam',
  },
  {
    value: 'profanity',
    label: 'Profanity',
  },
  {
    value: 'general',
    label: 'General',
  },
  {
    value: 'test-fixture',
    label: 'Test fixture',
  },
] as const;

export type ModerationRuleCategory =
  (typeof moderationRuleCategories)[number]['value'];

export const responseTemplateGroups = [
  {
    value: 'approved',
    label: 'Approved',
  },
  {
    value: 'coal',
    label: 'Coal',
  },
  {
    value: 'blocked-warning',
    label: 'Blocked warning',
  },
] as const;

export type ResponseTemplateGroup =
  (typeof responseTemplateGroups)[number]['value'];

export type ModerationRuleStatusFilter = 'all' | 'active' | 'inactive';
export type ModerationRuleTypeFilter = 'all' | ModerationRuleType;
export type ModerationRuleCategoryFilter = 'all' | ModerationRuleCategory;

export type WorkshopModerationRuleSummary = {
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

export type WorkshopModerationRuleDetail = WorkshopModerationRuleSummary;

export type RuntimeModerationRule = {
  publicId: string;
  ruleType: ModerationRuleType;
  value: string;
  normalizedValue: string;
  category: ModerationRuleCategory | null;
};

export type WorkshopModerationFilters = {
  query: string;
  ruleType: ModerationRuleTypeFilter;
  status: ModerationRuleStatusFilter;
  category: ModerationRuleCategoryFilter;
  page: number;
};

export type WorkshopSantaSettings = {
  randomCoalEnabled: boolean;
  randomCoalPercentage: number;
  seasonalGreeting: string;
  version: number;
  updatedAt: string;
};

export type WorkshopResponseTemplateSummary = {
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

export type WorkshopResponseTemplateDetail = WorkshopResponseTemplateSummary;

export type RuntimeSantaSettings = {
  randomCoalEnabled: boolean;
  randomCoalPercentage: number;
  seasonalGreeting: string;
  version: number;
};

export type RuntimeResponseTemplate = {
  publicId: string;
  group: ResponseTemplateGroup;
  templateText: string;
  sortOrder: number;
};

export const WORKSHOP_RULE_ID_PREFIX = 'rule_';
export const WORKSHOP_TEMPLATE_ID_PREFIX = 'template_';

const WORKSHOP_RULE_ID_PATTERN = /^rule_[a-z0-9-]{24,80}$/;
const WORKSHOP_TEMPLATE_ID_PATTERN = /^template_[a-z0-9-]{24,80}$/;

export const configurationSeedDefaults = seedDefaults as {
  moderationRules: {
    blockedWords: string[];
    blockedPhrases: string[];
    allowedExceptions: string[];
  };
  santaSettings: {
    randomCoalEnabled: boolean;
    randomCoalPercentage: number;
    seasonalGreeting?: string;
  };
  responseTemplates: {
    approved: string[];
    coal: string[];
    blockedWarning: string[];
  };
};

export function isModerationRuleType(
  value: unknown,
): value is ModerationRuleType {
  return moderationRuleTypes.some((entry) => entry.value === value);
}

export function isModerationRuleCategory(
  value: unknown,
): value is ModerationRuleCategory {
  return moderationRuleCategories.some((entry) => entry.value === value);
}

export function isResponseTemplateGroup(
  value: unknown,
): value is ResponseTemplateGroup {
  return responseTemplateGroups.some((entry) => entry.value === value);
}

export function getModerationRuleTypeLabel(
  ruleType: ModerationRuleType,
): string {
  return (
    moderationRuleTypes.find((entry) => entry.value === ruleType)?.label ??
    'Unknown'
  );
}

export function getModerationRuleCategoryLabel(
  category: ModerationRuleCategory | null,
): string {
  if (!category) {
    return 'Uncategorized';
  }

  return (
    moderationRuleCategories.find((entry) => entry.value === category)?.label ??
    'Unknown'
  );
}

export function getResponseTemplateGroupLabel(
  group: ResponseTemplateGroup,
): string {
  return (
    responseTemplateGroups.find((entry) => entry.value === group)?.label ??
    'Unknown'
  );
}

export function coerceModerationRuleTypeFilter(
  value: string | null,
): ModerationRuleTypeFilter {
  return isModerationRuleType(value) ? value : 'all';
}

export function coerceModerationRuleStatusFilter(
  value: string | null,
): ModerationRuleStatusFilter {
  return value === 'active' || value === 'inactive' ? value : 'all';
}

export function coerceModerationRuleCategoryFilter(
  value: string | null,
): ModerationRuleCategoryFilter {
  return isModerationRuleCategory(value) ? value : 'all';
}

export function isValidWorkshopRuleId(value: string): boolean {
  return WORKSHOP_RULE_ID_PATTERN.test(value);
}

export function isValidWorkshopTemplateId(value: string): boolean {
  return WORKSHOP_TEMPLATE_ID_PATTERN.test(value);
}
