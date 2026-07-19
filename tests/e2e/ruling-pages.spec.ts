import { expect, test } from '@playwright/test';

import {
  configureSantaTestPage,
  createReportViaApi,
  createRulingViaApi,
} from './support/santaTest';

test.describe('public ruling pages', () => {
  test('an approved ruling page shows the persisted request, response, and metadata', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page, {
      randomValue: 0.5,
      copyMode: 'success',
    });
    const created = await createRulingViaApi(page, headers, {
      name: 'Holly',
      request: 'A brass telescope for the observatory balcony',
    });
    const ruling = created.ruling;

    const response = await page.goto(`/rulings/${ruling.publicId}`);

    expect(response?.status()).toBe(200);
    await expect(page.getByAltText(/Santa Claus seated/i)).toBeVisible();
    await expect(page.locator('[data-public-portrait] img')).toHaveCount(1);
    await expect(page.locator('footer.site-footer')).toHaveCount(1);
    await expect(
      page
        .getByLabel('Public navigation')
        .getByRole('link', { name: 'BROWSE REQUESTS' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      page.getByRole('heading', { name: 'SANTA COMMANDS IT!' }),
    ).toBeVisible();
    await expect(page.locator('.ruling-card__request')).toContainText(
      ruling.requestText,
    );
    await expect(page.locator('.ruling-card__response')).toContainText(
      ruling.santaResponse,
    );
    await expect(page.locator('time')).toBeVisible();
    await expect(page).toHaveTitle(
      `Santa Commands It! - ${ruling.displayName}'s Request`,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `http://127.0.0.1:4321/rulings/${ruling.publicId}`,
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      `http://127.0.0.1:4321/rulings/${ruling.publicId}/og.png`,
    );
    await expect(
      page.locator('meta[property="og:image:width"]'),
    ).toHaveAttribute('content', '1200');
    await expect(
      page.locator('meta[property="og:image:height"]'),
    ).toHaveAttribute('content', '630');
    await expect(
      page.locator('meta[property="og:image:type"]'),
    ).toHaveAttribute('content', 'image/png');
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
      'content',
      `Santa approved ${ruling.displayName}\u2019s request with "Santa Commands It!"`,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    );
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute(
      'content',
      `http://127.0.0.1:4321/rulings/${ruling.publicId}/og.png`,
    );
    await expect(
      page.locator('meta[property="og:description"]'),
    ).toHaveAttribute('content', /Santa approved it with "Santa Commands It!"/);

    const firstResponse = await page
      .locator('.ruling-card__response')
      .textContent();
    await page.reload();
    await expect(page.locator('.ruling-card__response')).toHaveText(
      firstResponse ?? '',
    );
  });

  test('serves the canonical Santa and snow assets directly', async ({
    page,
  }) => {
    const santaResponse = await page.request.get('/images/santa-solo.png');
    const snowResponse = await page.request.get('/images/snow-black.png');
    const oldSantaResponse = await page.request.get('/images/santa.png');
    const obsoleteResponses = await Promise.all(
      ['jpe' + 'g', 'jp' + 'g'].map((extension) =>
        page.request.get(`/images/santa-solo.${extension}`),
      ),
    );

    expect(santaResponse.status()).toBe(200);
    expect(santaResponse.headers()['content-type']).toContain('image/png');
    expect(snowResponse.status()).toBe(200);
    expect(snowResponse.headers()['content-type']).toContain('image/png');
    expect(oldSantaResponse.status()).toBe(404);
    for (const response of obsoleteResponses) {
      expect(response.status()).toBe(404);
    }
  });

  test('renders a public og image endpoint with png headers and shared caching', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page, {
      randomValue: 0.5,
    });
    const created = await createRulingViaApi(page, headers, {
      name: 'Holly',
      request: 'A brass telescope for the observatory balcony',
    });

    const response = await page.request.get(
      `/rulings/${created.ruling.publicId}/og.png`,
      {
        headers,
      },
    );

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
    expect(response.headers()['cache-control']).toContain('s-maxage=900');
    expect(response.headers()['cache-control']).toContain(
      'stale-while-revalidate=86400',
    );
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect((await response.body()).byteLength).toBeGreaterThan(1000);
  });

  test('a coal ruling page stays public and recent rulings link to it', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page, {
      randomValue: 0.01,
    });
    const created = await createRulingViaApi(page, headers, {
      name: 'Holly',
      request: 'A brass telescope for the observatory balcony',
    });
    const ruling = created.ruling;

    await page.goto('/');
    const firstRecentItem = page.locator('[data-recent-list] > li').first();
    await expect(
      firstRecentItem.getByRole('link', { name: /read santa's answer/i }),
    ).toHaveAttribute('href', `/rulings/${ruling.publicId}`);

    await firstRecentItem
      .getByRole('link', { name: /read santa's answer/i })
      .click();
    await expect(page).toHaveURL(`/rulings/${ruling.publicId}`);
    await expect(page.getByRole('heading', { name: 'COAL' })).toBeVisible();
    await expect(page.locator('.ruling-card__response')).toContainText(
      ruling.santaResponse,
    );
  });

  test('copy link uses the canonical URL and native share stays hidden when unsupported', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page, {
      randomValue: 0.5,
      copyMode: 'success',
    });
    const created = await createRulingViaApi(page, headers, {
      name: 'Holly',
      request: 'A brass telescope',
    });

    await page.goto(`/rulings/${created.ruling.publicId}`);

    await expect(
      page.getByRole('button', { name: 'Share this Santa ruling' }),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Copy a link to this Santa ruling' })
      .click();
    await expect(page.locator('[data-copy-link]')).toHaveText('LINK COPIED');

    const copiedUrl = await page.evaluate(() => {
      return (window as Window & { __lastCopiedText?: string })
        .__lastCopiedText;
    });

    expect(copiedUrl).toBe(
      `http://127.0.0.1:4321/rulings/${created.ruling.publicId}`,
    );
  });

  test('copy failures show fallback guidance and native-share cancellation stays quiet', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page, {
      randomValue: 0.5,
      copyMode: 'fail',
      shareMode: 'cancel',
    });
    const created = await createRulingViaApi(page, headers, {
      name: 'Holly',
      request: 'A brass telescope',
    });

    await page.goto(`/rulings/${created.ruling.publicId}`);

    await page
      .getByRole('button', { name: 'Copy a link to this Santa ruling' })
      .click();
    await expect(
      page.getByText(
        'Could not copy the link. You can copy it from your browser',
      ),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Share this Santa ruling' }).click();
    await expect(
      page.getByText('Could not open sharing. You can still copy the link.'),
    ).toHaveCount(0);
  });

  test('opens and closes the report form with keyboard controls, validates the reason, and accepts a report', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page, {
      randomValue: 0.5,
      clientId: 'report-client',
    });
    const created = await createRulingViaApi(page, headers, {
      name: 'Holly',
      request: 'A brass telescope',
    });

    await page.goto(`/rulings/${created.ruling.publicId}`);

    const reportToggle = page.getByRole('button', {
      name: 'REPORT THIS COMMAND',
    });
    await reportToggle.press('Enter');
    await expect(page.getByLabel('Why are you reporting this?')).toBeFocused();

    await page.getByRole('button', { name: 'SUBMIT REPORT' }).click();
    await expect(
      page.getByText('Please choose a reason for the report.'),
    ).toBeVisible();

    await page.getByLabel('Why are you reporting this?').selectOption('spam');
    await page.getByLabel('Optional note').fill('<b>Repeated spam</b>');
    await page.getByRole('button', { name: 'SUBMIT REPORT' }).click();

    await expect(
      page.getByText("THANK YOU. SANTA'S WORKSHOP HAS RECEIVED YOUR REPORT."),
    ).toBeVisible();
    await expect(reportToggle).toBeDisabled();
  });

  test('handles duplicate reports cleanly', async ({ page }) => {
    const { headers } = await configureSantaTestPage(page, {
      randomValue: 0.5,
      clientId: 'duplicate-report-client',
    });
    const created = await createRulingViaApi(page, headers, {
      name: 'Holly',
      request: 'A brass telescope',
    });

    const firstReport = await createReportViaApi(
      page,
      headers,
      created.ruling.publicId,
      {
        reason: 'spam',
        note: 'Repeated public spam',
      },
    );

    expect(firstReport.status()).toBe(201);

    await page.goto(`/rulings/${created.ruling.publicId}`);
    await page.getByRole('button', { name: 'REPORT THIS COMMAND' }).click();
    await page.getByLabel('Why are you reporting this?').selectOption('spam');
    await page.getByRole('button', { name: 'SUBMIT REPORT' }).click();

    await expect(
      page.getByText(
        "Santa's workshop already has a recent report from here about this command.",
      ),
    ).toBeVisible();
  });

  test('recovers cleanly when a report request times out', async ({ page }) => {
    const { headers } = await configureSantaTestPage(page, {
      randomValue: 0.5,
      requestTimeoutMs: 100,
    });
    const created = await createRulingViaApi(page, headers, {
      name: 'Holly',
      request: 'A brass telescope',
    });

    await page.route(
      `**/api/rulings/${created.ruling.publicId}/reports`,
      async (route) => {
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
      },
    );

    await page.goto(`/rulings/${created.ruling.publicId}`);
    await page.getByRole('button', { name: 'REPORT THIS COMMAND' }).click();
    await page.getByLabel('Why are you reporting this?').selectOption('spam');
    await page.getByRole('button', { name: 'SUBMIT REPORT' }).click();

    await expect(
      page.getByText(
        "Santa's workshop is taking longer than usual. Please try again.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'SUBMIT REPORT' }),
    ).toBeEnabled();
  });

  test('invalid and unknown identifiers return the same friendly 404 experience', async ({
    page,
  }) => {
    await configureSantaTestPage(page);

    const invalidResponse = await page.goto('/rulings/not-a-valid-id');
    expect(invalidResponse?.status()).toBe(404);
    await expect(
      page.getByRole('heading', {
        name: 'SANTA CANNOT FIND THAT REQUEST.',
      }),
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );

    const unknownResponse = await page.goto(
      '/rulings/550e8400-e29b-41d4-a716-446655440999',
    );
    expect(unknownResponse?.status()).toBe(404);
    await expect(
      page.getByRole('heading', {
        name: 'SANTA CANNOT FIND THAT REQUEST.',
      }),
    ).toBeVisible();
  });

  test('html-like stored values render as text and long ruling pages do not overflow on mobile', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page, {
      randomValue: 0.5,
    });
    const created = await createRulingViaApi(page, headers, {
      name: '<Holly>',
      request: `<img src=x onerror=alert(1)> https://example.com/${'verylongword'.repeat(25)}`,
    });

    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto(`/rulings/${created.ruling.publicId}`);

    await expect(page.locator('.ruling-card__request')).toContainText(
      '<img src=x onerror=alert(1)>',
    );
    await expect(page.locator('.ruling-card img')).toHaveCount(0);
    const publicNav = page.getByLabel('Public navigation');
    await expect(
      publicNav.getByRole('link', { name: 'ASK SANTA' }),
    ).toHaveAttribute('href', '/#ask-santa');
    await expect(
      publicNav.getByRole('link', { name: 'BROWSE REQUESTS' }),
    ).toHaveAttribute('href', '/commands');

    await page.getByRole('link', { name: 'BACK TO REQUESTS' }).click();
    await expect(page).toHaveURL('/commands');

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalOverflow).toBe(false);
  });

  test('emits representative security headers without CSP violations', async ({
    page,
  }) => {
    const consoleMessages: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleMessages.push(message.text());
      }
    });

    const { headers } = await configureSantaTestPage(page, {
      randomValue: 0.5,
    });
    const created = await createRulingViaApi(page, headers, {
      name: 'Holly',
      request: 'A brass telescope',
    });

    const homepageResponse = await page.request.get('/');
    const rulingResponse = await page.request.get(
      `/rulings/${created.ruling.publicId}`,
    );
    const homepageHeaders = Object.fromEntries(
      homepageResponse
        .headersArray()
        .map((header) => [header.name.toLowerCase(), header.value]),
    );
    const rulingHeaders = Object.fromEntries(
      rulingResponse
        .headersArray()
        .map((header) => [header.name.toLowerCase(), header.value]),
    );

    expect(homepageHeaders['content-security-policy']).toContain(
      'fonts.googleapis.com',
    );
    expect(homepageHeaders['x-content-type-options']).toBe('nosniff');
    expect(rulingHeaders['cross-origin-opener-policy']).toBe('same-origin');
    expect(consoleMessages).toEqual([]);
  });
});
