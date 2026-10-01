import { test, expect } from '@playwright/test';

test.describe('Web Shell Foundation Smoke Tests', () => {
  test('1. unauthenticated root should redirect to login with enterprise branding and persona selection', async ({ page }) => {
    await page.goto('/');

    // Router should redirect unauthenticated visitor to /login
    await expect(page).toHaveURL(/.*\/login/);

    // Verify brand heading / title on login page
    await expect(page.locator('.brand-title, .hms-brand-logo, h2')).toBeVisible();

    // Verify email & password form inputs exist
    await expect(page.locator('input[type="email"], #email')).toBeVisible();
    await expect(page.locator('input[type="password"], #password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Verify quick persona cards exist for demo switching
    const personaCards = page.locator('.persona-card, .persona-item, button[class*="persona"]');
    await expect(personaCards.first()).toBeVisible();
  });

  test('2. authenticated admin should access dashboard and system infrastructure matrix', async ({ page }) => {
    // Perform authentication as Corporate Platform Admin
    await page.goto('/login');
    await page.fill('input[type="email"], #email', 'admin@tokyograndeur.demo');
    await page.fill('input[type="password"], #password', 'Demo1234!');
    await page.click('button[type="submit"]');

    // Confirm successful login and navigation to dashboard
    await page.waitForURL(/\/(dashboard|setup-center)/, { timeout: 15000 });

    // Navigate to System Health Matrix
    await page.goto('/health');
    await expect(page.locator('.hero-title')).toHaveText('Enterprise Infrastructure Matrix');

    // Verify 4 infrastructure status cards (database, redis, rabbitmq, mailpit)
    await expect(page.locator('.service-card')).toHaveCount(4);
  });
});
