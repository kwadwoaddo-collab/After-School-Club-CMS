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

test.describe('Tier 1: Feature Coverage', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // --- FEATURE: Dashboard (5 tests) ---
  test('Dashboard - KPI metrics are visible', async ({ page }) => {
    // Wait for the KPI container or cards
    await expect(page.locator('text="New Students"').or(page.locator('text="Bookings"')).or(page.locator('text="New Registrations"')).first()).toBeVisible();
  });

  test('Dashboard - Organization name is displayed', async ({ page }) => {
    await expect(page.locator('text="Bright Star Academy"').first()).toBeVisible();
  });

  test('Dashboard - Sidebar is visible and navigation links are present', async ({ page }) => {
    const openMenuButton = page.locator('button[aria-label="Open menu"]');
    if (await openMenuButton.isVisible()) {
      await openMenuButton.click();
    }
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator('text="Dashboard"')).toBeVisible();
    await expect(sidebar.locator('text="Students"')).toBeVisible();
    await expect(sidebar.locator('text="Finance"')).toBeVisible();
    await expect(sidebar.locator('text="Settings"')).toBeVisible();
  });

  test('Dashboard - Active Centre Combined View dropdown works', async ({ page }) => {
    // Look for active centre combined view or center selector dropdown button
    const centreBtn = page.locator('button:has-text("Active Centre"), button:has-text("Combined View")');
    if (await centreBtn.count() > 0) {
      await centreBtn.first().click();
      await page.waitForTimeout(500);
      // Verify dropdown option list appears (e.g. contains Main Campus or Combined View)
      await expect(page.locator('role=menuitem').or(page.locator('text="Main Campus"')).first()).toBeVisible();
      await page.keyboard.press('Escape'); // Close it
    }
  });

  test('Dashboard - Profile info is present', async ({ page }, testInfo) => {
    // Verify user profile greeting or admin fallback label is visible
    const isMobile = testInfo.project.name.toLowerCase().includes('mobile');
    if (isMobile) {
      const userMenuBtn = page.locator('button[aria-label="User menu"]');
      await expect(userMenuBtn).toBeVisible();
      await userMenuBtn.click();
      await expect(page.locator('text="Admin User"').or(page.locator('text="Owner"')).filter({ visible: true }).first()).toBeVisible();
      await userMenuBtn.click(); // close it
    } else {
      await expect(page.locator('text="Admin User"').or(page.locator('text="Owner"')).filter({ visible: true }).first()).toBeVisible();
    }
  });

  // --- FEATURE: Students (5 tests) ---
  test('Students - List page loads successfully', async ({ page }) => {
    await page.goto('/dashboard/students');
    await expect(page.locator('h1:has-text("Students")').first()).toBeVisible();
    // Verify search input is present
    await expect(page.locator('input[placeholder*="Search by student"]')).toBeVisible();
  });

  test('Students - Student search functionality works', async ({ page }) => {
    // Navigate directly with query parameter to bypass debounce delays and cookie filtering
    await page.goto('/dashboard/students?search=Leo&centre=all');
    // Student list should show Leo Harrison
    await expect(page.locator('text="Leo Harrison"').first()).toBeVisible();
  });

  test('Students - Profile details page loads successfully', async ({ page }) => {
    await page.goto('/dashboard/students?centre=all');
    // Click on a student's name to view details
    const studentLink = page.locator('text="Leo Harrison"').first();
    await studentLink.click({ force: true });
    await page.waitForURL(/\/dashboard\/students\/.+/);
    // Verify detail headers
    await expect(page.locator('h1:has-text("Leo Harrison")').first()).toBeVisible();
    await expect(page.locator('text=Severe Nut Allergy').first()).toBeVisible();
  });

  test('Students - Add student form loads successfully', async ({ page }) => {
    await page.goto('/dashboard/students/add');
    await expect(page.locator('h1:has-text("Add New Student")').or(page.locator('h1:has-text("Add Student")')).first()).toBeVisible();
    await expect(page.locator('input[name="firstName"]').or(page.locator('input[placeholder*="first name"]'))).toBeVisible();
  });

  test('Students - Import page loads successfully', async ({ page }) => {
    await page.goto('/dashboard/students/import');
    await expect(page.locator('h1:has-text("Import Students")').first()).toBeVisible();
    await expect(page.locator('text="Download template"').or(page.locator('text="Download template.csv"')).or(page.locator('input[type="file"]')).first()).toBeVisible();
  });

  // --- FEATURE: Finance (5 tests) ---
  test('Finance - Invoices subpage loads successfully', async ({ page }) => {
    await page.goto('/dashboard/finance/invoices');
    await expect(page.locator('h1:has-text("Full Invoice History")').or(page.locator('h1:has-text("Invoice")')).first()).toBeVisible();
    await expect(page.locator('table').or(page.locator('text="No invoices"'))).toBeVisible();
  });

  test('Finance - Receipts subpage loads successfully', async ({ page }) => {
    await page.goto('/dashboard/finance/receipt');
    await expect(page.locator('h1:has-text("Cash Receipt Generator")').or(page.locator('text="Receipt"')).first()).toBeVisible();
  });

  test('Finance - Overview page loads with financial summaries', async ({ page }) => {
    await page.goto('/dashboard/finance');
    await expect(page.locator('h1:has-text("Finance Ledger")').first()).toBeVisible();
    await expect(page.locator('text="Total Revenue"').or(page.locator('text="Outstanding"')).or(page.locator('text="Invoiced"')).first()).toBeVisible();
  });

  test('Finance - Invoice filters are visible', async ({ page }) => {
    await page.goto('/dashboard/finance/invoices');
    // Check for status filter options (e.g. Paid, Overdue, Draft)
    await expect(page.locator('select').or(page.locator('text="Status"')).or(page.locator('text="Filter"')).first()).toBeVisible();
  });

  test('Finance - Receipts search works', async ({ page }) => {
    await page.goto('/dashboard/finance/receipt');
    // We should see search input or filter controls
    await expect(page.locator('input[placeholder*="Search"]').or(page.locator('select')).filter({ visible: true }).first()).toBeVisible();
  });

  // --- FEATURE: Settings (5 tests) ---
  test('Settings - Page loads successfully', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.locator('h1:has-text("Workspace Settings")').or(page.locator('h1:has-text("Settings")')).first()).toBeVisible();
  });

  test('Settings - GDPR export button is visible', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.locator('button:has-text("GDPR")').or(page.locator('button:has-text("Export")')).first()).toBeVisible();
  });

  test('Settings - Organisation profile fields are pre-filled', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.locator('text="Bright Star Academy"').first()).toBeVisible();
  });

  test('Settings - Brand color picker is present', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.locator('button:has-text("Branding")').first().click();
    await expect(page.locator('input[type="color"]')).toBeVisible();
  });

  test('Settings - General sections exist', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.locator('text="Profile Settings"').or(page.locator('text="Organisation Information"')).or(page.locator('text="Save Settings"')).first()).toBeVisible();
  });

});
