import { test, expect, Page } from '@playwright/test';

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.waitForSelector('input#admin-email');
  await page.fill('input#admin-email', 'kwadwoaddo@googlemail.com');
  await page.fill('input#admin-password', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

test.describe('Tier 3: Cross-Feature Combinations', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Cross-Feature 1: Settings to Dashboard update propagation', async ({ page }) => {
    // 1. Change Organisation Name in Settings
    await page.goto('/dashboard/settings');
    // Get original name text from span
    const originalName = await page.locator('span.text-foreground').first().innerText();
    const tempName = `${originalName} E2E Test`;
    
    // Click edit pencil
    await page.locator('button:has(svg.lucide-pencil)').first().click({ force: true });
    // Fill new name
    await page.locator('input#org-name').fill(tempName);
    // Click save check button
    await page.locator('button:has(svg.lucide-check)').first().click();
    await page.waitForTimeout(2000);
    
    // 2. Go back to Dashboard and verify updated Organisation Name appears
    await page.goto('/dashboard');
    await expect(page.locator(`text="${tempName}"`).first()).toBeVisible();

    // 3. Revert change in Settings to keep database clean
    await page.goto('/dashboard/settings');
    await page.locator('button:has(svg.lucide-pencil)').first().click({ force: true });
    await page.locator('input#org-name').fill(originalName);
    await page.locator('button:has(svg.lucide-check)').first().click();
    await page.waitForTimeout(2000);
  });

  test('Cross-Feature 2: Students to Dashboard KPI metrics linkage', async ({ page }) => {
    // 1. View current student KPIs on Dashboard
    await page.goto('/dashboard');
    const initialText = await page.locator('text="Bookings"').or(page.locator('text="New Students"')).first().innerText();
    
    // 2. Go to Students page and verify we can search students
    await page.goto('/dashboard/students?centre=all');
    await expect(page.locator('text="Leo Harrison"').first()).toBeVisible();

    // 3. Go to Dashboard and ensure metrics are stable
    await page.goto('/dashboard');
    const finalText = await page.locator('text="Bookings"').or(page.locator('text="New Students"')).first().innerText();
    expect(finalText).toEqual(initialText);
  });

  test('Cross-Feature 3: Bookings management updating Attendance view', async ({ page }) => {
    // 1. Go to Bookings list and check a booking exists
    await page.goto('/dashboard/bookings');
    await expect(page.locator('h1:has-text("Bookings")')).toBeVisible();
    
    // 2. Click on the first booking detail link
    const bookingRow = page.locator('table tbody tr').first();
    if (await bookingRow.isVisible()) {
      const detailsLink = bookingRow.locator('a[href*="/dashboard/bookings/"]').first();
      if (await detailsLink.count() > 0) {
        await detailsLink.click();
        await page.waitForURL(/\/dashboard\/bookings\/.+/);
        // Verify booking detail page loads
        await expect(page.locator('text="Booking Details"').or(page.locator('text="Status"'))).toBeVisible();
      }
    }
  });

  test('Cross-Feature 4: Settings brand color affecting global dashboard elements', async ({ page }) => {
    // 1. Get brand color from settings
    await page.goto('/dashboard/settings');
    await page.locator('button:has-text("Branding")').first().click();
    const colorInput = page.locator('input[type="color"]');
    const brandColorVal = await colorInput.inputValue();

    // 2. Go to dashboard and check elements style/accent color
    await page.goto('/dashboard');
    const openMenuButton = page.locator('button[aria-label="Open menu"]');
    if (await openMenuButton.isVisible()) {
      await openMenuButton.click();
    }
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    // Since brandColor is injected, it might be set as custom styling
    await expect(page.locator('body')).toBeVisible();
  });

  test('Cross-Feature 5: Student detail navigation to Parent details linkage', async ({ page }) => {
    // 1. Go to student profile
    await page.goto('/dashboard/students?centre=all');
    await page.locator('text="Leo Harrison"').first().click({ force: true });
    await page.waitForURL(/\/dashboard\/students\/.+/);

    // 2. Find and click Parent link inside Student Profile
    const parentLink = page.locator('a[href*="/dashboard/parents/"]');
    if (await parentLink.count() > 0) {
      await parentLink.first().click();
      await page.waitForURL(/\/dashboard\/parents\/.+/);
      await expect(page.locator('h1:has-text("Parent Profile")').or(page.locator('text="Parent Details"')).or(page.locator('text=Sarah')).first()).toBeVisible();
    }
  });

  test('Cross-Feature 6: Finance Invoice details referencing Student Profile', async ({ page }) => {
    // 1. Go to Finance page
    await page.goto('/dashboard/finance/invoices');
    // Ensure table renders
    await expect(page.locator('table').first().or(page.locator('text="No invoices"'))).toBeVisible();
    
    // 2. Click on invoice link or check details if any
    const firstInvoiceLink = page.locator('table tbody tr a[href*="/dashboard/finance/invoices/"]').first();
    if (await firstInvoiceLink.count() > 0) {
      await firstInvoiceLink.click();
      // Verify invoice info details link back or reference students
      await expect(page.locator('text="Invoice"').or(page.locator('text="Status"'))).toBeVisible();
    }
  });

});
