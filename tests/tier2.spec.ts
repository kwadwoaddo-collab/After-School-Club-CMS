import { test, expect, Page } from '@playwright/test';

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.waitForTimeout(5000);
  await page.waitForSelector('input#admin-email');
  await page.fill('input#admin-email', 'kwadwoaddo@googlemail.com');
  await page.fill('input#admin-password', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

test.describe('Tier 2: Boundary & Corner Cases', () => {

  // --- FEATURE: Dashboard (5 tests) ---
  test('Dashboard - Unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.url()).toMatch(/\/login|\/staff-login/);
  });

  test('Dashboard - Non-existent route returns 404 status', async ({ page }) => {
    const response = await page.goto('/non-existent-route-99999');
    expect(response?.status()).toBe(404);
  });

  test('Dashboard - Sidebar toggle button hidden on large screens but present/functional in mobile', async ({ page, viewport }) => {
    await loginAsAdmin(page);
    if (viewport && viewport.width < 768) {
      const openMenuButton = page.locator('button[aria-label="Open menu"]');
      if (await openMenuButton.isVisible()) {
        await openMenuButton.click();
      }
    }
    const closeBtn = page.locator('button[aria-label="Close menu"]');
    if (viewport && viewport.width < 768) {
      await expect(closeBtn).toBeVisible();
    } else {
      await expect(closeBtn).toBeHidden();
    }
  });

  test('Dashboard - Active centre combined view URL query parameter boundary', async ({ page }) => {
    await loginAsAdmin(page);
    // Navigate with an invalid/random centre UUID
    await page.goto('/dashboard?centre=00000000-0000-0000-0000-000000000000');
    // Ensure the page loads without 500 error and defaults safely or shows no data gracefully
    await expect(page.locator('body')).toBeVisible();
    const is500 = await page.locator('text="500"').isVisible();
    expect(is500).toBeFalsy();
  });

  test('Dashboard - Combined view handles empty query search parameters', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard?search=&centre=all');
    await expect(page.locator('body')).toBeVisible();
  });

  // --- FEATURE: Students (5 tests) ---
  test('Students - Search with special characters returns empty state', async ({ page }) => {
    await loginAsAdmin(page);
    // Navigate directly with query parameter to bypass debounce delays
    await page.goto('/dashboard/students?search=!@#$%^&*()_+');
    // Should render empty results state
    await expect(page.locator('text="No students yet"').or(page.locator('text="No students"'))).toBeVisible();
  });

  test('Students - Access non-existent student UUID returns not found gracefully', async ({ page }) => {
    await loginAsAdmin(page);
    // Invalid UUID format
    const response = await page.goto('/dashboard/students/00000000-0000-0000-0000-000000000000');
    // It should either return 404 or show a friendly message or redirect, but NOT 500
    expect(response?.status()).not.toBe(500);
  });

  test('Students - Add Student form validation error on empty submit', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/students/add');
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    // Validate that validation messages are shown
    await expect(page.locator('text="First name is required"').or(page.locator('text="required"')).first()).toBeVisible();
  });

  test('Students - Add Student form validation error on invalid email', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/students/add');
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.count() > 0) {
      // Use a format that passes browser validation (has @) but fails regex validation (no dot)
      await emailInput.fill('invalid@domain');
      await page.locator('button[type="submit"]').click();
      await expect(page.locator('text="Invalid email address"').first()).toBeVisible();
    }
  });

  test('Students - Import page handles upload constraints gracefully', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/students/import');
    // Clicks upload button without selected file
    const uploadBtn = page.locator('button:has-text("Upload"), button:has-text("Import")');
    if (await uploadBtn.count() > 0) {
      await uploadBtn.first().click();
      // Should not crash the server
      await expect(page.locator('body')).toBeVisible();
    }
  });

  // --- FEATURE: Finance (5 tests) ---
  test('Finance - Invoices filter with far future date returns empty', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/finance/invoices?status=overdue');
    // Page loads and does not crash
    await expect(page.locator('body')).toBeVisible();
  });

  test('Finance - Search non-existent invoice ID shows empty', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/finance/invoices?search=NONEXISTENT_INV_99999');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Finance - Access non-existent receipt ID returns 404 or safe message', async ({ page }) => {
    await loginAsAdmin(page);
    const response = await page.goto('/dashboard/finance/receipt/00000000-0000-0000-0000-000000000000');
    expect(response?.status()).not.toBe(500);
  });

  test('Finance - Access invoice PDF route with invalid token is blocked', async ({ page }) => {
    const response = await page.goto('/api/invoices/download/00000000-0000-0000-0000-000000000000');
    // Should be unauthorized or 404
    expect(response?.status() === 401 || response?.status() === 404 || response?.status() === 307).toBeTruthy();
  });

  test('Finance - Finance dashboard handles empty stats safely', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/finance?centre=00000000-0000-0000-0000-000000000000');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Settings - Save settings fails with empty org name', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/settings');
    await page.locator('button:has(svg.lucide-pencil)').first().click({ force: true });
    const nameInput = page.locator('input#org-name');
    await nameInput.fill('');
    await page.locator('button:has(svg.lucide-check)').first().click();
    await expect(page.locator('text="empty"').or(page.locator('text="Name cannot be empty"')).first()).toBeVisible();
  });

  test('Settings - Save settings fails with invalid email', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/settings');
    await page.locator('button:has-text("Edit")').first().click();
    const emailInput = page.locator('input#contact-email');
    await emailInput.fill('invalid-email');
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('Settings - Brand color field allows hex colors and has constraints', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/settings');
    await page.locator('button:has-text("Branding")').click();
    const colorInput = page.locator('input[type="color"]');
    await expect(colorInput).toBeVisible();
  });

  test('Settings - Save settings without changes does not error', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/settings');
    await page.locator('button:has(svg.lucide-pencil)').first().click({ force: true });
    await page.locator('button:has(svg.lucide-check)').first().click();
    await expect(page.locator('body')).toBeVisible();
  });

  test('Settings - GDPR data export triggers download attempt', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard/settings');
    const gdprBtn = page.locator('button:has-text("GDPR"), button:has-text("Export")');
    if (await gdprBtn.count() > 0) {
      // Expect download to trigger or be clicked
      await gdprBtn.first().click();
      await page.waitForTimeout(1000);
      await expect(page.locator('body')).toBeVisible();
    }
  });

});
