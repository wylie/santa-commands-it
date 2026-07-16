/* eslint-disable @typescript-eslint/no-unused-vars */
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly DATABASE_URL?: string;
  readonly SANTA_TEST_MODE?: 'e2e';
}

declare global {
  interface Window {
    __SANTA_TEST__?: {
      consideringDelayMs?: number;
    };
  }
}

export {};
