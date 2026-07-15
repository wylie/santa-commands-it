/// <reference types="astro/client" />

declare global {
  interface Window {
    __SANTA_TEST__?: {
      randomValues?: number[];
      consideringDelayMs?: number;
    };
  }
}

export {};
