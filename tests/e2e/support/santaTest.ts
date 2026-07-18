import { randomUUID } from 'node:crypto';

import { expect, type Page } from '@playwright/test';

type ShareMode = 'supported' | 'cancel';
type CopyMode = 'success' | 'fail';

export async function configureSantaTestPage(
  page: Page,
  options: {
    consideringDelayMs?: number;
    formElapsedMs?: number;
    requestTimeoutMs?: number;
    randomValue?: number;
    scenario?: 'submit-error' | 'recent-unavailable' | 'report-error';
    shareMode?: ShareMode;
    copyMode?: CopyMode;
    clientId?: string;
    nowIso?: string;
  } = {},
) {
  const runId = randomUUID();
  const headers: Record<string, string> = {
    'x-santa-test-run-id': runId,
  };

  if (options.clientId) {
    headers['x-santa-test-client-id'] = options.clientId;
  }

  if (typeof options.randomValue === 'number') {
    headers['x-santa-test-random'] = String(options.randomValue);
  }

  if (options.nowIso) {
    headers['x-santa-test-now'] = options.nowIso;
  }

  if (options.scenario) {
    headers['x-santa-test-scenario'] = options.scenario;
  }

  await page.setExtraHTTPHeaders(headers);
  await page.addInitScript((config) => {
    window.__SANTA_TEST__ = {
      consideringDelayMs: config.consideringDelayMs ?? 0,
      formElapsedMs: config.formElapsedMs ?? 2000,
      requestTimeoutMs: config.requestTimeoutMs,
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
    website?: string;
    formElapsedMs?: number;
    nowIso?: string;
  },
) {
  const response = await page.request.post('/api/rulings', {
    headers: {
      ...headers,
      'content-type': 'application/json',
      'x-idempotency-key': randomUUID(),
      ...(data.nowIso ? { 'x-santa-test-now': data.nowIso } : {}),
    },
    data: {
      ...data,
      website: data.website ?? '',
      formElapsedMs: data.formElapsedMs ?? 2000,
    },
  });

  expect(response.ok()).toBe(true);

  return response.json();
}

export async function createReportViaApi(
  page: Page,
  headers: Record<string, string>,
  publicId: string,
  data: {
    reason: string;
    note?: string;
    nowIso?: string;
  },
) {
  const response = await page.request.post(`/api/rulings/${publicId}/reports`, {
    headers: {
      ...headers,
      'content-type': 'application/json',
      ...(data.nowIso ? { 'x-santa-test-now': data.nowIso } : {}),
    },
    data,
  });

  return response;
}
