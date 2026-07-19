import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import {
  configureSantaTestPage,
  createRulingViaApi,
  fillRequestForm,
} from './support/santaTest';

async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const relevantViolations = results.violations.filter((violation) =>
    ['serious', 'critical'].includes(violation.impact ?? ''),
  );

  expect(relevantViolations).toEqual([]);
}

test.describe('accessibility audit', () => {
  test('homepage initial state is free of serious axe violations', async ({
    page,
  }) => {
    await configureSantaTestPage(page);
    await page.goto('/');

    await expectNoSeriousViolations(page);
  });

  test('homepage validation state is free of serious axe violations', async ({
    page,
  }) => {
    await configureSantaTestPage(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'ASK SANTA' }).click();

    await expectNoSeriousViolations(page);
  });

  test('homepage approved state is free of serious axe violations', async ({
    page,
  }) => {
    await configureSantaTestPage(page, {
      randomValue: 0.5,
      consideringDelayMs: 0,
    });
    await page.goto('/');
    await fillRequestForm(page, 'A brass telescope');
    await page.getByRole('button', { name: 'ASK SANTA' }).click();

    await expectNoSeriousViolations(page);
  });

  test('homepage blocked state is free of serious axe violations', async ({
    page,
  }) => {
    await configureSantaTestPage(page, {
      consideringDelayMs: 0,
    });
    await page.goto('/');
    await fillRequestForm(page, 'Please arrange coal for my enemy.');
    await page.getByRole('button', { name: 'ASK SANTA' }).click();

    await expectNoSeriousViolations(page);
  });

  test('homepage rate-limited state is free of serious axe violations', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page, {
      randomValue: 0.5,
      consideringDelayMs: 0,
      clientId: 'a11y-rate-limited-client',
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

    await expectNoSeriousViolations(page);
  });

  test('ruling page and open report form are free of serious axe violations', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page, {
      randomValue: 0.5,
    });
    const created = await createRulingViaApi(page, headers, {
      name: 'Holly',
      request: 'A brass telescope',
    });

    await page.goto(`/rulings/${created.ruling.publicId}`);
    await page.getByRole('button', { name: 'REPORT THIS COMMAND' }).click();

    await expectNoSeriousViolations(page);
  });

  test('Commands discovery states are free of serious axe violations', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page);
    await createRulingViaApi(page, headers, {
      name: 'Holly',
      request: 'A brass telescope',
    });

    await page.goto('/commands');
    await expectNoSeriousViolations(page);

    await page.goto('/commands?q=telescope');
    await expectNoSeriousViolations(page);

    await page.goto('/commands?decision=coal');
    await expectNoSeriousViolations(page);

    await page.goto('/commands?q=no-match-value');
    await expectNoSeriousViolations(page);
  });

  test('Commands unavailable state is free of serious axe violations', async ({
    page,
  }) => {
    await configureSantaTestPage(page, {
      scenario: 'commands-unavailable',
    });
    await page.goto('/commands');

    await expectNoSeriousViolations(page);
  });

  test('not-found page is free of serious axe violations', async ({ page }) => {
    await configureSantaTestPage(page);
    await page.goto('/rulings/not-a-valid-id');

    await expectNoSeriousViolations(page);
  });

  test('workshop dashboard is free of serious axe violations', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page, {
      consideringDelayMs: 0,
      nowIso: '2026-07-18T12:00:00.000Z',
    });

    await createRulingViaApi(
      page,
      {
        ...headers,
        'x-santa-test-random': '0.9',
      },
      {
        name: 'Holly',
        request: 'A brass telescope',
        nowIso: '2026-07-18T08:00:00.000Z',
      },
    );

    await page.goto('/workshop/login');
    await page.getByLabel('Username').fill('owner');
    await page.getByLabel('Password').fill('northpole-sleigh');
    await page.getByRole('button', { name: 'Enter workshop' }).click();

    await expectNoSeriousViolations(page);
  });
});
