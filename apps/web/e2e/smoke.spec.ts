import { test, expect } from '@playwright/test';

test.describe('Clear Money smoke', () => {
  test('loads landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Clear Money').first()).toBeVisible();
  });

  test('loads setup welcome', async ({ page }) => {
    await page.goto('/setup/welcome');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /continue|continuer|متابعة/i })).toBeVisible();
  });
});
