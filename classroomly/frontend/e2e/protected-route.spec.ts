import { test, expect } from '@playwright/test';

test('dashboard redirects to login if not authenticated', async ({ page }) => {
  await page.goto('http://localhost:3000/dashboard');
  await expect(page).toHaveURL(/auth/);
}); 