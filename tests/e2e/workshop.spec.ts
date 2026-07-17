import { expect, test } from '@playwright/test';

import {
  configureSantaTestPage,
  createReportViaApi,
  createRulingViaApi,
} from './support/santaTest';

test.describe('Santa Workshop owner area', () => {
  test('redirects unauthenticated access, rejects invalid login, and exposes noindex metadata', async ({
    page,
  }) => {
    await configureSantaTestPage(page);

    await page.goto('/workshop');
    await expect(page).toHaveURL(/\/workshop\/login/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );

    await page.getByLabel('Username').fill('owner');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Enter workshop' }).click();

    await expect(
      page.getByText('Santa cannot open the workshop with those credentials.'),
    ).toBeVisible();

    await page.getByLabel('Username').fill('owner');
    await page.getByLabel('Password').fill('northpole-sleigh');
    await page.getByRole('button', { name: 'Enter workshop' }).click();

    await expect(page).toHaveURL('/workshop');
    await expect(
      page.getByRole('heading', { name: 'Workshop Dashboard' }),
    ).toBeVisible();
  });

  test('hides, restores, and permanently deletes rulings from the owner UI', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page, {
      randomValue: 0.5,
      consideringDelayMs: 0,
    });
    const firstCreated = await createRulingViaApi(page, headers, {
      name: 'Holly',
      request: 'A brass telescope',
    });
    const secondCreated = await createRulingViaApi(page, headers, {
      name: 'Juniper',
      request: 'A moonlit observatory',
    });

    await page.goto('/workshop/login');
    await page.getByLabel('Username').fill('owner');
    await page.getByLabel('Password').fill('northpole-sleigh');
    await page.getByRole('button', { name: 'Enter workshop' }).click();

    await expect(page).toHaveURL('/workshop');
    await expect(page.getByText('Total public rulings')).toBeVisible();

    await page.getByRole('link', { name: 'Rulings', exact: true }).click();
    await expect(page).toHaveURL(/\/workshop\/rulings/);
    await expect(page.getByText('A brass telescope')).toBeVisible();

    await page
      .locator('tr')
      .filter({ hasText: 'A brass telescope' })
      .getByRole('link', { name: 'View', exact: true })
      .click();
    await expect(page).toHaveURL(
      `/workshop/rulings/${firstCreated.ruling.publicId}`,
    );

    await page
      .getByLabel(/Optional private note/i)
      .fill('Hidden for owner review');
    await page.getByRole('button', { name: 'Hide ruling' }).click();
    await expect(
      page.getByText('The ruling is now hidden from the public site.'),
    ).toBeVisible();
    await expect(
      page
        .locator('dd')
        .filter({ hasText: /^Hidden$/ })
        .first(),
    ).toBeVisible();

    await page.goto('/');
    await expect(page.getByText('A brass telescope')).toHaveCount(0);

    const hiddenResponse = await page.goto(
      `/rulings/${firstCreated.ruling.publicId}`,
    );
    expect(hiddenResponse?.status()).toBe(404);
    await expect(
      page.getByRole('heading', {
        name: 'SANTA CANNOT FIND THAT REQUEST.',
      }),
    ).toBeVisible();

    await page.goto(`/workshop/rulings/${firstCreated.ruling.publicId}`);
    await page.getByRole('button', { name: 'Restore ruling' }).click();
    await expect(page.getByText('The ruling is public again.')).toBeVisible();

    const restoredResponse = await page.goto(
      `/rulings/${firstCreated.ruling.publicId}`,
    );
    expect(restoredResponse?.status()).toBe(200);
    await expect(page.getByText('A brass telescope')).toBeVisible();

    await page.goto(`/workshop/rulings/${secondCreated.ruling.publicId}`);
    await page.getByLabel(/Type DELETE to confirm/i).fill('DELETE');
    await page.getByRole('button', { name: 'Delete permanently' }).click();

    await expect(page).toHaveURL(/\/workshop\/rulings/);
    await expect(
      page.getByText('The ruling was deleted permanently.'),
    ).toBeVisible();

    const deletedResponse = await page.goto(
      `/rulings/${secondCreated.ruling.publicId}`,
    );
    expect(deletedResponse?.status()).toBe(404);
    await expect(
      page.getByRole('heading', {
        name: 'SANTA CANNOT FIND THAT REQUEST.',
      }),
    ).toBeVisible();

    await page.goto('/workshop');
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/workshop\/login/);
  });

  test('reviews reports in the queue and can hide a ruling from a report', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page, {
      randomValue: 0.5,
      consideringDelayMs: 0,
    });
    const created = await createRulingViaApi(page, headers, {
      name: 'Holly',
      request: 'A brass telescope',
    });

    const firstReportResponse = await createReportViaApi(
      page,
      {
        ...headers,
        'x-santa-test-client-id': 'reporter-a',
      },
      created.ruling.publicId,
      {
        reason: 'hate',
        note: 'Primary moderation report.',
      },
    );
    const secondReportResponse = await createReportViaApi(
      page,
      {
        ...headers,
        'x-santa-test-client-id': 'reporter-b',
      },
      created.ruling.publicId,
      {
        reason: 'spam',
        note: 'Secondary moderation report.',
      },
    );

    expect(firstReportResponse.status()).toBe(201);
    expect(secondReportResponse.status()).toBe(201);

    await page.goto('/workshop/login');
    await page.getByLabel('Username').fill('owner');
    await page.getByLabel('Password').fill('northpole-sleigh');
    await page.getByRole('button', { name: 'Enter workshop' }).click();

    await page.getByRole('link', { name: /Reports/i }).click();
    await expect(page).toHaveURL(/\/workshop\/reports/);
    await expect(
      page.getByRole('heading', { name: 'Report Review Queue' }),
    ).toBeVisible();
    await expect(page.getByText('Primary moderation report.')).toBeVisible();
    await expect(page.getByText('Secondary moderation report.')).toBeVisible();

    await page
      .locator('tr')
      .filter({ hasText: 'Primary moderation report.' })
      .getByRole('link', { name: 'Review', exact: true })
      .click();

    await expect(page).toHaveURL(/\/workshop\/reports\/report_/);
    await page.getByRole('button', { name: 'Mark reviewed' }).click();
    await expect(
      page.getByText('The report is marked reviewed.'),
    ).toBeVisible();

    await page
      .getByLabel('Optional private hide note')
      .fill('Confirmed harmful content.');
    await page
      .getByLabel('Optional private resolution note')
      .last()
      .fill('Hide the ruling and close the related reports.');
    await page
      .getByRole('button', { name: 'Hide ruling and action reports' })
      .click();

    await expect(
      page.getByText('The ruling is hidden from the public site.'),
    ).toBeVisible();
    await expect(
      page.getByText('Related reports for this ruling'),
    ).toBeVisible();
    await expect(page.getByText('0/2 open reports')).toBeVisible();
    await expect(
      page
        .locator('li')
        .filter({ hasText: 'Secondary moderation report.' })
        .getByText('Actioned'),
    ).toBeVisible();

    await page.goto(`/workshop/reports?q=${created.ruling.publicId}`);
    await expect(page.getByText('0/2 open')).toHaveCount(2);
    await expect(
      page.getByRole('link', { name: /Reports/i }).getByText('0'),
    ).toBeVisible();

    const hiddenResponse = await page.goto(
      `/rulings/${created.ruling.publicId}`,
    );
    expect(hiddenResponse?.status()).toBe(404);
    await expect(
      page.getByRole('heading', {
        name: 'SANTA CANNOT FIND THAT REQUEST.',
      }),
    ).toBeVisible();
  });
});
