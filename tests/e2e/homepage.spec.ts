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

    const publicNav = page.getByLabel('Public navigation');
    await expect(publicNav.getByRole('link')).toHaveCount(2);
    await expect(
      publicNav.getByRole('link', { name: 'ASK SANTA' }),
    ).toHaveAttribute('href', '/#ask-santa');
    await expect(
      publicNav.getByRole('link', { name: 'ASK SANTA' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      publicNav.getByRole('link', { name: 'BROWSE REQUESTS' }),
    ).toHaveAttribute('href', '/commands');
    await expect(publicNav.getByRole('link', { name: 'HOME' })).toHaveCount(0);
    await expect(
      publicNav.getByRole('link', { name: 'SUBMIT A REQUEST' }),
    ).toHaveCount(0);
    await expect(page.locator('#ask-santa')).toBeVisible();

    await expect(page.getByAltText(/Santa Claus seated/i)).toBeVisible();
    await expect(page.getByText('public/images/santa-solo.png')).toHaveCount(0);
    await expect(page.getByText('public/images/santa.png')).toHaveCount(0);

    const backgroundDetails = await page.evaluate(() => {
      const styles = window.getComputedStyle(document.body);

      const obsoleteExtensions = ['jpeg', 'jpg'];

      return {
        image: styles.backgroundImage,
        repeat: styles.backgroundRepeat,
        size: styles.backgroundSize,
        oldSantaRequested: performance
          .getEntriesByType('resource')
          .some(
            (entry) =>
              entry.name.includes('/images/santa.png') ||
              obsoleteExtensions.some((extension) =>
                entry.name.includes(`/images/santa-solo.${extension}`),
              ),
          ),
      };
    });

    expect(backgroundDetails.image).toContain('/images/snow-black.png');
    expect(backgroundDetails.repeat).toContain('repeat');
    expect(backgroundDetails.size).toContain('400px 400px');
    expect(backgroundDetails.oldSantaRequested).toBe(false);

    await expect(
      page.getByText("SANTA HASN'T ANSWERED ANY PUBLIC REQUESTS YET."),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'BROWSE ALL REQUESTS' }),
    ).toHaveAttribute('href', '/commands');

    await expect(page.locator('[data-public-shell]')).toHaveCount(1);
    await expect(page.locator('[data-public-portrait] img')).toHaveCount(1);
    await expect(page.locator('footer.site-footer')).toHaveCount(1);

    const publicShellOrder = await page.evaluate(() => {
      const shell = document.querySelector('[data-public-shell]');
      if (!shell) {
        return [];
      }

      return Array.from(shell.children).map((child) => {
        if (child.matches('[data-public-rail]')) return 'rail';
        if (child.matches('[data-public-main]')) return 'main';
        if (child.matches('footer')) return 'footer';
        return child.tagName.toLowerCase();
      });
    });

    expect(publicShellOrder).toEqual(['rail', 'main', 'footer']);

    const desktopRailPositions = await page.evaluate(() => {
      const portrait = document.querySelector('[data-public-portrait]');
      const nav = document.querySelector('nav[aria-label="Public navigation"]');
      const footer = document.querySelector('footer.site-footer');
      const main = document.querySelector('[data-public-main]');

      if (!portrait || !nav || !footer || !main) {
        return null;
      }

      const portraitBox = portrait.getBoundingClientRect();
      const navBox = nav.getBoundingClientRect();
      const footerBox = footer.getBoundingClientRect();
      const mainBox = main.getBoundingClientRect();

      return {
        navBelowPortrait: navBox.top >= portraitBox.bottom,
        footerBelowNav: footerBox.top > navBox.bottom,
        mainRightOfRail: mainBox.left > portraitBox.left,
      };
    });

    expect(desktopRailPositions).toEqual({
      navBelowPortrait: true,
      footerBelowNav: true,
      mainRightOfRail: true,
    });
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
      page.getByText("SANTA HASN'T ANSWERED ANY PUBLIC REQUESTS YET."),
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
      page.getByText("SANTA'S LATEST ANSWERS ARE TEMPORARILY UNAVAILABLE."),
    ).toBeVisible();
    await expect(
      page.getByText('Please try again in a little while.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'ASK SANTA' })).toBeVisible();
  });

  test('public navigation lands on the request section and stays overflow-safe on narrow screens', async ({
    page,
  }) => {
    await configureSantaTestPage(page);
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/');

    await page.getByRole('link', { name: 'ASK SANTA' }).click();
    await expect(page).toHaveURL(/\/#ask-santa$/);
    await expect(page.locator('#ask-santa')).toBeInViewport();

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalOverflow).toBe(false);

    const mobileOrder = await page.evaluate(() => {
      const portrait = document.querySelector('[data-public-portrait]');
      const nav = document.querySelector('nav[aria-label="Public navigation"]');
      const main = document.querySelector('[data-public-main]');
      const footer = document.querySelector('footer.site-footer');

      if (!portrait || !nav || !main || !footer) {
        return null;
      }

      const portraitBox = portrait.getBoundingClientRect();
      const navBox = nav.getBoundingClientRect();
      const mainBox = main.getBoundingClientRect();
      const footerBox = footer.getBoundingClientRect();
      const railStyle = window.getComputedStyle(
        document.querySelector('[data-public-rail]')!,
      );

      return {
        navBelowPortrait: navBox.top >= portraitBox.bottom,
        mainBelowNav: mainBox.top >= navBox.bottom,
        footerBelowMain: footerBox.top >= mainBox.bottom,
        stickyDisabled: railStyle.position !== 'sticky',
      };
    });

    expect(mobileOrder).toEqual({
      navBelowPortrait: true,
      mainBelowNav: true,
      footerBelowMain: true,
      stickyDisabled: true,
    });
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
