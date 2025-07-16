import { test, expect } from '@playwright/test';

test('user can register and login', async ({ page }) => {
  await page.goto('http://localhost:3000/auth');

  // Switch to register tab if needed
  await page.click('text=Sign Up');

  // Fill registration form
  await page.fill('input[name="firstName"]', 'E2E');
  await page.fill('input[name="lastName"]', 'E2EUser');
  await page.fill('input[name="email"]', 'e2euser@example.com');
  await page.fill('input[name="password"]', 'Test1234!');
  await page.fill('input[name="confirmPassword"]', 'Test1234!');
  await page.click('button[type="submit"]');

  // Wait for success message or redirect
  await expect(page).toHaveURL(/dashboard/);

  // Log out
  await page.click('text=Sign Out');

  // Log in
  await page.goto('http://localhost:3000/auth');
  await page.fill('input[name="email"]', 'e2euser@example.com');
  await page.fill('input[name="password"]', 'Test1234!');
  await page.click('button[type="submit"]');

  // Should be redirected to dashboard
  await expect(page).toHaveURL(/dashboard/);
}); 