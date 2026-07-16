import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

const baseUrl = process.env.LIGHTHOUSE_BASE_URL ?? 'http://127.0.0.1:4321';

async function createRepresentativeRuling() {
  const runId = randomUUID();
  const extraHeaders = {
    'x-santa-test-run-id': runId,
    'x-santa-test-client-id': 'lighthouse-client',
    'x-santa-test-random': '0.5',
  };
  const response = await fetch(`${baseUrl}/api/rulings`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-idempotency-key': randomUUID(),
      ...extraHeaders,
    },
    body: JSON.stringify({
      name: 'Holly',
      request: 'A brass telescope for winter stargazing',
      website: '',
      formElapsedMs: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Could not create a representative ruling for Lighthouse: ${response.status}`,
    );
  }

  const payload = await response.json();

  if (
    !payload ||
    typeof payload !== 'object' ||
    !('ruling' in payload) ||
    typeof payload.ruling !== 'object' ||
    payload.ruling === null ||
    !('publicId' in payload.ruling) ||
    typeof payload.ruling.publicId !== 'string'
  ) {
    throw new Error(
      'Representative ruling payload was not in the expected shape.',
    );
  }

  return {
    extraHeaders,
    publicId: payload.ruling.publicId,
  };
}

const chrome = await launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const { extraHeaders, publicId } = await createRepresentativeRuling();
  const targets = [
    {
      name: 'homepage',
      url: `${baseUrl}/`,
    },
    {
      name: 'ruling-page',
      url: `${baseUrl}/rulings/${publicId}`,
    },
  ];

  for (const target of targets) {
    const result = await lighthouse(target.url, {
      port: chrome.port,
      output: 'json',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      logLevel: 'error',
      extraHeaders,
    });

    if (!result) {
      throw new Error(`Lighthouse did not return a result for ${target.name}.`);
    }

    const categories = result.lhr.categories;

    console.log(
      JSON.stringify({
        target: target.name,
        performance: categories.performance?.score ?? null,
        accessibility: categories.accessibility?.score ?? null,
        bestPractices: categories['best-practices']?.score ?? null,
        seo: categories.seo?.score ?? null,
      }),
    );
  }
} finally {
  chrome.kill();
}
