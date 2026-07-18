import { configurationSeedDefaults } from '@/utils/configuration';

export type ModerationRules = {
  blockedWords: readonly string[];
  blockedPhrases: readonly string[];
  allowedExceptions: readonly string[];
};

export const moderationRules: ModerationRules = {
  blockedWords: configurationSeedDefaults.moderationRules.blockedWords,
  blockedPhrases: configurationSeedDefaults.moderationRules.blockedPhrases,
  allowedExceptions:
    configurationSeedDefaults.moderationRules.allowedExceptions,
} as const;
