import { expect, test } from '@playwright/test';

const viewports = [
  { width: 320, height: 900 },
  { width: 375, height: 900 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1440, height: 1100 },
];

test.describe('homepage smoke test', () => {
  for (const viewport of viewports) {
    test(`renders cleanly at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
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

      const nameField = page.getByLabel('What should Santa call you?');
      const requestField = page.getByRole('textbox', {
        name: 'What would you like Santa to command?',
      });
      const submitButton = page.getByRole('button', { name: 'ASK SANTA' });

      await expect(nameField).toBeVisible();
      await expect(requestField).toBeVisible();
      await expect(requestField).toHaveAttribute('maxlength', '500');
      await expect(
        page.getByRole('heading', { name: /Santa.*Latest Commands/i }),
      ).toBeVisible();
      await expect(
        page.getByText('A project from Argon Collective LLC'),
      ).toBeVisible();

      await submitButton.focus();
      await expect(submitButton).toBeFocused();
      await submitButton.press('Enter');

      await expect(
        page.getByText(
          "Santa's workshop is not ready to receive requests yet.",
        ),
      ).toBeVisible();

      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });

      expect(hasHorizontalOverflow).toBe(false);
    });
  }
});
