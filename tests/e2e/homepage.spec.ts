import { expect, test } from '@playwright/test';

import {
  configureSantaTestPage,
  createRulingViaApi,
  fillRequestForm,
} from './support/santaTest';

test.describe('Santa Commands It homepage', () => {
  test('shows the empty state when no persisted rulings exist', async ({
    page,
  }) => {
    await configureSantaTestPage(page);
    await page.goto('/');

    await expect(
      page.getByAltText(/vintage-style portrait of Santa Claus/i),
    ).toBeVisible();
    await expect(page.getByText('public/images/santa.png')).toHaveCount(0);

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
    await expect(page.locator('[data-request-permalink]')).toBeVisible();
    await expect(page.locator('[data-recent-list] >> nth=0')).toContainText(
      'Holly',
    );
    await expect(page.locator('[data-recent-list] >> nth=0')).toContainText(
      'A brass telescope',
    );
    await expect(page.locator('[data-recent-list] >> nth=0')).toContainText(
      'SANTA COMMANDS IT',
    );
    await expect(
      page.locator('[data-recent-list] > li').first().getByRole('link'),
    ).toHaveAttribute('href', /\/rulings\/[0-9a-f-]+$/);

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
    await expect(page.locator('[data-request-permalink]')).toBeVisible();

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
    await expect(page.locator('[data-request-permalink]')).toBeHidden();

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

  test('recovers cleanly when a submission request times out', async ({
    page,
  }) => {
    await configureSantaTestPage(page, {
      consideringDelayMs: 0,
      requestTimeoutMs: 100,
    });

    await page.route('**/api/rulings', async (route) => {
      await new Promise((resolve) => {
        setTimeout(resolve, 350);
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'error',
          message: "Santa's workshop had a small mishap. Please try again.",
        }),
      });
    });

    await page.goto('/');
    await fillRequestForm(page, 'A brass telescope');
    await page.getByRole('button', { name: 'ASK SANTA' }).click();

    await expect(
      page.locator('[data-response-panel][data-mode="error"]'),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Santa's workshop is taking longer than usual. Please try again.",
      ),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'ASK SANTA' })).toBeEnabled();
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

  test('does not create a second visible ruling for the same request inside the duplicate window', async ({
    page,
  }) => {
    await configureSantaTestPage(page, {
      randomValue: 0.5,
      consideringDelayMs: 0,
      clientId: 'duplicate-window-client',
    });
    await page.goto('/');

    await fillRequestForm(page, 'A brass telescope');
    await page.getByRole('button', { name: 'ASK SANTA' }).click();

    await expect(page.locator('[data-recent-list] > li')).toHaveCount(1);

    await page
      .getByRole('button', { name: 'ASK SANTA SOMETHING ELSE' })
      .click();
    await page
      .getByRole('textbox', {
        name: 'What would you like from Santa?',
      })
      .fill('A brass telescope');
    await page.getByRole('button', { name: 'ASK SANTA' }).click();

    await expect(page.locator('[data-recent-list] > li')).toHaveCount(1);
    await expect(
      page.locator('[data-response-panel][data-mode="approved"]'),
    ).toBeVisible();
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
      await createRulingViaApi(page, headers, {
        name: `Holly ${index}`,
        request: `Request number ${index}`,
        formElapsedMs: 2000,
      });
      headers['x-santa-test-client-id'] = `feed-client-${index}`;
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

  test('shows a friendly rate-limit message and preserves form values', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page, {
      randomValue: 0.5,
      consideringDelayMs: 0,
      clientId: 'rate-limited-client',
    });

    for (let index = 0; index < 5; index += 1) {
      await createRulingViaApi(page, headers, {
        name: 'Holly',
        request: `Distinct request ${index}`,
      });
    }

    await page.goto('/');
    await fillRequestForm(page, 'A sixth request');
    await page.getByRole('button', { name: 'ASK SANTA' }).click();

    await expect(
      page.locator('[data-response-panel][data-mode="rate-limited"]'),
    ).toBeVisible();
    await expect(page.locator('[data-response-title]')).toBeVisible();
    await expect(page.locator('[data-response-title]')).toHaveText(
      'SANTA NEEDS A MOMENT. PLEASE TRY AGAIN LATER.',
    );
    await expect(page.getByLabel('What should Santa call you?')).toHaveValue(
      'Holly',
    );
    await expect(
      page.getByRole('textbox', {
        name: 'What would you like from Santa?',
      }),
    ).toHaveValue('A sixth request');
  });

  test('silently rejects honeypot submissions without creating a public ruling', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page, {
      clientId: 'honeypot-client',
    });

    const response = await page.request.post('/api/rulings', {
      headers: {
        ...headers,
        'content-type': 'application/json',
        'x-idempotency-key': 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      data: {
        name: 'Holly',
        request: 'A brass telescope',
        website: 'https://bot.example',
        formElapsedMs: 2000,
      },
    });

    expect(response.status()).toBe(202);

    await page.goto('/');
    await expect(page.locator('[data-recent-list]')).toHaveCount(0);
  });

  test('rejects foreign-origin submission requests', async ({ page }) => {
    const { headers } = await configureSantaTestPage(page);

    const response = await page.request.post('/api/rulings', {
      headers: {
        ...headers,
        'content-type': 'application/json',
        origin: 'https://evil.example',
        'x-idempotency-key': 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      },
      data: {
        name: 'Holly',
        request: 'A brass telescope',
        website: '',
        formElapsedMs: 2000,
      },
    });

    expect(response.status()).toBe(403);
  });

  test('stays within the viewport on mobile with long persisted content', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page, {
      randomValue: 0.5,
      consideringDelayMs: 0,
    });
    await createRulingViaApi(page, headers, {
      name: 'Holly',
      request: `https://example.com/${'verylongword'.repeat(30)}`,
    });

    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/');

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalOverflow).toBe(false);
  });
});
