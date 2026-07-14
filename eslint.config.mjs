import js from '@eslint/js';
import globals from 'globals';
import * as astroParser from 'astro-eslint-parser';
import astroPlugin from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '.astro/',
      'dist/',
      'node_modules/',
      'playwright-report/',
      'coverage/',
      'test-results/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astroPlugin.configs['flat/recommended'],
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,astro}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.astro'],
    languageOptions: {
      parser: astroParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.astro'],
      },
    },
  },
  {
    files: ['playwright.config.ts', 'vitest.config.ts'],
    rules: {
      'no-undef': 'off',
    },
  },
];
