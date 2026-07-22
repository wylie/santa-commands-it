import { expect, test } from '@playwright/test';

import {
  configureSantaTestPage,
  createRulingViaApi,
} from './support/santaTest';

async function seedDiscoveryRulings(
  page: Parameters<typeof createRulingViaApi>[0],
  headers: Record<string, string>,
) {
  const created = [];

  for (let index = 0; index < 14; index += 1) {
    const isCoal = index === 1 || index === 8;
    const response = await createRulingViaApi(
      page,
      {
        ...headers,
        'x-santa-test-client-id': `commands-client-${index}`,
        'x-santa-test-random': isCoal ? '0.01' : '0.9',
      },
      {
        name:
          index === 3
            ? 'Bike Dad'
            : index === 8
              ? 'Coal Cousin'
              : `Helper ${index}`,
        request:
          index === 4
            ? 'A blue bicycle with a bell'
            : `Discovery request ${index}`,
        nowIso: `2026-07-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
      },
    );

    created.push(response.ruling);
  }

  return created;
}

test.describe('public Commands discovery', () => {
  test('browses, searches, filters, sorts, paginates, and opens public rulings', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page);
    const rulings = await seedDiscoveryRulings(page, headers);

    await page.goto('/commands');

    const publicNav = page.getByLabel('Public navigation');
    await expect(publicNav.getByRole('link')).toHaveCount(2);
    await expect(
      publicNav.getByRole('link', { name: 'ASK SANTA' }),
    ).toHaveAttribute('href', '/#ask-santa');
    await expect(
      publicNav.getByRole('link', { name: 'BROWSE REQUESTS' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-public-shell]')).toHaveCount(1);
    await expect(page.locator('[data-public-portrait] img')).toHaveCount(1);
    await expect(page.locator('footer.site-footer')).toHaveCount(1);

    const desktopShellPositions = await page.evaluate(() => {
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

      return {
        navBelowPortrait: navBox.top >= portraitBox.bottom,
        footerBelowNav: footerBox.top > navBox.bottom,
        mainRightOfRail: mainBox.left > portraitBox.left,
      };
    });

    expect(desktopShellPositions).toEqual({
      navBelowPortrait: true,
      footerBelowNav: true,
      mainRightOfRail: true,
    });

    const sharedShellCounts = await page.evaluate(() => {
      return {
        rail: document.querySelectorAll('[data-public-rail]').length,
        main: document.querySelectorAll('[data-public-main]').length,
        footer: document.querySelectorAll('footer.site-footer').length,
        portrait: document.querySelectorAll('[data-public-portrait]').length,
        nav: document.querySelectorAll('nav[aria-label="Public navigation"]')
          .length,
        mainLandmarks: document.querySelectorAll('main').length,
      };
    });

    expect(sharedShellCounts).toEqual({
      rail: 1,
      main: 1,
      footer: 1,
      portrait: 1,
      nav: 1,
      mainLandmarks: 1,
    });

    await expect(
      page.getByRole('heading', { name: 'REQUESTS ANSWERED BY SANTA' }),
    ).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'http://127.0.0.1:4321/commands',
    );
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await expect(page.locator('[data-commands-list] > li')).toHaveCount(12);
    await expect(
      page.locator('[data-commands-list] > li').first(),
    ).toContainText('Discovery request 13');
    await expect(
      page
        .locator('[data-commands-list] > li')
        .first()
        .locator('[data-public-ruling-context]'),
    ).toContainText('Helper 13 asked Santa...');
    await expect(
      page
        .locator('[data-commands-list] > li')
        .first()
        .locator('[data-public-ruling-response]'),
    ).toContainText('Santa answered');
    await expect(
      page.locator('[data-commands-list] > li').first().getByRole('link'),
    ).toHaveText("READ SANTA'S ANSWER");

    await page.getByLabel('Search public requests').fill('bike');
    await page.getByRole('button', { name: 'APPLY' }).click();
    await expect(page).toHaveURL('/commands?q=bike');
    await expect(page.getByLabel('Search public requests')).toHaveValue('bike');
    await expect(page.locator('[data-commands-list] > li')).toHaveCount(1);
    await expect(page.locator('[data-commands-list]')).toContainText(
      'Bike Dad',
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, follow',
    );

    await page.getByLabel('Search public requests').fill('bicycle');
    await page.getByRole('button', { name: 'APPLY' }).click();
    await expect(page.locator('[data-commands-list]')).toContainText(
      'A blue bicycle with a bell',
    );

    await page.getByLabel('Search public requests').fill('no-match-value');
    await page.getByRole('button', { name: 'APPLY' }).click();
    await expect(
      page.getByText('No requests matched your search.'),
    ).toBeVisible();
    await expect(page.locator('.commands-cta')).toHaveCount(0);

    await page
      .getByLabel('Find Requests')
      .getByRole('link', { name: 'CLEAR FILTERS' })
      .click();
    await expect(page).toHaveURL('/commands');
    await expect(page.locator('[data-commands-list] > li')).toHaveCount(12);

    await page.getByLabel('Decision').selectOption('approved');
    await page.getByRole('button', { name: 'APPLY' }).click();
    await expect(page).toHaveURL('/commands?decision=approved');
    await expect(page.locator('[data-commands-list]')).not.toContainText(
      'COAL',
    );

    await page.getByLabel('Decision').selectOption('coal');
    await page.getByRole('button', { name: 'APPLY' }).click();
    await expect(page).toHaveURL('/commands?decision=coal');
    await expect(page.locator('[data-commands-list] > li')).toHaveCount(2);
    await expect(page.locator('[data-commands-list]')).toContainText('COAL');

    await page.getByLabel('Decision').selectOption('all');
    await page.getByLabel('Sort').selectOption('oldest');
    await page.getByRole('button', { name: 'APPLY' }).click();
    await expect(page).toHaveURL('/commands?sort=oldest');
    await expect(
      page.locator('[data-commands-list] > li').first(),
    ).toContainText('Discovery request 0');

    await page.getByLabel('Sort').selectOption('newest');
    await page.getByRole('button', { name: 'APPLY' }).click();
    await page
      .getByLabel('Requests pagination')
      .getByRole('link', { name: '2', exact: true })
      .click();
    await expect(page).toHaveURL('/commands?page=2');
    await expect(
      page
        .getByLabel('Requests pagination')
        .getByRole('link', { name: '2', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-commands-list] > li')).toHaveCount(2);

    await page.getByRole('link', { name: 'Previous' }).click();
    await expect(page).toHaveURL('/commands');

    await page.getByLabel('Search public requests').fill('Discovery');
    await page.getByLabel('Decision').selectOption('approved');
    await page.getByLabel('Sort').selectOption('oldest');
    await page.getByRole('button', { name: 'APPLY' }).click();
    await expect(page).toHaveURL(
      '/commands?q=Discovery&decision=approved&sort=oldest',
    );

    await page
      .getByRole('link', { name: /Read Santa's answer/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/rulings\/[0-9a-f-]+$/);
    await page.goBack();
    await expect(page).toHaveURL(
      '/commands?q=Discovery&decision=approved&sort=oldest',
    );

    await page.goto(`/rulings/${rulings[0].publicId}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /SANTA|COAL/,
    );
    await expect(
      page.getByLabel('Public navigation').getByRole('link', {
        name: 'ASK SANTA',
      }),
    ).toBeVisible();
    await expect(
      page.getByLabel('Public navigation').getByRole('link', {
        name: 'BROWSE REQUESTS',
      }),
    ).toBeVisible();
  });

  test('uses the ask-santa anchor to scroll the right column in locked desktop mode', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page);
    await seedDiscoveryRulings(page, headers);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/commands');
    await page
      .getByLabel('Public navigation')
      .getByRole('link', { name: 'ASK SANTA' })
      .click();

    await expect(page).toHaveURL('/#ask-santa');
    await expect(page.locator('#ask-santa')).toBeVisible();

    const anchorMetrics = await page.evaluate(() => {
      const portrait = document.querySelector('[data-public-portrait]');
      const nav = document.querySelector('nav[aria-label="Public navigation"]');
      const footer = document.querySelector('footer.site-footer');
      const main = document.querySelector('[data-public-main]');
      const askSanta = document.getElementById('ask-santa');

      if (!portrait || !nav || !footer || !main || !askSanta) {
        return null;
      }

      return {
        portraitTop: portrait.getBoundingClientRect().top,
        portraitBottom: portrait.getBoundingClientRect().bottom,
        navTop: nav.getBoundingClientRect().top,
        navBottom: nav.getBoundingClientRect().bottom,
        footerBottomWithinViewport:
          footer.getBoundingClientRect().bottom <= window.innerHeight,
        bodyOverflow: window.getComputedStyle(document.body).overflowY,
        askSantaTopInMain:
          askSanta.getBoundingClientRect().top -
          main.getBoundingClientRect().top,
      };
    });

    expect(anchorMetrics?.footerBottomWithinViewport).toBe(true);
    expect(anchorMetrics?.bodyOverflow).toBe('hidden');
    expect(anchorMetrics?.portraitBottom).toBeGreaterThan(0);
    expect(anchorMetrics?.navBottom).toBeGreaterThan(0);
    expect(anchorMetrics?.navTop).toBeGreaterThan(anchorMetrics!.portraitTop);
    expect(anchorMetrics?.askSantaTopInMain).toBeGreaterThanOrEqual(0);
    expect(anchorMetrics?.askSantaTopInMain).toBeLessThan(220);
  });

  test('links from the homepage and keeps hidden rulings out of public discovery', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page);
    const created = await seedDiscoveryRulings(page, headers);
    const latestCreated = created.at(-1);

    expect(latestCreated).toBeDefined();

    await page.goto('/');
    await page.getByRole('link', { name: 'BROWSE ALL REQUESTS' }).click();
    await expect(page).toHaveURL('/commands');

    await expect(page.getByText(latestCreated!.requestText)).toBeVisible();

    await page.goto('/workshop/login');
    await page.getByLabel('Username').fill('owner');
    await page.getByLabel('Password').fill('northpole-sleigh');
    await page.getByRole('button', { name: 'Enter workshop' }).click();
    await page.goto(`/workshop/rulings/${latestCreated!.publicId}`);
    await page
      .getByLabel(/Optional private note/i)
      .fill('Hidden during Commands discovery test');
    await page.getByRole('button', { name: 'Hide ruling' }).click();

    await page.goto('/commands');
    await expect(page.getByText(latestCreated!.requestText)).toHaveCount(0);

    await page.goto(`/workshop/rulings/${latestCreated!.publicId}`);
    await page.getByRole('button', { name: 'Restore ruling' }).click();
    await page.goto('/commands');
    await expect(page.getByText(latestCreated!.requestText)).toBeVisible();
  });

  test('features a ruling from Workshop and highlights it publicly', async ({
    page,
  }) => {
    const { headers } = await configureSantaTestPage(page);
    const created = await createRulingViaApi(page, headers, {
      name: 'Featured Holly',
      request: 'A glass snow globe',
      nowIso: '2026-07-18T12:00:00.000Z',
    });

    await page.goto('/');
    await expect(page.locator('[data-featured-rulings]')).toHaveCount(0);

    await page.goto('/workshop/login');
    await page.getByLabel('Username').fill('owner');
    await page.getByLabel('Password').fill('northpole-sleigh');
    await page.getByRole('button', { name: 'Enter workshop' }).click();
    await page.goto(`/workshop/rulings/${created.ruling.publicId}`);
    await page.getByRole('button', { name: 'Feature Request' }).click();
    await expect(page.getByText('The ruling is now featured.')).toBeVisible();
    await expect(page.getByText('Ruling featured')).toBeVisible();

    await page.goto('/');
    await expect(page.locator('[data-featured-rulings]')).toBeVisible();
    await expect(page.locator('[data-featured-list]')).toContainText(
      'A glass snow globe',
    );
    await expect(
      page.locator('[data-featured-list] [data-featured-badge]'),
    ).toContainText('Featured');

    await page.goto('/commands?featured=true');
    await expect(page.locator('[data-commands-list]')).toContainText(
      'A glass snow globe',
    );
    await expect(
      page.locator('[data-commands-list] [data-featured-badge]'),
    ).toContainText('Featured');

    await page.goto(`/rulings/${created.ruling.publicId}`);
    await expect(page.locator('[data-featured-badge]')).toContainText(
      'Featured',
    );
    const imageResponse = await page.request.get(
      `/rulings/${created.ruling.publicId}/og.png`,
      { headers },
    );
    expect(imageResponse.status()).toBe(200);
    expect(imageResponse.headers()['content-type']).toContain('image/png');

    await page.goto(`/workshop/rulings/${created.ruling.publicId}`);
    await page.getByRole('button', { name: 'Remove Feature' }).click();
    await expect(
      page.getByText('The ruling is no longer featured.'),
    ).toBeVisible();
    await page.goto('/commands?featured=true');
    await expect(page.getByText('A glass snow globe')).toHaveCount(0);
  });

  test('renders safe error and mobile states', async ({ page }) => {
    await configureSantaTestPage(page, {
      scenario: 'commands-unavailable',
    });
    const response = await page.goto('/commands');

    expect(response?.status()).toBe(503);
    await expect(
      page.getByText('REQUESTS ANSWERED BY SANTA ARE TEMPORARILY UNAVAILABLE.'),
    ).toBeVisible();
    await expect(
      page.getByLabel('Requests').getByRole('link', { name: 'ASK SANTA' }),
    ).toBeVisible();
    await expect(page.locator('.commands-cta')).toHaveCount(0);

    const { headers } = await configureSantaTestPage(page);
    await page.setViewportSize({ width: 320, height: 900 });
    await seedDiscoveryRulings(page, headers);
    await page.goto('/commands');
    await expect(
      page
        .locator('[data-commands-list] > li')
        .first()
        .locator('[data-public-ruling-request]'),
    ).toBeVisible();
    await expect(
      page
        .locator('[data-commands-list] > li')
        .first()
        .locator('[data-public-ruling-response]'),
    ).toContainText('Santa answered');
    await page
      .getByRole('link', { name: /Read Santa's answer/i })
      .first()
      .focus();
    await expect(
      page.getByRole('link', { name: /Read Santa's answer/i }).first(),
    ).toBeFocused();

    await page.goto('/commands?q=this-will-not-match');
    await expect(
      page
        .getByLabel('Find Requests')
        .getByRole('link', { name: 'CLEAR FILTERS' }),
    ).toBeVisible();

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

  test('treats a missing rulings column as an unavailable Browse Requests dependency failure', async ({
    page,
  }) => {
    await configureSantaTestPage(page, {
      scenario: 'missing-rulings-column',
    });
    const response = await page.goto('/commands');

    expect(response?.status()).toBe(503);
    await expect(
      page.getByText('REQUESTS ANSWERED BY SANTA ARE TEMPORARILY UNAVAILABLE.'),
    ).toBeVisible();
    await expect(
      page.getByText('Please try again in a little while.'),
    ).toBeVisible();
  });

  test('includes only public entry points in the sitemap', async ({ page }) => {
    await configureSantaTestPage(page);
    const response = await page.request.get('/sitemap.xml');
    const body = await response.text();

    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('application/xml');
    expect(body).toContain('http://127.0.0.1:4321/');
    expect(body).toContain('http://127.0.0.1:4321/commands');
    expect(body).not.toContain('/commands?');
    expect(body).not.toContain('/workshop');
    expect(body).not.toContain('/api');
  });
});
