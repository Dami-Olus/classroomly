import { test, expect } from '@playwright/test';

test('student books a class and tutor approves', async ({ page, context }) => {
  // Student logs in
  await page.goto('http://localhost:3000/auth');
  await page.fill('input[name="email"]', 'student@example.com');
  await page.fill('input[name="password"]', 'Test1234!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/dashboard/);

  // Student books a class
  await page.goto('http://localhost:3000/classes');
  await page.click('text=Algebra 101');
  await page.click('text=Book a Session');
  await page.click('button[type="submit"]');
  await expect(page).toHaveText(/booking successful/i);

  // Log out student
  await page.click('text=Sign Out');

  // Tutor logs in
  const tutorPage = await context.newPage();
  await tutorPage.goto('http://localhost:3000/auth');
  await tutorPage.fill('input[name="email"]', 'tutor@example.com');
  await tutorPage.fill('input[name="password"]', 'Test1234!');
  await tutorPage.click('button[type="submit"]');
  await expect(tutorPage).toHaveURL(/dashboard/);

  // Tutor approves booking
  await tutorPage.goto('http://localhost:3000/bookings');
  await tutorPage.click('button', { hasText: 'Approve' });
  await expect(tutorPage).toHaveText(/approved/i);

  // Tutor cancels booking
  await tutorPage.click('button', { hasText: 'Cancel' });
  await expect(tutorPage).toHaveText(/cancelled/i);
}); 