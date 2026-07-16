import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

async function configureSantaTestPage(
  page: Page,
  options: {
    consideringDelayMs?: number;
    randomValue?: number;
    scenario?: 'submit-error' | 'recent-unavailable';
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
  }, options);

  return { runId, headers };
}

async function fillRequestForm(
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

test.describe('Santa Commands It homepage', () => {
  test('shows the empty state when no persisted rulings exist', async ({
    page,
  }) => {
    await configureSantaTestPage(page);
    await page.goto('/');

    await expect(
      page.getByText('Santa has not made any public commands yet.'),
    ).toBeVisible();
  });

  test('persists an approved ruling and shows it after reload', async ({
    page,
  }) => {
    await configureSantaTestPage(page, {
      randomValue: 0.5,
      consideringDelayMs: 0,
    });
    await page.goto('/');

    await fillRequestForm(page, 'A brass telescope');
    await page.getByRole('button', { name: 'ASK SANTA' }).click();

    await expect(
      page.locator('[data-response-panel][data-mode="approved"]'),
    ).toBeVisible();
    await expect(page.locator('[data-recent-list] >> nth=0')).toContainText(
      'Holly',
    );
    await expect(page.locator('[data-recent-list] >> nth=0')).toContainText(
      'A brass telescope',
    );
    await expect(page.locator('[data-recent-list] >> nth=0')).toContainText(
      'SANTA COMMANDS IT',
    );

    await page.reload();

    await expect(page.locator('[data-recent-list] >> nth=0')).toContainText(
      'A brass telescope',
    );
  });

  test('persists a deterministic coal ruling and shows it after reload', async ({
    page,
  }) => {
    await configureSantaTestPage(page, {
      randomValue: 0.01,
      consideringDelayMs: 0,
    });
    await page.goto('/');

    await fillRequestForm(page, 'A brass telescope');
    await page.getByRole('button', { name: 'ASK SANTA' }).click();

    await expect(
      page.locator('[data-response-panel][data-mode="random-coal"]'),
    ).toBeVisible();
    await expect(page.locator('[data-recent-list] >> nth=0')).toContainText(
      'COAL',
    );

    await page.reload();

    await expect(page.locator('[data-recent-list] >> nth=0')).toContainText(
      'COAL',
    );
  });

  test('blocked submissions are not added to the feed and do not persist after reload', async ({
    page,
  }) => {
    await configureSantaTestPage(page, {
      consideringDelayMs: 0,
    });
    await page.goto('/');

    await fillRequestForm(page, 'Please arrange coal for my enemy.');
    await page.getByRole('button', { name: 'ASK SANTA' }).click();

    await expect(
      page.locator('[data-response-panel][data-mode="blocked"]'),
    ).toBeVisible();
    await expect(page.locator('[data-recent-list]')).toHaveCount(0);

    await page.reload();

    await expect(
      page.getByText('Santa has not made any public commands yet.'),
    ).toBeVisible();
  });

  test('shows server validation errors when the request body is malformed', async ({
    page,
  }) => {
    await configureSantaTestPage(page, {
      consideringDelayMs: 0,
    });

    await page.route('**/api/rulings', async (route) => {
      await route.continue({
        headers: {
          ...route.request().headers(),
          'content-type': 'application/json',
        },
        postData: JSON.stringify({}),
      });
    });

    await page.goto('/');
    await fillRequestForm(page, 'A brass telescope');
    await page.getByRole('button', { name: 'ASK SANTA' }).click();

    await expect(
      page.getByText('Please tell Santa what to call you.'),
    ).toBeVisible();
    await expect(
      page.getByText('Please tell Santa what you would like.'),
    ).toBeVisible();
  });

  test('preserves form values on a recoverable server failure', async ({
    page,
  }) => {
    await configureSantaTestPage(page, {
      scenario: 'submit-error',
      consideringDelayMs: 0,
    });
    await page.goto('/');

    await fillRequestForm(page, 'A brass telescope');
    await page.getByRole('button', { name: 'ASK SANTA' }).click();

    await expect(
      page.locator('[data-response-panel][data-mode="error"]'),
    ).toBeVisible();
    await expect(page.getByLabel('What should Santa call you?')).toHaveValue(
      'Holly',
    );
    await expect(
      page.getByRole('textbox', {
        name: 'What would you like from Santa?',
      }),
    ).toHaveValue('A brass telescope');
  });

  test('prevents duplicate clicks from creating duplicate visible rulings', async ({
    page,
  }) => {
    await configureSantaTestPage(page, {
      randomValue: 0.5,
      consideringDelayMs: 300,
    });
    await page.goto('/');

    await fillRequestForm(page, 'A brass telescope');
    const submitButton = page.getByRole('button', { name: 'ASK SANTA' });
    await submitButton.dblclick();

    await expect(
      page.getByRole('button', { name: 'ASK SANTA SOMETHING ELSE' }),
    ).toBeVisible();
    await expect(page.locator('[data-recent-list] > li')).toHaveCount(1);
  });

  test('renders HTML-like input as text in the response panel and feed', async ({
    page,
  }) => {
    await configureSantaTestPage(page, {
      randomValue: 0.5,
      consideringDelayMs: 0,
    });
    await page.goto('/');

    const requestText = '<img src=x onerror=alert(1)>';
    await fillRequestForm(page, requestText, '<Holly>');
    await page.getByRole('button', { name: 'ASK SANTA' }).click();

    await expect(page.locator('[data-response-request]')).toHaveText(
      requestText,
    );
    const firstRecentItem = page.locator('[data-recent-list] > li').first();
    await expect(firstRecentItem.locator('[data-decision]')).toContainText(
      'SANTA COMMANDS IT',
    );
    await expect(firstRecentItem).toContainText(requestText);
    await expect(page.locator('[data-recent-list] img')).toHaveCount(0);
  });

  test('keeps only the configured visible number of latest commands', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page, {
      randomValue: 0.5,
    });

    for (let index = 0; index < 11; index += 1) {
      const response = await page.request.post('/api/rulings', {
        headers: {
          ...headers,
          'content-type': 'application/json',
        },
        data: {
          name: `Holly ${index}`,
          request: `Request number ${index}`,
        },
      });

      expect(response.ok()).toBe(true);
    }

    await page.goto('/');
    await expect(page.locator('[data-recent-list] > li')).toHaveCount(10);
    await expect(page.locator('[data-recent-list] >> nth=0')).toContainText(
      'Request number 10',
    );
    await expect(page.locator('[data-recent-list]')).not.toContainText(
      'Request number 0',
    );
  });

  test('shows the recent-rulings unavailable state without breaking the page', async ({
    page,
  }) => {
    await configureSantaTestPage(page, {
      scenario: 'recent-unavailable',
    });
    await page.goto('/');

    await expect(
      page.getByText("Santa's announcement board is temporarily unavailable."),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'ASK SANTA' })).toBeVisible();
  });

  test('stays within the viewport on mobile with long persisted content', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page, {
      randomValue: 0.5,
      consideringDelayMs: 0,
    });
    await page.request.post('/api/rulings', {
      headers: {
        ...headers,
        'content-type': 'application/json',
      },
      data: {
        name: 'Holly',
        request: `https://example.com/${'verylongword'.repeat(30)}`,
      },
    });

    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/');

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalOverflow).toBe(false);
  });
});
