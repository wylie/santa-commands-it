import { expect, test } from '@playwright/test';

import {
  configureSantaTestPage,
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
      firstRecentItem.getByRole('link', { name: /view and share/i }),
    ).toHaveAttribute('href', `/rulings/${ruling.publicId}`);

    await firstRecentItem
      .getByRole('link', { name: /view and share/i })
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
    await page.getByRole('link', { name: 'ASK SANTA SOMETHING' }).click();
    await expect(page).toHaveURL('/');

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalOverflow).toBe(false);
  });
});
