import { test, expect } from '@playwright/test';

test.describe('Organization Administration UI E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], #email', 'admin@tokyograndeur.demo');
    await page.fill('input[type="password"], #password', 'Demo1234!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|setup-center)/, { timeout: 15000 });
  });

  test('1. should navigate to organization view and display hierarchy management', async ({
    page,
  }) => {
    await page.goto('/organization');

    // Page title and subtitle
    await expect(page.locator('.hms-page-header__title, .page-title')).toHaveText('Organization Architecture');
    await expect(page.locator('.hms-page-header__subtitle, .page-subtitle')).toContainText('hierarchy');

    // Action buttons
    await expect(page.getByRole('button', { name: /Full Hierarchy/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Add Group/i })).toBeVisible();
  });

  test('2. should open and close entity creation modal', async ({ page }) => {
    await page.goto('/organization');

    // Click Add Group
    await page.getByRole('button', { name: /Add Group/i }).click();

    // Verify modal is open
    await expect(page.locator('.hms-modal, .modal-card')).toBeVisible();
    await expect(page.locator('.hms-modal__title, .modal-header h3')).toContainText('Add New');

    // Close modal
    await page.locator('.hms-modal__close, .modal-close').click();
    await expect(page.locator('.hms-modal, .modal-card')).not.toBeVisible();
  });

  test('3. should toggle to Full Hierarchy Tree view', async ({ page }) => {
    await page.goto('/organization');

    // Click tree button
    await page.getByRole('button', { name: /Full Hierarchy/i }).click();

    // Verify tree view section
    await expect(page.locator('.tree-card')).toBeVisible();
  });

  test('4. should switch between Dashboard and Organization via navigation', async ({
    page,
  }) => {
    await page.goto('/organization');

    // Click Dashboard in navigation
    await page.locator('a.hms-sidebar__item[routerLink="/dashboard"]').click();
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Click Organization in navigation
    await page.locator('a.hms-sidebar__item[routerLink="/organization"]').click();
    await expect(page).toHaveURL(/.*\/organization/);
    await expect(page.locator('.hms-page-header__title, .page-title')).toHaveText('Organization Architecture');
  });
});
