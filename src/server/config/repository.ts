import { randomUUID } from 'node:crypto';

import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

import { securitySettings } from '@/config/security';
import { getDatabase } from '@/server/db/client';
import {
  moderationRules as moderationRulesTable,
  responseTemplates as responseTemplatesTable,
  santaSettings as santaSettingsTable,
} from '@/server/db/schema';
import type {
  TestModerationRuleRecord,
  TestResponseTemplateRecord,
} from '@/server/testing/store';
import { getTestRunStore } from '@/server/testing/store';
import { serializeCreatedAt } from '@/utils/rulings';
import {
  type WorkshopModerationDashboardSummary,
  type WorkshopResponseTemplateDashboardSummary,
} from '@/server/workshop/dashboard';
import {
  type ModerationRuleCategoryFilter,
  type ModerationRuleType,
  type ModerationRuleTypeFilter,
  type ResponseTemplateGroup,
  type RuntimeModerationRule,
  type RuntimeResponseTemplate,
  type WorkshopModerationFilters,
  type WorkshopModerationRuleDetail,
  type WorkshopModerationRuleSummary,
  type WorkshopResponseTemplateDetail,
  type WorkshopResponseTemplateSummary,
  type WorkshopSantaSettings,
  WORKSHOP_RULE_ID_PREFIX,
  WORKSHOP_TEMPLATE_ID_PREFIX,
} from '@/utils/configuration';

