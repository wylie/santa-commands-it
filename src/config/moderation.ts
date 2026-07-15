export type ModerationRules = {
  blockedWords: readonly string[];
  blockedPhrases: readonly string[];
  allowedExceptions: readonly string[];
};

export const moderationRules: ModerationRules = {
  // Replace these placeholder entries before launch with reviewed production rules.
  blockedWords: ['blocked-example'],
  blockedPhrases: ['coal for my enemy', 'hurt someone'],
  allowedExceptions: ['blocked-example parade'],
} as const;
