import { test, expect, Page } from '@playwright/test';

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.fill('#email', 'admin@tokyograndeur.demo');
  await page.fill('#password', 'Demo1234!');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|setup-center)/, { timeout: 25000 });
}

test.describe('Organization Administration UI E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('1. should navigate to organization view and display hierarchy management', async ({ page }) => {
    await page.goto('/organization');

    // Page title and subtitle
    await expect(page.locator('.hms-page-header__title')).toHaveText('Organization Architecture');
    await expect(page.locator('.hms-page-header__subtitle')).toContainText('hierarchy');

    // Action buttons in header
    await expect(page.locator('hms-button').filter({ hasText: 'Full Hierarchy' })).toBeVisible();
    await expect(page.locator('hms-button').filter({ hasText: 'Add Group' })).toBeVisible();
  });

  test('2. should open and close entity creation modal', async ({ page }) => {
    await page.goto('/organization');

    // Click Add Group
    await page.locator('hms-button').filter({ hasText: 'Add Group' }).click();

    // Verify modal is open
    await expect(page.locator('.hms-modal')).toBeVisible();
    await expect(page.locator('.hms-modal__title')).toHaveText('Add New Hotel Group');

    // Close modal
    await page.locator('.hms-modal__close').click();
    await expect(page.locator('.hms-modal')).not.toBeVisible();
  });

  test('3. should toggle to Full Hierarchy Tree view', async ({ page }) => {
    await page.goto('/organization');

    // Click Full Hierarchy tree button
    await page.locator('hms-button').filter({ hasText: 'Full Hierarchy' }).click();

    // Verify tree view section heading
    await expect(page.locator('.org-section-title, h2').filter({ hasText: 'Enterprise Organization Hierarchy Tree' })).toBeVisible();
  });

  test('4. should switch between System Status and Organization', async ({ page }) => {
    // Navigate to System Health
    await page.goto('/health');
    await expect(page).toHaveURL(/.*\/health/);
    await expect(page.locator('.hero-title')).toHaveText('Enterprise Infrastructure Matrix');

    // Navigate to Organization
    await page.goto('/organization');
    await expect(page).toHaveURL(/.*\/organization/);
    await expect(page.locator('.hms-page-header__title')).toHaveText('Organization Architecture');
  });
});

