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
    await expect(
      page.locator('form[action="/api/workshop/login"]'),
    ).toHaveAttribute('method', /post/i);

    await page.getByLabel('Username').fill('owner');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Enter workshop' }).click();

    await expect(page).toHaveURL(/\/workshop\/login\?error=credentials/);
    await expect(
      page.getByText('Santa cannot open the workshop with those credentials.'),
    ).toBeVisible();
    expect(page.url()).not.toContain('/api/workshop/login');

    await page.getByLabel('Username').fill('owner');
    await page.getByLabel('Password').fill('northpole-sleigh');
    await page.getByRole('button', { name: 'Enter workshop' }).click();

    await expect(page).toHaveURL('/workshop');
    await expect(
      page.getByRole('heading', { name: 'Workshop Dashboard' }),
    ).toBeVisible();
    expect(page.url()).not.toContain('/api/workshop/login');
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
    await expect(
      page.getByRole('heading', { name: 'Total rulings' }),
    ).toBeVisible();

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
    const hiddenImageResponse = await page.request.get(
      `/rulings/${firstCreated.ruling.publicId}/og.png`,
      {
        headers,
      },
    );
    expect(hiddenImageResponse.status()).toBe(404);
    expect(hiddenImageResponse.headers()['cache-control']).toBe('no-store');
    expect(hiddenImageResponse.headers()['content-type']).toContain(
      'text/plain',
    );
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
    const restoredImageResponse = await page.request.get(
      `/rulings/${firstCreated.ruling.publicId}/og.png`,
      {
        headers,
      },
    );
    expect(restoredImageResponse.status()).toBe(200);
    expect(restoredImageResponse.headers()['content-type']).toContain(
      'image/png',
    );
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
    const deletedImageResponse = await page.request.get(
      `/rulings/${secondCreated.ruling.publicId}/og.png`,
      {
        headers,
      },
    );
    expect(deletedImageResponse.status()).toBe(404);
    expect(deletedImageResponse.headers()['cache-control']).toBe('no-store');
    await expect(
      page.getByRole('heading', {
        name: 'SANTA CANNOT FIND THAT REQUEST.',
      }),
    ).toBeVisible();

    await page.goto('/workshop');
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/workshop\/login/);
  });

  test('protects the workshop share preview and keeps hidden previews private', async ({
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
    const previewPath = `/workshop/rulings/${created.ruling.publicId}/share-preview`;
    const previewImagePath = `/workshop/rulings/${created.ruling.publicId}/share-preview.png`;

    await page.goto(previewPath);
    await expect(page).toHaveURL(/\/workshop\/login/);

    await page.goto('/workshop/login');
    await page.getByLabel('Username').fill('owner');
    await page.getByLabel('Password').fill('northpole-sleigh');
    await page.getByRole('button', { name: 'Enter workshop' }).click();
    await expect(page).toHaveURL('/workshop');

    const previewImageResponsePromise = page.waitForResponse(previewImagePath);
    const previewPageResponse = await page.goto(previewPath);

    expect(previewPageResponse?.status()).toBe(200);
    expect(previewPageResponse?.headers()['cache-control']).toBe('no-store');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
    await expect(page.getByText('Share image preview')).toBeVisible();
    await expect(
      page.locator('.workshop-share-preview__status strong'),
    ).toHaveText('Ready to share');
    await expect(
      page.getByText("Santa Commands It! - Holly's Request"),
    ).toBeVisible();
    await expect(page.getByLabel('Canonical ruling URL')).toHaveValue(
      `http://127.0.0.1:4321/rulings/${created.ruling.publicId}`,
    );
    await expect(page.getByLabel('Native share title')).toHaveValue(
      'Santa Commands It!',
    );
    await expect(page.getByLabel('Native share text')).toContainText(
      "Santa approved Holly's request",
    );
    await expect(
      page.getByText(
        `http://127.0.0.1:4321/rulings/${created.ruling.publicId}/og.png`,
      ),
    ).toBeVisible();

    const previewImageResponse = await previewImageResponsePromise;
    expect(previewImageResponse.status()).toBe(200);
    expect(previewImageResponse.headers()['cache-control']).toBe('no-store');
    expect(previewImageResponse.headers()['content-type']).toContain(
      'image/png',
    );
    await expect(
      page.locator('.workshop-share-preview__image'),
    ).toHaveAttribute('src', previewImagePath);

    await page.goto(`/workshop/rulings/${created.ruling.publicId}`);
    await page
      .getByLabel(/Optional private note/i)
      .fill('Hidden for owner review');
    await page.getByRole('button', { name: 'Hide ruling' }).click();

    const hiddenPreviewImageResponsePromise =
      page.waitForResponse(previewImagePath);
    await page.goto(previewPath);
    await expect(
      page.locator('.workshop-share-preview__status strong'),
    ).toHaveText('Not publicly shareable');
    await expect(
      page.getByText('Hidden rulings do not expose a public share image URL.'),
    ).toBeVisible();

    const hiddenPreviewImageResponse = await hiddenPreviewImageResponsePromise;
    expect(hiddenPreviewImageResponse.status()).toBe(200);
    expect(hiddenPreviewImageResponse.headers()['cache-control']).toBe(
      'no-store',
    );
  });

  test('keeps the reports page private and navigable when the queue is unavailable', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page);
    await page.setExtraHTTPHeaders({
      ...headers,
      'x-santa-test-workshop-reports-failure': 'list',
    });

    await page.goto('/workshop/login');
    await page.getByLabel('Username').fill('owner');
    await page.getByLabel('Password').fill('northpole-sleigh');
    await page.getByRole('button', { name: 'Enter workshop' }).click();

    const response = await page.goto('/workshop/reports');

    expect(response?.status()).toBe(200);
    expect(response?.headers()['cache-control']).toBe('no-store');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
    await expect(
      page.getByRole('heading', {
        name: 'Reports are temporarily unavailable',
      }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Page 1 of 1')).toBeVisible();
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

  test('shows dashboard ranges, trends, configuration summaries, and bounded recent activity', async ({
    page,
  }) => {
    const nowIso = '2026-07-18T12:00:00.000Z';
    const { headers } = await configureSantaTestPage(page, {
      consideringDelayMs: 0,
      nowIso,
    });
    const approvedHeaders = {
      ...headers,
      'x-santa-test-random': '0.9',
    };
    const coalHeaders = {
      ...headers,
      'x-santa-test-random': '0.01',
    };

    const latestApproved = await createRulingViaApi(page, approvedHeaders, {
      name: 'Holly',
      request: 'A brass telescope',
      nowIso: '2026-07-18T08:00:00.000Z',
    });
    await createRulingViaApi(page, coalHeaders, {
      name: 'Juniper',
      request: 'A moonlit observatory',
      nowIso: '2026-07-16T08:00:00.000Z',
    });
    await createRulingViaApi(page, approvedHeaders, {
      name: 'Peppermint',
      request: 'A train conductor set',
      nowIso: '2026-06-21T08:00:00.000Z',
    });
    await createRulingViaApi(page, approvedHeaders, {
      name: 'Mistletoe',
      request: 'A weather vane',
      nowIso: '2026-04-05T08:00:00.000Z',
    });

    await createReportViaApi(
      page,
      {
        ...headers,
        'x-santa-test-client-id': 'dashboard-reporter-a',
      },
      latestApproved.ruling.publicId,
      {
        reason: 'spam',
        note: 'Open report one',
        nowIso: '2026-07-18T09:00:00.000Z',
      },
    );
    await createReportViaApi(
      page,
      {
        ...headers,
        'x-santa-test-client-id': 'dashboard-reporter-b',
      },
      latestApproved.ruling.publicId,
      {
        reason: 'hate',
        note: 'Open report two',
        nowIso: '2026-07-17T09:00:00.000Z',
      },
    );

    await page.goto('/workshop/login');
    await page.getByLabel('Username').fill('owner');
    await page.getByLabel('Password').fill('northpole-sleigh');
    await page.getByRole('button', { name: 'Enter workshop' }).click();

    await expect(page).toHaveURL('/workshop');
    await expect(page.getByRole('link', { name: '30 days' })).toHaveClass(
      /is-active/,
    );
    await expect(
      page.getByText('Showing 30 days grouped in UTC.'),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Total rulings' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Configured vs actual coal' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Reports and moderation' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Moderation and templates' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Configuration health' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Recent public rulings' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Recent owner activity' }),
    ).toBeVisible();
    await expect(
      page
        .locator('article')
        .filter({
          has: page.getByRole('heading', { name: 'Total rulings' }),
        })
        .getByText(/^3$/),
    ).toBeVisible();
    await expect(page.getByText('2/2 open reports')).toBeVisible();
    await expect(page.getByRole('table').getByText('Jul 17')).toBeVisible();

    await page.getByRole('link', { name: '7 days' }).click();
    await expect(page).toHaveURL('/workshop?range=7d');
    await expect(page.getByRole('link', { name: '7 days' })).toHaveClass(
      /is-active/,
    );
    await expect(
      page.getByText('Showing 7 days grouped in UTC.'),
    ).toBeVisible();

    await page.getByRole('link', { name: 'All time' }).click();
    await expect(page).toHaveURL('/workshop?range=all');
    await expect(page.getByRole('link', { name: 'All time' })).toHaveClass(
      /is-active/,
    );
    await expect(
      page.getByText('Showing all time grouped in UTC.'),
    ).toBeVisible();
  });

  test('keeps the dashboard usable when one section fails', async ({
    page,
  }) => {
    const nowIso = '2026-07-18T12:00:00.000Z';
    const { headers } = await configureSantaTestPage(page, {
      consideringDelayMs: 0,
      nowIso,
      randomValue: 0.9,
    });

    await createRulingViaApi(page, headers, {
      name: 'Holly',
      request: 'A brass telescope',
      nowIso: '2026-07-18T08:00:00.000Z',
    });

    await page.setExtraHTTPHeaders({
      ...headers,
      'x-santa-test-now': nowIso,
      'x-santa-test-dashboard-failure': 'trend',
    });
    await page.goto('/workshop/login');
    await page.getByLabel('Username').fill('owner');
    await page.getByLabel('Password').fill('northpole-sleigh');
    await page.getByRole('button', { name: 'Enter workshop' }).click();

    await expect(page).toHaveURL('/workshop');
    await expect(
      page.getByRole('heading', { name: 'Total rulings' }),
    ).toBeVisible();
    await expect(
      page.getByText('trend is temporarily unavailable.'),
    ).toBeVisible();
    await expect(
      page.getByText('This section is temporarily unavailable.'),
    ).toBeVisible();
  });

  test('manages moderation rules, Santa settings, and response templates end to end', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page, {
      randomValue: 0.99,
      consideringDelayMs: 0,
      nowIso: '2026-12-13T15:00:00.000Z',
    });

    await page.goto('/workshop/login');
    await page.getByLabel('Username').fill('owner');
    await page.getByLabel('Password').fill('northpole-sleigh');
    await page.getByRole('button', { name: 'Enter workshop' }).click();

    await page.getByRole('link', { name: 'Moderation', exact: true }).click();
    await expect(page).toHaveURL(/\/workshop\/moderation/);
    await expect(
      page.getByRole('heading', { name: 'Moderation Rules' }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Add rule' }).click();
    await expect(page).toHaveURL('/workshop/moderation/new');
    await page.getByLabel('Rule type').selectOption('blocked-word');
    await page.getByLabel('Rule value').fill('FrostZap');
    await page.getByLabel('Category').selectOption('spam');
    await page.getByRole('button', { name: 'Create rule' }).click();

    await expect(page).toHaveURL(/\/workshop\/moderation\/rule_/);
    await expect(
      page.getByText('The moderation rule was created.'),
    ).toBeVisible();

    const blockedSubmission = await createRulingViaApi(page, headers, {
      name: 'Holly',
      request: 'Please frostzap the bells.',
    });

    expect(blockedSubmission).toMatchObject({
      status: 'blocked',
      focusField: 'request',
    });

    await page.goto('/workshop/moderation');
    await page.getByLabel('Sample request').fill('Please frostzap the bells.');
    await page.getByRole('button', { name: 'Run test' }).click();
    await expect(
      page.getByText(/Request: blocked by Blocked word/i),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Edit', exact: true }).first().click();
    await expect(page).toHaveURL(/\/workshop\/moderation\/rule_/);
    await page.getByRole('button', { name: 'Disable rule' }).click();
    await expect(
      page.getByText('The moderation rule is now inactive.'),
    ).toBeVisible();

    const allowedSubmission = await createRulingViaApi(page, headers, {
      name: 'Holly',
      request: 'Please frostzap the choir bells.',
    });

    expect(allowedSubmission).toMatchObject({
      status: 'created',
      ruling: {
        decision: 'approved',
      },
    });

    await page
      .getByRole('link', { name: 'Santa Settings', exact: true })
      .click();
    await expect(page).toHaveURL('/workshop/settings');
    await page.getByLabel('Random coal percentage').fill('100');
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByText('Santa settings were updated.')).toBeVisible();

    await page.getByRole('link', { name: 'Seasonal', exact: true }).click();
    await expect(page).toHaveURL('/workshop/settings/seasonal');
    await page.getByLabel('Presentation mode').selectOption('festive');
    await page.getByLabel('Enable seasonal greeting').check();
    await page.getByLabel('Greeting text').fill('Merry Christmas from Santa!');
    await page.getByLabel('Enable seasonal status').check();
    await page.getByLabel('Status text').fill('The sleigh is nearly ready.');
    await page.getByLabel('Enable seasonal countdown').check();
    await page.getByLabel('Target date').fill('2026-12-25');
    await page.getByLabel('Public label').fill('UNTIL CHRISTMAS');
    await page.getByRole('button', { name: 'Save seasonal settings' }).click();
    await expect(
      page.getByText('Seasonal settings were updated.'),
    ).toBeVisible();

    await page.goto('/');
    await expect(page.getByText('Merry Christmas from Santa!')).toBeVisible();
    await expect(page.getByText('The sleigh is nearly ready.')).toBeVisible();
    await expect(page.getByText('12 DAYS UNTIL CHRISTMAS')).toBeVisible();
    await page.goto('/commands');
    await expect(page.getByText('12 DAYS UNTIL CHRISTMAS')).toBeVisible();
    await page.goto('/workshop/settings');

    const coalSubmission = await createRulingViaApi(page, headers, {
      name: 'Juniper',
      request: 'A moonlit observatory',
    });

    expect(coalSubmission).toMatchObject({
      status: 'created',
      ruling: {
        decision: 'random-coal',
      },
    });

    await page.getByLabel('Allow Santa to give random coal').uncheck();
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByText('Santa settings were updated.')).toBeVisible();

    const approvedSubmission = await createRulingViaApi(page, headers, {
      name: 'Juniper',
      request: 'A brass astrolabe',
    });

    expect(approvedSubmission).toMatchObject({
      status: 'created',
      ruling: {
        decision: 'approved',
      },
    });

    await page.getByRole('link', { name: 'Manage responses' }).click();
    await expect(page).toHaveURL('/workshop/settings/responses');
    const createTemplateForm = page.locator(
      'form[action="/api/workshop/settings/responses/create"]',
    );
    await createTemplateForm
      .getByLabel('Template group')
      .selectOption('approved');
    await createTemplateForm
      .getByLabel('Template text')
      .fill('CERTAINLY, {name}.');
    await createTemplateForm.getByLabel('Sort order').fill('999');
    await createTemplateForm
      .getByRole('button', { name: 'Create template' })
      .click();
    await expect(
      page.getByText('The response template was created.'),
    ).toBeVisible();

    const templateSubmission = await createRulingViaApi(page, headers, {
      name: 'Holly',
      request: 'A silver trumpet',
    });

    expect(templateSubmission).toMatchObject({
      status: 'created',
      ruling: {
        santaResponse: 'CERTAINLY, Holly.',
      },
    });
  });
});
