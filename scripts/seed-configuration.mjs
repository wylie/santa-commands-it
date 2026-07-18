import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { neon } from '@neondatabase/serverless';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is required before seeding configuration for Santa Commands It!',
  );
  process.exit(1);
}

function stripCombiningMarks(value) {
  return value.normalize('NFKD').replace(/\p{Mark}+/gu, '');
}

function normalizeForModeration(value) {
  return stripCombiningMarks(value)
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenizeForPhrases(value) {
  return normalizeForModeration(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeModerationRuleValue(ruleType, value) {
  if (ruleType === 'blocked-word') {
    return normalizeForModeration(value).replace(/[^\p{L}\p{N}]+/gu, '');
  }

  return tokenizeForPhrases(value).join(' ');
}

const moderationRulesTable = pgTable('moderation_rules', {
  publicId: text('public_id').notNull(),
  ruleType: text('rule_type').notNull(),
  value: text('value').notNull(),
  normalizedValue: text('normalized_value').notNull(),
  category: text('category'),
  privateNote: text('private_note'),
  active: boolean('active').notNull(),
  createdSource: text('created_source'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

const santaSettingsTable = pgTable('santa_settings', {
  singletonKey: text('singleton_key').notNull(),
  randomCoalEnabled: boolean('random_coal_enabled').notNull(),
  randomCoalPercentage: integer('random_coal_percentage').notNull(),
  version: integer('version').notNull(),
  createdSource: text('created_source'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

const responseTemplatesTable = pgTable('response_templates', {
  publicId: text('public_id').notNull(),
  group: text('group').notNull(),
  templateText: text('template_text').notNull(),
  active: boolean('active').notNull(),
  sortOrder: integer('sort_order').notNull(),
  privateNote: text('private_note'),
  createdSource: text('created_source'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

const defaultsPath = new URL(
  '../src/config/configuration-seed-defaults.json',
  import.meta.url,
);
const defaults = JSON.parse(readFileSync(defaultsPath, 'utf8'));
const database = drizzle(neon(process.env.DATABASE_URL));
const now = new Date();
const SOURCE_MARKER = 'source-migration';

const ruleCategoryMap = new Map([
  ['blocked-word:blocked-example', 'test-fixture'],
  ['blocked-phrase:coal for my enemy', 'bullying'],
  ['blocked-phrase:hurt someone', 'violence'],
  ['allowed-exception:blocked-example parade', 'test-fixture'],
]);

const moderationSeed = [
  ...defaults.moderationRules.blockedWords.map((value) => ({
    ruleType: 'blocked-word',
    value,
  })),
  ...defaults.moderationRules.blockedPhrases.map((value) => ({
    ruleType: 'blocked-phrase',
    value,
  })),
  ...defaults.moderationRules.allowedExceptions.map((value) => ({
    ruleType: 'allowed-exception',
    value,
  })),
].map((entry) => ({
  ...entry,
  normalizedValue: normalizeModerationRuleValue(entry.ruleType, entry.value),
  category:
    ruleCategoryMap.get(
      `${entry.ruleType}:${entry.value.toLocaleLowerCase()}`,
    ) ?? null,
}));

const responseTemplateSeed = [
  ...defaults.responseTemplates.approved.map((templateText, index) => ({
    group: 'approved',
    templateText,
    sortOrder: index,
  })),
  ...defaults.responseTemplates.coal.map((templateText, index) => ({
    group: 'coal',
    templateText,
    sortOrder: index,
  })),
  ...defaults.responseTemplates.blockedWarning.map((templateText, index) => ({
    group: 'blocked-warning',
    templateText,
    sortOrder: index,
  })),
];

const moderationSummary = {
  added: {
    'blocked-word': 0,
    'blocked-phrase': 0,
    'allowed-exception': 0,
  },
  skipped: {
    'blocked-word': 0,
    'blocked-phrase': 0,
    'allowed-exception': 0,
  },
};

const templateSummary = {
  added: {
    approved: 0,
    coal: 0,
    'blocked-warning': 0,
  },
  skipped: {
    approved: 0,
    coal: 0,
    'blocked-warning': 0,
  },
};

let settingsStatus = 'skipped';

for (const rule of moderationSeed) {
  const [existing] = await database
    .select({ publicId: moderationRulesTable.publicId })
    .from(moderationRulesTable)
    .where(
      and(
        eq(moderationRulesTable.ruleType, rule.ruleType),
        eq(moderationRulesTable.normalizedValue, rule.normalizedValue),
      ),
    )
    .limit(1);

  if (existing) {
    moderationSummary.skipped[rule.ruleType] += 1;
    continue;
  }

  await database.insert(moderationRulesTable).values({
    publicId: `rule_${randomUUID()}`,
    ruleType: rule.ruleType,
    value: rule.value,
    normalizedValue: rule.normalizedValue,
    category: rule.category,
    privateNote: null,
    active: true,
    createdSource: SOURCE_MARKER,
    createdAt: now,
    updatedAt: now,
  });

  moderationSummary.added[rule.ruleType] += 1;
}

const [existingSettings] = await database
  .select({ singletonKey: santaSettingsTable.singletonKey })
  .from(santaSettingsTable)
  .where(eq(santaSettingsTable.singletonKey, 'primary'))
  .limit(1);

if (!existingSettings) {
  await database.insert(santaSettingsTable).values({
    singletonKey: 'primary',
    randomCoalEnabled: defaults.santaSettings.randomCoalEnabled,
    randomCoalPercentage: defaults.santaSettings.randomCoalPercentage,
    version: 1,
    createdSource: SOURCE_MARKER,
    createdAt: now,
    updatedAt: now,
  });
  settingsStatus = 'added';
}

for (const template of responseTemplateSeed) {
  const [existing] = await database
    .select({ publicId: responseTemplatesTable.publicId })
    .from(responseTemplatesTable)
    .where(
      and(
        eq(responseTemplatesTable.group, template.group),
        eq(responseTemplatesTable.templateText, template.templateText),
      ),
    )
    .limit(1);

  if (existing) {
    templateSummary.skipped[template.group] += 1;
    continue;
  }

  await database.insert(responseTemplatesTable).values({
    publicId: `template_${randomUUID()}`,
    group: template.group,
    templateText: template.templateText,
    active: true,
    sortOrder: template.sortOrder,
    privateNote: null,
    createdSource: SOURCE_MARKER,
    createdAt: now,
    updatedAt: now,
  });

  templateSummary.added[template.group] += 1;
}

console.log('[configuration-seed] moderation rules', moderationSummary);
console.log('[configuration-seed] santa settings', { status: settingsStatus });
console.log('[configuration-seed] response templates', templateSummary);