export type ListModerationRulesResult = {
  rules: WorkshopModerationRuleSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type CreateModerationRuleInput = {
  ruleType: ModerationRuleType;
  value: string;
  normalizedValue: string;
  category: WorkshopModerationRuleDetail['category'];
  privateNote: string | null;
  active: boolean;
  createdSource: string | null;
  now: Date;
};

export type UpdateModerationRuleInput = {
  publicId: string;
  value: string;
  normalizedValue: string;
  category: WorkshopModerationRuleDetail['category'];
  privateNote: string | null;
  active: boolean;
  now: Date;
};

export type UpdateSantaSettingsInput = {
  expectedVersion: number;
  randomCoalEnabled: boolean;
  randomCoalPercentage: number;
  seasonalGreeting: string | null;
  now: Date;
};

export type CreateResponseTemplateInput = {
  group: ResponseTemplateGroup;
  templateText: string;
  active: boolean;
  sortOrder: number;
  privateNote: string | null;
  createdSource: string | null;
  now: Date;
};

export type UpdateResponseTemplateInput = {
  publicId: string;
  templateText: string;
  active: boolean;
  sortOrder: number;
  privateNote: string | null;
  now: Date;
};

export type ConfigurationRepository = {
  listModerationRules(
    filters: WorkshopModerationFilters,
  ): Promise<ListModerationRulesResult>;
  getModerationRuleByPublicId(
    publicId: string,
  ): Promise<WorkshopModerationRuleDetail | null>;
  getModerationRuleByTypeAndNormalizedValue(
    ruleType: ModerationRuleType,
    normalizedValue: string,
  ): Promise<WorkshopModerationRuleDetail | null>;
  createModerationRule(
    input: CreateModerationRuleInput,
  ): Promise<WorkshopModerationRuleDetail>;
  updateModerationRule(
    input: UpdateModerationRuleInput,
  ): Promise<WorkshopModerationRuleDetail | null>;
  setModerationRuleActive(
    publicId: string,
    active: boolean,
    now: Date,
  ): Promise<WorkshopModerationRuleDetail | null>;
  deleteModerationRule(publicId: string): Promise<boolean>;
  listActiveModerationRules(): Promise<RuntimeModerationRule[]>;
  getModerationDashboardSummary(): Promise<WorkshopModerationDashboardSummary>;
  getSantaSettings(): Promise<WorkshopSantaSettings | null>;
  updateSantaSettings(
    input: UpdateSantaSettingsInput,
  ): Promise<'conflict' | WorkshopSantaSettings | null>;
  listResponseTemplates(): Promise<WorkshopResponseTemplateSummary[]>;
  getResponseTemplateByPublicId(
    publicId: string,
  ): Promise<WorkshopResponseTemplateDetail | null>;
  createResponseTemplate(
    input: CreateResponseTemplateInput,
  ): Promise<WorkshopResponseTemplateDetail>;
  updateResponseTemplate(
    input: UpdateResponseTemplateInput,
  ): Promise<WorkshopResponseTemplateDetail | null>;
  setResponseTemplateActive(
    publicId: string,
    active: boolean,
    now: Date,
  ): Promise<WorkshopResponseTemplateDetail | null>;
  deleteResponseTemplate(publicId: string): Promise<boolean>;
  listActiveResponseTemplates(): Promise<RuntimeResponseTemplate[]>;
  getResponseTemplateDashboardSummary(): Promise<WorkshopResponseTemplateDashboardSummary>;
};

function mapModerationRuleRow(
  row: typeof moderationRulesTable.$inferSelect,
): WorkshopModerationRuleDetail {
  return {
    publicId: row.publicId,
    ruleType: row.ruleType,
    value: row.value,
    normalizedValue: row.normalizedValue,
    category: row.category,
    privateNote: row.privateNote,
    active: row.active,
    createdSource: row.createdSource,
    createdAt: serializeCreatedAt(row.createdAt),
    updatedAt: serializeCreatedAt(row.updatedAt),
  };
}

function mapResponseTemplateRow(
  row: typeof responseTemplatesTable.$inferSelect,
): WorkshopResponseTemplateDetail {
  return {
    publicId: row.publicId,
    group: row.group,
    templateText: row.templateText,
    active: row.active,
    sortOrder: row.sortOrder,
    privateNote: row.privateNote,
    createdSource: row.createdSource,
    createdAt: serializeCreatedAt(row.createdAt),
    updatedAt: serializeCreatedAt(row.updatedAt),
  };
}

function mapSantaSettingsRow(
  row: typeof santaSettingsTable.$inferSelect,
): WorkshopSantaSettings {
  return {
    randomCoalEnabled: row.randomCoalEnabled,
    randomCoalPercentage: row.randomCoalPercentage,
    seasonalGreeting: row.seasonalGreeting ?? '',
    version: row.version,
    updatedAt: serializeCreatedAt(row.updatedAt),
  };
}

function buildModerationWhere(filters: WorkshopModerationFilters) {
  const conditions: SQL[] = [];

  if (filters.ruleType !== 'all') {
    conditions.push(eq(moderationRulesTable.ruleType, filters.ruleType));
  }

  if (filters.status !== 'all') {
    conditions.push(
      eq(moderationRulesTable.active, filters.status === 'active'),
    );
  }

  if (filters.category !== 'all') {
    conditions.push(eq(moderationRulesTable.category, filters.category));
  }

  if (filters.query) {
    const pattern = `%${filters.query}%`;
    const search = or(
      ilike(moderationRulesTable.publicId, pattern),
      ilike(moderationRulesTable.value, pattern),
      ilike(moderationRulesTable.privateNote, pattern),
      ilike(moderationRulesTable.category, pattern),
    );

    if (search) {
      conditions.push(search);
    }
  }

  return conditions.length ? and(...conditions) : undefined;
}

function parseCount(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

export function createDatabaseConfigurationRepository(): ConfigurationRepository {
  return {
    async listModerationRules(filters) {
      const database = getDatabase();
      const pageSize = securitySettings.workshop.search.pageSize;
      const page = Math.max(1, filters.page);
      const offset = (page - 1) * pageSize;
      const whereClause = buildModerationWhere(filters);
      const [rows, totalRows] = await Promise.all([
        database
          .select()
          .from(moderationRulesTable)
          .where(whereClause)
          .orderBy(
            desc(moderationRulesTable.updatedAt),
            desc(moderationRulesTable.id),
          )
          .limit(pageSize)
          .offset(offset),
        database
          .select({ value: count() })
          .from(moderationRulesTable)
          .where(whereClause),
      ]);

      return {
        rules: rows.map(mapModerationRuleRow),
        total: Number(totalRows[0]?.value ?? 0),
        page,
        pageSize,
      };
    },
    async getModerationRuleByPublicId(publicId) {
      const database = getDatabase();
      const [row] = await database
        .select()
        .from(moderationRulesTable)
        .where(eq(moderationRulesTable.publicId, publicId))
        .limit(1);

      return row ? mapModerationRuleRow(row) : null;
    },
    async getModerationRuleByTypeAndNormalizedValue(ruleType, normalizedValue) {
      const database = getDatabase();
      const [row] = await database
        .select()
        .from(moderationRulesTable)
        .where(
          and(
            eq(moderationRulesTable.ruleType, ruleType),
            eq(moderationRulesTable.normalizedValue, normalizedValue),
          ),
        )
        .limit(1);

      return row ? mapModerationRuleRow(row) : null;
    },
    async createModerationRule(input) {
      const database = getDatabase();
      const [row] = await database
        .insert(moderationRulesTable)
        .values({
          publicId: `${WORKSHOP_RULE_ID_PREFIX}${randomUUID()}`,
          ruleType: input.ruleType,
          value: input.value,
          normalizedValue: input.normalizedValue,
          category: input.category,
          privateNote: input.privateNote,
          active: input.active,
          createdSource: input.createdSource,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .returning();

      if (!row) {
        throw new Error('Moderation rule insert did not return a row.');
      }

      return mapModerationRuleRow(row);
    },
    async updateModerationRule(input) {
      const database = getDatabase();
      const [row] = await database
        .update(moderationRulesTable)
        .set({
          value: input.value,
          normalizedValue: input.normalizedValue,
          category: input.category,
          privateNote: input.privateNote,
          active: input.active,
          updatedAt: input.now,
        })
        .where(eq(moderationRulesTable.publicId, input.publicId))
        .returning();

      return row ? mapModerationRuleRow(row) : null;
    },
    async setModerationRuleActive(publicId, active, now) {
      const database = getDatabase();
      const [row] = await database
        .update(moderationRulesTable)
        .set({
          active,
          updatedAt: now,
        })
        .where(eq(moderationRulesTable.publicId, publicId))
        .returning();

      return row ? mapModerationRuleRow(row) : null;
    },
    async deleteModerationRule(publicId) {
      const database = getDatabase();
      const deleted = await database
        .delete(moderationRulesTable)
        .where(eq(moderationRulesTable.publicId, publicId))
        .returning({ publicId: moderationRulesTable.publicId });

      return deleted.length > 0;
    },
    async listActiveModerationRules() {
      const database = getDatabase();
      const rows = await database
        .select()
        .from(moderationRulesTable)
        .where(eq(moderationRulesTable.active, true))
        .orderBy(
          asc(moderationRulesTable.createdAt),
          asc(moderationRulesTable.id),
        );

      return rows.map((row) => ({
        publicId: row.publicId,
        ruleType: row.ruleType,
        value: row.value,
        normalizedValue: row.normalizedValue,
        category: row.category,
      }));
    },
    async getModerationDashboardSummary() {
      const database = getDatabase();
      const result = await database.execute(sql<{
        activeBlockedWords: string;
        activeBlockedPhrases: string;
        activeAllowedExceptions: string;
        inactiveRules: string;
        lastUpdatedAt: string | null;
      }>`
        select
          count(*) filter (
            where ${moderationRulesTable.active} = true
              and ${moderationRulesTable.ruleType} = 'blocked-word'
          )::text as "activeBlockedWords",
          count(*) filter (
            where ${moderationRulesTable.active} = true
              and ${moderationRulesTable.ruleType} = 'blocked-phrase'
          )::text as "activeBlockedPhrases",
          count(*) filter (
            where ${moderationRulesTable.active} = true
              and ${moderationRulesTable.ruleType} = 'allowed-exception'
          )::text as "activeAllowedExceptions",
          count(*) filter (where ${moderationRulesTable.active} = false)::text as "inactiveRules",
          max(${moderationRulesTable.updatedAt})::text as "lastUpdatedAt"
        from ${moderationRulesTable}
      `);
      const row = result.rows[0] as
        | {
            activeBlockedWords: string;
            activeBlockedPhrases: string;
            activeAllowedExceptions: string;
            inactiveRules: string;
            lastUpdatedAt: string | null;
          }
        | undefined;

      return {
        activeBlockedWords: parseCount(row?.activeBlockedWords),
        activeBlockedPhrases: parseCount(row?.activeBlockedPhrases),
        activeAllowedExceptions: parseCount(row?.activeAllowedExceptions),
        inactiveRules: parseCount(row?.inactiveRules),
        lastUpdatedAt: row?.lastUpdatedAt ?? null,
      };
    },
    async getSantaSettings() {
      const database = getDatabase();
      const [row] = await database
        .select()
        .from(santaSettingsTable)
        .where(eq(santaSettingsTable.singletonKey, 'primary'))
        .limit(1);

      return row ? mapSantaSettingsRow(row) : null;
    },
    async updateSantaSettings(input) {
      const database = getDatabase();
      const [row] = await database
        .update(santaSettingsTable)
        .set({
          randomCoalEnabled: input.randomCoalEnabled,
          randomCoalPercentage: input.randomCoalPercentage,
          seasonalGreeting: input.seasonalGreeting,
          version: input.expectedVersion + 1,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(santaSettingsTable.singletonKey, 'primary'),
            eq(santaSettingsTable.version, input.expectedVersion),
          ),
        )
        .returning();

      if (!row) {
        const existing = await this.getSantaSettings();
        return existing ? 'conflict' : null;
      }

      return mapSantaSettingsRow(row);
    },
    async listResponseTemplates() {
      const database = getDatabase();
      const rows = await database
        .select()
        .from(responseTemplatesTable)
        .orderBy(
          asc(responseTemplatesTable.group),
          asc(responseTemplatesTable.sortOrder),
          desc(responseTemplatesTable.updatedAt),
          desc(responseTemplatesTable.id),
        );

      return rows.map(mapResponseTemplateRow);
    },
    async getResponseTemplateByPublicId(publicId) {
      const database = getDatabase();
      const [row] = await database
        .select()
        .from(responseTemplatesTable)
        .where(eq(responseTemplatesTable.publicId, publicId))
        .limit(1);

      return row ? mapResponseTemplateRow(row) : null;
    },
    async createResponseTemplate(input) {
      const database = getDatabase();
      const [row] = await database
        .insert(responseTemplatesTable)
        .values({
          publicId: `${WORKSHOP_TEMPLATE_ID_PREFIX}${randomUUID()}`,
          group: input.group,
          templateText: input.templateText,
          active: input.active,
          sortOrder: input.sortOrder,
          privateNote: input.privateNote,
          createdSource: input.createdSource,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .returning();

      if (!row) {
        throw new Error('Response template insert did not return a row.');
      }

      return mapResponseTemplateRow(row);
    },
    async updateResponseTemplate(input) {
      const database = getDatabase();
      const [row] = await database
        .update(responseTemplatesTable)
        .set({
          templateText: input.templateText,
          active: input.active,
          sortOrder: input.sortOrder,
          privateNote: input.privateNote,
          updatedAt: input.now,
        })
        .where(eq(responseTemplatesTable.publicId, input.publicId))
        .returning();

      return row ? mapResponseTemplateRow(row) : null;
    },
    async setResponseTemplateActive(publicId, active, now) {
      const database = getDatabase();
      const [row] = await database
        .update(responseTemplatesTable)
        .set({
          active,
          updatedAt: now,
        })
        .where(eq(responseTemplatesTable.publicId, publicId))
        .returning();

      return row ? mapResponseTemplateRow(row) : null;
    },
    async deleteResponseTemplate(publicId) {
      const database = getDatabase();
      const deleted = await database
        .delete(responseTemplatesTable)
        .where(eq(responseTemplatesTable.publicId, publicId))
        .returning({ publicId: responseTemplatesTable.publicId });

      return deleted.length > 0;
    },
    async listActiveResponseTemplates() {
      const database = getDatabase();
      const rows = await database
        .select()
        .from(responseTemplatesTable)
        .where(eq(responseTemplatesTable.active, true))
        .orderBy(
          asc(responseTemplatesTable.group),
          asc(responseTemplatesTable.sortOrder),
          asc(responseTemplatesTable.createdAt),
        );

      return rows.map((row) => ({
        publicId: row.publicId,
        group: row.group,
        templateText: row.templateText,
        sortOrder: row.sortOrder,
      }));
    },
    async getResponseTemplateDashboardSummary() {
      const database = getDatabase();
      const result = await database.execute(sql<{
        activeApprovedTemplates: string;
        activeCoalTemplates: string;
        activeBlockedWarningTemplates: string;
        inactiveTemplates: string;
        lastUpdatedAt: string | null;
      }>`
        select
          count(*) filter (
            where ${responseTemplatesTable.active} = true
              and ${responseTemplatesTable.group} = 'approved'
          )::text as "activeApprovedTemplates",
          count(*) filter (
            where ${responseTemplatesTable.active} = true
              and ${responseTemplatesTable.group} = 'coal'
          )::text as "activeCoalTemplates",
          count(*) filter (
            where ${responseTemplatesTable.active} = true
              and ${responseTemplatesTable.group} = 'blocked-warning'
          )::text as "activeBlockedWarningTemplates",
          count(*) filter (where ${responseTemplatesTable.active} = false)::text as "inactiveTemplates",
          max(${responseTemplatesTable.updatedAt})::text as "lastUpdatedAt"
        from ${responseTemplatesTable}
      `);
      const row = result.rows[0] as
        | {
            activeApprovedTemplates: string;
            activeCoalTemplates: string;
            activeBlockedWarningTemplates: string;
            inactiveTemplates: string;
            lastUpdatedAt: string | null;
          }
        | undefined;

      return {
        activeApprovedTemplates: parseCount(row?.activeApprovedTemplates),
        activeCoalTemplates: parseCount(row?.activeCoalTemplates),
        activeBlockedWarningTemplates: parseCount(
          row?.activeBlockedWarningTemplates,
        ),
        inactiveTemplates: parseCount(row?.inactiveTemplates),
        lastUpdatedAt: row?.lastUpdatedAt ?? null,
      };
    },
  };
}

function mapTestModerationRuleRow(
  row: TestModerationRuleRecord,
): WorkshopModerationRuleDetail {
  return {
    publicId: row.publicId,
    ruleType: row.ruleType,
    value: row.value,
    normalizedValue: row.normalizedValue,
    category: row.category,
    privateNote: row.privateNote,
    active: row.active,
    createdSource: row.createdSource,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapTestResponseTemplateRow(
  row: TestResponseTemplateRecord,
): WorkshopResponseTemplateDetail {
  return {
    publicId: row.publicId,
    group: row.group,
    templateText: row.templateText,
    active: row.active,
    sortOrder: row.sortOrder,
    privateNote: row.privateNote,
    createdSource: row.createdSource,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function filterTestModerationRules(
  rows: TestModerationRuleRecord[],
  query: string,
  ruleType: ModerationRuleTypeFilter,
  status: WorkshopModerationFilters['status'],
  category: ModerationRuleCategoryFilter,
) {
  const normalizedQuery = query.toLocaleLowerCase();

  return rows.filter((row) => {
    if (ruleType !== 'all' && row.ruleType !== ruleType) {
      return false;
    }

    if (status !== 'all' && row.active !== (status === 'active')) {
      return false;
    }

    if (category !== 'all' && row.category !== category) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [
      row.publicId,
      row.value,
      row.category ?? '',
      row.privateNote ?? '',
    ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}

export function createTestConfigurationRepository(
  runId: string,
): ConfigurationRepository {
  return {
    async listModerationRules(filters) {
      const store = getTestRunStore(runId);
      const pageSize = securitySettings.workshop.search.pageSize;
      const filtered = filterTestModerationRules(
        store.moderationRules,
        filters.query,
        filters.ruleType,
        filters.status,
        filters.category,
      ).sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
      );
      const page = Math.max(1, filters.page);
      const start = (page - 1) * pageSize;

      return {
        rules: filtered
          .slice(start, start + pageSize)
          .map(mapTestModerationRuleRow),
        total: filtered.length,
        page,
        pageSize,
      };
    },
    async getModerationRuleByPublicId(publicId) {
      const row = getTestRunStore(runId).moderationRules.find(
        (entry) => entry.publicId === publicId,
      );

      return row ? mapTestModerationRuleRow(row) : null;
    },
    async getModerationRuleByTypeAndNormalizedValue(ruleType, normalizedValue) {
      const row = getTestRunStore(runId).moderationRules.find(
        (entry) =>
          entry.ruleType === ruleType &&
          entry.normalizedValue === normalizedValue,
      );

      return row ? mapTestModerationRuleRow(row) : null;
    },
    async createModerationRule(input) {
      const store = getTestRunStore(runId);
      const row: TestModerationRuleRecord = {
        id: store.moderationRules.length + 1,
        publicId: `${WORKSHOP_RULE_ID_PREFIX}${randomUUID()}`,
        ruleType: input.ruleType,
        value: input.value,
        normalizedValue: input.normalizedValue,
        category: input.category,
        privateNote: input.privateNote,
        active: input.active,
        createdSource: input.createdSource,
        createdAt: input.now.toISOString(),
        updatedAt: input.now.toISOString(),
      };
      store.moderationRules.unshift(row);

      return mapTestModerationRuleRow(row);
    },
    async updateModerationRule(input) {
      const row = getTestRunStore(runId).moderationRules.find(
        (entry) => entry.publicId === input.publicId,
      );

      if (!row) {
        return null;
      }

      row.value = input.value;
      row.normalizedValue = input.normalizedValue;
      row.category = input.category;
      row.privateNote = input.privateNote;
      row.active = input.active;
      row.updatedAt = input.now.toISOString();

      return mapTestModerationRuleRow(row);
    },
    async setModerationRuleActive(publicId, active, now) {
      const row = getTestRunStore(runId).moderationRules.find(
        (entry) => entry.publicId === publicId,
      );

      if (!row) {
        return null;
      }

      row.active = active;
      row.updatedAt = now.toISOString();

      return mapTestModerationRuleRow(row);
    },
    async deleteModerationRule(publicId) {
      const store = getTestRunStore(runId);
      const index = store.moderationRules.findIndex(
        (entry) => entry.publicId === publicId,
      );

      if (index === -1) {
        return false;
      }

      store.moderationRules.splice(index, 1);
      return true;
    },
    async listActiveModerationRules() {
      return getTestRunStore(runId)
        .moderationRules.filter((row) => row.active)
        .map((row) => ({
          publicId: row.publicId,
          ruleType: row.ruleType,
          value: row.value,
          normalizedValue: row.normalizedValue,
          category: row.category,
        }));
    },
    async getModerationDashboardSummary() {
      const store = getTestRunStore(runId);

      return {
        activeBlockedWords: store.moderationRules.filter(
          (row) => row.active && row.ruleType === 'blocked-word',
        ).length,
        activeBlockedPhrases: store.moderationRules.filter(
          (row) => row.active && row.ruleType === 'blocked-phrase',
        ).length,
        activeAllowedExceptions: store.moderationRules.filter(
          (row) => row.active && row.ruleType === 'allowed-exception',
        ).length,
        inactiveRules: store.moderationRules.filter((row) => !row.active)
          .length,
        lastUpdatedAt:
          store.moderationRules
            .slice()
            .sort(
              (left, right) =>
                new Date(right.updatedAt).getTime() -
                new Date(left.updatedAt).getTime(),
            )[0]?.updatedAt ?? null,
      };
    },
    async getSantaSettings() {
      const settings = getTestRunStore(runId).santaSettings;
      return {
        randomCoalEnabled: settings.randomCoalEnabled,
        randomCoalPercentage: settings.randomCoalPercentage,
        seasonalGreeting: settings.seasonalGreeting,
        version: settings.version,
        updatedAt: settings.updatedAt,
      };
    },
    async updateSantaSettings(input) {
      const settings = getTestRunStore(runId).santaSettings;

      if (settings.version !== input.expectedVersion) {
        return 'conflict';
      }

      settings.randomCoalEnabled = input.randomCoalEnabled;
      settings.randomCoalPercentage = input.randomCoalPercentage;
      settings.seasonalGreeting = input.seasonalGreeting ?? '';
      settings.version += 1;
      settings.updatedAt = input.now.toISOString();

      return {
        randomCoalEnabled: settings.randomCoalEnabled,
        randomCoalPercentage: settings.randomCoalPercentage,
        seasonalGreeting: settings.seasonalGreeting,
        version: settings.version,
        updatedAt: settings.updatedAt,
      };
    },
    async listResponseTemplates() {
      return getTestRunStore(runId)
        .responseTemplates.slice()
        .sort((left, right) => {
          if (left.group !== right.group) {
            return left.group.localeCompare(right.group);
          }

          if (left.sortOrder !== right.sortOrder) {
            return left.sortOrder - right.sortOrder;
          }

          return (
            new Date(right.updatedAt).getTime() -
            new Date(left.updatedAt).getTime()
          );
        })
        .map(mapTestResponseTemplateRow);
    },
    async getResponseTemplateByPublicId(publicId) {
      const row = getTestRunStore(runId).responseTemplates.find(
        (entry) => entry.publicId === publicId,
      );

      return row ? mapTestResponseTemplateRow(row) : null;
    },
    async createResponseTemplate(input) {
      const store = getTestRunStore(runId);
      const row: TestResponseTemplateRecord = {
        id: store.responseTemplates.length + 1,
        publicId: `${WORKSHOP_TEMPLATE_ID_PREFIX}${randomUUID()}`,
        group: input.group,
        templateText: input.templateText,
        active: input.active,
        sortOrder: input.sortOrder,
        privateNote: input.privateNote,
        createdSource: input.createdSource,
        createdAt: input.now.toISOString(),
        updatedAt: input.now.toISOString(),
      };
      store.responseTemplates.push(row);

      return mapTestResponseTemplateRow(row);
    },
    async updateResponseTemplate(input) {
      const row = getTestRunStore(runId).responseTemplates.find(
        (entry) => entry.publicId === input.publicId,
      );

      if (!row) {
        return null;
      }

      row.templateText = input.templateText;
      row.active = input.active;
      row.sortOrder = input.sortOrder;
      row.privateNote = input.privateNote;
      row.updatedAt = input.now.toISOString();

      return mapTestResponseTemplateRow(row);
    },
    async setResponseTemplateActive(publicId, active, now) {
      const row = getTestRunStore(runId).responseTemplates.find(
        (entry) => entry.publicId === publicId,
      );

      if (!row) {
        return null;
      }

      row.active = active;
      row.updatedAt = now.toISOString();

      return mapTestResponseTemplateRow(row);
    },
    async deleteResponseTemplate(publicId) {
      const store = getTestRunStore(runId);
      const index = store.responseTemplates.findIndex(
        (entry) => entry.publicId === publicId,
      );

      if (index === -1) {
        return false;
      }

      store.responseTemplates.splice(index, 1);
      return true;
    },
    async listActiveResponseTemplates() {
      return getTestRunStore(runId)
        .responseTemplates.filter((row) => row.active)
        .sort((left, right) => {
          if (left.group !== right.group) {
            return left.group.localeCompare(right.group);
          }

          if (left.sortOrder !== right.sortOrder) {
            return left.sortOrder - right.sortOrder;
          }

          return (
            new Date(left.createdAt).getTime() -
            new Date(right.createdAt).getTime()
          );
        })
        .map((row) => ({
          publicId: row.publicId,
          group: row.group,
          templateText: row.templateText,
          sortOrder: row.sortOrder,
        }));
    },
    async getResponseTemplateDashboardSummary() {
      const store = getTestRunStore(runId);

      return {
        activeApprovedTemplates: store.responseTemplates.filter(
          (row) => row.active && row.group === 'approved',
        ).length,
        activeCoalTemplates: store.responseTemplates.filter(
          (row) => row.active && row.group === 'coal',
        ).length,
        activeBlockedWarningTemplates: store.responseTemplates.filter(
          (row) => row.active && row.group === 'blocked-warning',
        ).length,
        inactiveTemplates: store.responseTemplates.filter((row) => !row.active)
          .length,
        lastUpdatedAt:
          store.responseTemplates
            .slice()
            .sort(
              (left, right) =>
                new Date(right.updatedAt).getTime() -
                new Date(left.updatedAt).getTime(),
            )[0]?.updatedAt ?? null,
      };
    },
  };
}
