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
      ).toBeVisible();
      await expect(
        page.getByText('HELLO THERE! WHAT WOULD YOU LIKE SANTA TO COMMAND?'),
      ).toBeVisible();

      const nameField = page.getByLabel('What should Santa call you?');
      const requestField = page.getByRole('textbox', {
        name: 'What would you like Santa to command?',
      });
      const submitButton = page.getByRole('button', { name: 'ASK SANTA' });

      await expect(nameField).toBeVisible();
      await expect(requestField).toBeVisible();
      await expect(requestField).toHaveAttribute('maxlength', '500');

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
