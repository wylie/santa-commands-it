import { randomUUID } from 'node:crypto';

import { expect, type Page } from '@playwright/test';

type ShareMode = 'supported' | 'cancel';
type CopyMode = 'success' | 'fail';

export async function configureSantaTestPage(
  page: Page,
  options: {
    consideringDelayMs?: number;
    randomValue?: number;
    scenario?: 'submit-error' | 'recent-unavailable';
    shareMode?: ShareMode;
    copyMode?: CopyMode;
  } = {},
) {
  const runId = randomUUID();
  const headers: Record<string, string> = {
    'x-santa-test-run-id': runId,
  };

  if (typeof options.randomValue === 'number') {
    headers['x-santa-test-random'] = String(options.randomValue);
  }

  if (options.scenario) {
    headers['x-santa-test-scenario'] = options.scenario;
  }

  await page.setExtraHTTPHeaders(headers);
  await page.addInitScript((config) => {
    window.__SANTA_TEST__ = {
      consideringDelayMs: config.consideringDelayMs ?? 0,
    };

    if (config.copyMode === 'success') {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (
              window as Window & { __lastCopiedText?: string }
            ).__lastCopiedText = text;
          },
        },
      });
    }

    if (config.copyMode === 'fail') {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error('copy failed');
          },
        },
      });

      Object.defineProperty(Document.prototype, 'execCommand', {
        configurable: true,
        value: () => false,
      });
    }

    if (config.shareMode === 'supported' || config.shareMode === 'cancel') {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async (payload: ShareData) => {
          (
            window as Window & { __lastSharePayload?: ShareData }
          ).__lastSharePayload = payload;

          if (config.shareMode === 'cancel') {
            throw new DOMException(
              'The share dialog was canceled.',
              'AbortError',
            );
          }
        },
      });
    }
  }, options);

  return { runId, headers };
}

export async function fillRequestForm(
  page: Page,
  requestText: string,
  name = 'Holly',
) {
  await page.getByLabel('What should Santa call you?').fill(name);
  await page
    .getByRole('textbox', {
      name: 'What would you like from Santa?',
    })
    .fill(requestText);
}

export async function createRulingViaApi(
  page: Page,
  headers: Record<string, string>,
  data: {
    name: string;
    request: string;
  },
) {
  const response = await page.request.post('/api/rulings', {
    headers: {
      ...headers,
      'content-type': 'application/json',
    },
    data,
  });

  expect(response.ok()).toBe(true);

  return response.json();
}
