import { test, expect } from '@playwright/test';

test.describe('Organization Administration UI E2E Tests', () => {
  test('1. should navigate to organization view and display hierarchy management', async ({
    page,
  }) => {
    await page.goto('/organization');

    // Page title and subtitle
    await expect(page.locator('.page-title')).toHaveText('Organization Architecture');
    await expect(page.locator('.page-subtitle')).toContainText('Hotel Group');

    // Action buttons
    await expect(
      page.locator('.btn-secondary').filter({ hasText: 'Full Hierarchy Tree' }),
    ).toBeVisible();
    await expect(page.locator('.btn-primary').filter({ hasText: '+ Add Group' })).toBeVisible();
  });

  test('2. should open and close entity creation modal', async ({ page }) => {
    await page.goto('/organization');

    // Click Add Group
    await page.locator('.btn-primary').filter({ hasText: '+ Add Group' }).click();

    // Verify modal is open
    await expect(page.locator('.modal-card')).toBeVisible();
    await expect(page.locator('.modal-header h3')).toHaveText('Add New Group');

    // Close modal
    await page.locator('.modal-close').click();
    await expect(page.locator('.modal-card')).not.toBeVisible();
  });

  test('3. should toggle to Full Hierarchy Tree view', async ({ page }) => {
    await page.goto('/organization');

    // Click tree button
    await page.locator('.btn-secondary').filter({ hasText: 'Full Hierarchy Tree' }).click();

    // Verify tree view section
    await expect(page.locator('h2')).toContainText('Enterprise Organization Hierarchy Tree');
  });

  test('4. should switch between System Status and Organization via top navigation', async ({
    page,
  }) => {
    await page.goto('/organization');

    // Click System Status in header
    await page.locator('.nav-link').filter({ hasText: 'System Status' }).click();
    await expect(page).toHaveURL(/.*\/health/);
    await expect(page.locator('.hero-title')).toHaveText('Enterprise Infrastructure Matrix');

    // Click Organization in header
    await page.locator('.nav-link').filter({ hasText: 'Organization' }).click();
    await expect(page).toHaveURL(/.*\/organization/);
    await expect(page.locator('.page-title')).toHaveText('Organization Architecture');
  });
});
