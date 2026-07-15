import { expect, test, type Page } from '@playwright/test';

function seedSanta(
  page: Page,
  options: {
    randomValues: number[];
    consideringDelayMs?: number;
  },
) {
  return page.addInitScript((config) => {
    window.__SANTA_TEST__ = {
      randomValues: [...config.randomValues],
      consideringDelayMs: config.consideringDelayMs ?? 0,
    };
  }, options);
}

test.describe('Santa Commands It homepage', () => {
  test('renders the current layout and removes the old header copy', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 1100 });
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'Santa Commands It!', level: 1 }),
    ).toHaveCount(1);
    await expect(
      page.getByText('HELLO THERE! WHAT WOULD YOU LIKE FROM SANTA?'),
    ).toBeVisible();
    await expect(
      page.getByText(
        'TELL SANTA WHAT YOU WANT. HE MAY APPROVE IT WITH GREAT CEREMONY!',
      ),
    ).toBeVisible();
    await expect(page.getByText('A WORD WITH SANTA')).toHaveCount(0);
    await expect(page.getByText('WHAT SHALL SANTA COMMAND?')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: "SANTA'S LATEST COMMANDS" }),
    ).toBeVisible();
    await expect(
      page.getByText('A project from Argon Collective LLC'),
    ).toBeVisible();
  });

  test('shows both validation errors and focuses the first invalid field on empty submit', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'ASK SANTA' }).click();

    await expect(
      page.getByText('Please tell Santa what to call you.'),
    ).toBeVisible();
    await expect(
      page.getByText('Please tell Santa what you would like.'),
    ).toBeVisible();
    await expect(page.getByLabel('What should Santa call you?')).toBeFocused();
  });

  test('updates the character counter while typing', async ({ page }) => {
    await page.goto('/');

    const requestField = page.getByRole('textbox', {
      name: 'What would you like Santa to command?',
    });

    await requestField.fill('A'.repeat(451));
    await expect(page.locator('[data-request-counter]')).toHaveText(
      '451 / 500 - nearly full',
    );
  });

  test('shows the considering state, disables the submit button, and resolves to approval', async ({
    page,
  }) => {
    await seedSanta(page, {
      randomValues: [0.5, 0, 0],
      consideringDelayMs: 400,
    });
    await page.goto('/');

    await page.getByLabel('What should Santa call you?').fill('Holly');
    await page
      .getByRole('textbox', {
        name: 'What would you like Santa to command?',
      })
      .fill('A brass telescope');
    await page.getByRole('button', { name: 'ASK SANTA' }).click();

    const button = page.getByRole('button', {
      name: 'SANTA IS CONSIDERING...',
    });
    await expect(button).toBeDisabled();

    await expect(
      page.locator('[data-response-panel][data-mode="approved"]'),
    ).toBeVisible();
    await expect(page.locator('[data-response-request]')).toHaveText(
      'A brass telescope',
    );
    await expect(
      page.getByRole('button', { name: 'ASK SANTA SOMETHING ELSE' }),
    ).toBeVisible();
    await expect(page.locator('[data-request-status]')).toContainText(
      'SANTA COMMANDS IT!',
    );
  });

  test('can deterministically produce a coal ruling for an acceptable request', async ({
    page,
  }) => {
    await seedSanta(page, {
      randomValues: [0.01, 0, 0],
      consideringDelayMs: 0,
    });
    await page.goto('/');

    await page.getByLabel('What should Santa call you?').fill('Holly');
    await page
      .getByRole('textbox', {
        name: 'What would you like Santa to command?',
      })
      .fill('A brass telescope');
    await page.getByRole('button', { name: 'ASK SANTA' }).click();

    await expect(
      page.locator('[data-response-panel][data-mode="random-coal"]'),
    ).toBeVisible();
    await expect(page.locator('[data-request-status]')).toContainText('COAL');
    await expect(
      page.getByRole('button', { name: 'ASK SANTA SOMETHING ELSE' }),
    ).toBeVisible();
  });

  test('blocks an unacceptable request, preserves values, and keeps the ordinary submit action', async ({
    page,
  }) => {
    await seedSanta(page, {
      randomValues: [0.2, 0],
    });
    await page.goto('/');

    const nameField = page.getByLabel('What should Santa call you?');
    const requestField = page.getByRole('textbox', {
      name: 'What would you like Santa to command?',
    });

    await nameField.fill('Holly');
    await requestField.fill('Please arrange coal for my enemy.');
    await page.getByRole('button', { name: 'ASK SANTA' }).click();

    await expect(
      page.locator('[data-response-panel][data-mode="blocked"]'),
    ).toBeVisible();
    await expect(page.locator('[data-request-status]')).toContainText(
      'THAT IS UNACCEPTABLE. ASK FOR SOMETHING ELSE OR RECEIVE COAL!',
    );
    await expect(nameField).toHaveValue('Holly');
    await expect(requestField).toHaveValue('Please arrange coal for my enemy.');
    await expect(requestField).toBeFocused();
    await expect(
      page.getByRole('button', { name: 'ASK SANTA SOMETHING ELSE' }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'ASK SANTA' })).toBeEnabled();
    await expect(
      page.getByText('Santa has not made any public commands yet.'),
    ).toBeVisible();
  });

  test('blocks an unacceptable name and returns focus to the name field', async ({
    page,
  }) => {
    await seedSanta(page, {
      randomValues: [0.2, 0],
    });
    await page.goto('/');

    await page
      .getByLabel('What should Santa call you?')
      .fill('blocked-example');
    await page
      .getByRole('textbox', {
        name: 'What would you like Santa to command?',
      })
      .fill('A brass telescope');
    await page.getByRole('button', { name: 'ASK SANTA' }).click();

    await expect(
      page.locator('[data-response-panel][data-mode="blocked"]'),
    ).toBeVisible();
    await expect(page.getByLabel('What should Santa call you?')).toBeFocused();
  });

  test('ask again preserves the name, clears the request, and restores the opening prompt', async ({
    page,
  }) => {
    await seedSanta(page, {
      randomValues: [0.5, 0, 0],
      consideringDelayMs: 0,
    });
    await page.goto('/');

    const nameField = page.getByLabel('What should Santa call you?');
    const requestField = page.getByRole('textbox', {
      name: 'What would you like Santa to command?',
    });

    await nameField.fill('Holly');
    await requestField.fill('A brass telescope');
    await page.getByRole('button', { name: 'ASK SANTA' }).click();
    await page
      .getByRole('button', { name: 'ASK SANTA SOMETHING ELSE' })
      .click();

    await expect(nameField).toHaveValue('Holly');
    await expect(requestField).toHaveValue('');
    await expect(requestField).toBeFocused();
    await expect(
      page.getByText('HELLO THERE! WHAT WOULD YOU LIKE FROM SANTA?'),
    ).toBeVisible();
  });

  test('does not persist the local interaction after a refresh', async ({
    page,
  }) => {
    await seedSanta(page, {
      randomValues: [0.5, 0, 0],
      consideringDelayMs: 0,
    });
    await page.goto('/');

    await page.getByLabel('What should Santa call you?').fill('Holly');
    await page
      .getByRole('textbox', {
        name: 'What would you like Santa to command?',
      })
      .fill('A brass telescope');
    await page.getByRole('button', { name: 'ASK SANTA' }).click();
    await expect(
      page.getByRole('button', { name: 'ASK SANTA SOMETHING ELSE' }),
    ).toBeVisible();

    await page.reload();

    await expect(
      page.getByText('HELLO THERE! WHAT WOULD YOU LIKE FROM SANTA?'),
    ).toBeVisible();
    await expect(page.getByLabel('What should Santa call you?')).toHaveValue(
      '',
    );
    await expect(
      page.getByRole('textbox', {
        name: 'What would you like Santa to command?',
      }),
    ).toHaveValue('');
  });

  test('supports keyboard submission', async ({ page }) => {
    await seedSanta(page, {
      randomValues: [0.5, 0, 0],
      consideringDelayMs: 0,
    });
    await page.goto('/');

    await page.getByLabel('What should Santa call you?').fill('Holly');
    await page
      .getByRole('textbox', {
        name: 'What would you like Santa to command?',
      })
      .fill('A brass telescope');
    await page.getByLabel('What should Santa call you?').press('Enter');

    await expect(
      page.locator('[data-response-panel][data-mode="approved"]'),
    ).toBeVisible();
  });

  test('renders submitted request content as text rather than HTML', async ({
    page,
  }) => {
    await seedSanta(page, {
      randomValues: [0.5, 0, 0],
      consideringDelayMs: 0,
    });
    await page.goto('/');

    const maliciousRequest = '<img src=x onerror=alert(1)>';

    await page.getByLabel('What should Santa call you?').fill('Holly');
    await page
      .getByRole('textbox', {
        name: 'What would you like Santa to command?',
      })
      .fill(maliciousRequest);
    await page.getByRole('button', { name: 'ASK SANTA' }).click();

    const panel = page.locator('[data-response-panel]');
    await expect(panel.locator('[data-response-request]')).toHaveText(
      maliciousRequest,
    );
    await expect(panel.locator('[data-response-request] img')).toHaveCount(0);
  });

  test('stays within the viewport on mobile, including long request output', async ({
    page,
  }) => {
    await seedSanta(page, {
      randomValues: [0.5, 0, 0],
      consideringDelayMs: 0,
    });
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/');

    await page.getByLabel('What should Santa call you?').fill('Holly');
    await page
      .getByRole('textbox', {
        name: 'What would you like Santa to command?',
      })
      .fill('https://example.com/' + 'verylongword'.repeat(30));
    await page.getByRole('button', { name: 'ASK SANTA' }).click();

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalOverflow).toBe(false);
  });
});
