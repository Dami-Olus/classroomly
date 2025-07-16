import { test, expect } from '@playwright/test';

test('user can update profile', async ({ page }) => {
  await page.goto('http://localhost:3000/auth');
  await page.fill('input[name="email"]', 'e2euser@example.com');
  await page.fill('input[name="password"]', 'NewTest1234!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/dashboard/);
  await page.goto('http://localhost:3000/profile');
  await page.click('button', { hasText: 'Edit Profile' });
  await page.fill('input[name="firstName"]', 'Updated');
  await page.click('button[type="submit"]');
  await expect(page).toHaveText(/profile updated/i);
  await expect(page).toHaveText(/updated/i);
}); 