import { test, expect } from '@playwright/test';

test.describe('Web Shell Foundation Smoke Tests', () => {
  test('should display enterprise brand header and operational status', async ({ page }) => {
    await page.goto('/');

    // Verify brand header
    await expect(page.locator('.brand-name')).toHaveText('ENTERPRISE HMS');
    await expect(page.locator('.hero-title')).toHaveText('Enterprise Infrastructure Matrix');

    // Verify status card elements
    await expect(page.locator('.service-card')).toHaveCount(4);
  });
});
