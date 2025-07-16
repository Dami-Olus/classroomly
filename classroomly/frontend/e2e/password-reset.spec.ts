import { test, expect } from '@playwright/test';

test('user can reset password and login', async ({ page }) => {
  await page.goto('http://localhost:3000/auth');
  await page.click('text=Forgot Password');
  await page.fill('input[name="email"]', 'e2euser@example.com');
  await page.click('button[type="submit"]');
  await expect(page).toHaveText(/check your email/i);
  // Simulate user clicking reset link and setting new password (mock or use test email system)
  // For demo, assume reset link is /reset-password?token=demo
  await page.goto('http://localhost:3000/reset-password?token=demo');
  await page.fill('input[name="password"]', 'NewTest1234!');
  await page.fill('input[name="confirmPassword"]', 'NewTest1234!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveText(/password reset successful/i);
  // Login with new password
  await page.goto('http://localhost:3000/auth');
  await page.fill('input[name="email"]', 'e2euser@example.com');
  await page.fill('input[name="password"]', 'NewTest1234!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/dashboard/);
}); 