import { test, expect, Page } from '@playwright/test';

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.waitForTimeout(2000);
  await page.waitForSelector('input#admin-email');
  
  try {
    await page.fill('input#admin-email', 'kwadwoaddo@googlemail.com');
    await page.fill('input#admin-password', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  } catch (err) {
    console.log('Login failed with kwadwoaddo@googlemail.com, trying fallback admin@example.com...');
    await page.goto('/login');
    await page.waitForTimeout(2000);
    await page.fill('input#admin-email', 'admin@example.com');
    await page.fill('input#admin-password', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  }
}

test.describe('Tier 5: Adversarial Coverage Hardening & Edge Cases', () => {

  test('Adversarial - Active Centre Dropdown misalignment on viewport resize', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForTimeout(2000);

    // Get Active Centre button from the sidebar (expanded state)
    const centreBtn = page.locator('aside button:has-text("Active Centre"), aside button:has-text("Combined View")').first();
    await expect(centreBtn).toBeVisible();

    // Click it to open the portal dropdown
    await centreBtn.click();
    await page.waitForTimeout(1000); // Wait for transition animation to complete

    // Wait for the dropdown option to be visible
    const combinedViewOption = page.locator('button:has-text("Combined View")').first();
    await expect(combinedViewOption).toBeVisible();

    // Check that dropdown is open
    const dropdown = page.locator('div.fixed.bg-popover.border.border-border.rounded-2xl').first();
    await expect(dropdown).toBeVisible();

    // Bounding boxes before resize
    const btnRectBefore = await centreBtn.boundingBox();
    const dropdownRectBefore = await dropdown.boundingBox();
    
    console.log('btnRectBefore:', btnRectBefore);
    console.log('dropdownRectBefore:', dropdownRectBefore);
    
    expect(btnRectBefore).not.toBeNull();
    expect(dropdownRectBefore).not.toBeNull();

    // Resize viewport to mobile size
    await page.setViewportSize({ width: 600, height: 800 });
    await page.waitForTimeout(1000);

    // Assert that the active centre dropdown is closed (hidden) after resizing
    await expect(dropdown).toBeHidden();
  });

  test('Adversarial - Aggressive CSS button shape override on header/sidebar buttons', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForTimeout(2000);

    // Check user menu profile button (should be rounded-xl in markup, but globals.css overrides it)
    const userMenuBtn = page.locator('button[aria-label="User menu"]').first();
    await expect(userMenuBtn).toBeVisible();

    const userMenuRadius = await userMenuBtn.evaluate(el => window.getComputedStyle(el).borderRadius);
    console.log(`User menu button border-radius: ${userMenuRadius}`);

    // Check theme toggle button
    const themeToggleBtn = page.locator('button[aria-label*="theme"], button[aria-label*="Toggle theme"]').first();
    await expect(themeToggleBtn).toBeVisible();

    const themeToggleRadius = await themeToggleBtn.evaluate(el => window.getComputedStyle(el).borderRadius);
    console.log(`Theme toggle button border-radius: ${themeToggleRadius}`);

    // Assert that the keep-shape class prevents the button from turning into a pill
    expect(userMenuRadius).not.toContain('9999px');
    expect(themeToggleRadius).not.toContain('9999px');
  });

  test('Adversarial - Theme toggle persistence and transitions', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForTimeout(2000);

    const themeToggleBtn = page.locator('button[aria-label*="theme"], button[aria-label*="Toggle theme"]').first();
    await expect(themeToggleBtn).toBeVisible();

    // Read current theme state from local storage
    const currentTheme = await page.evaluate(() => localStorage.getItem('theme'));
    console.log(`Initial theme in localStorage: ${currentTheme}`);

    // Cycle the theme toggle
    await themeToggleBtn.click();
    await page.waitForTimeout(500);
    const nextTheme = await page.evaluate(() => localStorage.getItem('theme'));
    console.log(`Theme after first toggle: ${nextTheme}`);
    expect(nextTheme).not.toBe(currentTheme);

    // Cycle again
    await themeToggleBtn.click();
    await page.waitForTimeout(500);
    const thirdTheme = await page.evaluate(() => localStorage.getItem('theme'));
    console.log(`Theme after second toggle: ${thirdTheme}`);
    expect(thirdTheme).not.toBe(nextTheme);
  });

  test('Adversarial - Scroll-based backdrop blur transition on Header', async ({ page }) => {
    await loginAsAdmin(page);
    await page.waitForTimeout(2000);

    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    // Verify initial layout state (at scroll y = 0)
    let headerClass = await header.getAttribute('class');
    expect(headerClass).toContain('bg-header/45');

    // Scroll down the page
    await page.evaluate(() => window.scrollTo(0, 100));
    await page.waitForTimeout(500);

    // Verify header backdrop transition style updates
    headerClass = await header.getAttribute('class');
    expect(headerClass).toContain('bg-header/80');
    expect(headerClass).toContain('shadow-sm');

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Verify header style reverts
    headerClass = await header.getAttribute('class');
    expect(headerClass).toContain('bg-header/45');
  });

  test('Adversarial - Sidebar mobile overlay backdrop click to close', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await loginAsAdmin(page);
    await page.waitForTimeout(2000);

    // Hamburger button in Header should be visible
    const hamburgerBtn = page.locator('button[aria-label="Open menu"]').first();
    await expect(hamburgerBtn).toBeVisible();

    // Sidebar should be collapsed initially (-translate-x-full)
    const sidebar = page.locator('aside').first();
    let sidebarClass = await sidebar.getAttribute('class');
    expect(sidebarClass).toContain('-translate-x-full');

    // Click hamburger to open sidebar
    await hamburgerBtn.click();
    await page.waitForTimeout(500);

    // Sidebar should be visible (translate-x-0)
    sidebarClass = await sidebar.getAttribute('class');
    expect(sidebarClass).toContain('translate-x-0');

    // Backdrop overlay should be visible
    const overlay = page.locator('div.fixed.inset-0.backdrop-blur-sm').first();
    await expect(overlay).toBeVisible();

    // Click the backdrop overlay (using force: true to bypass aside interception checks) to close the sidebar
    await overlay.click({ force: true });
    await page.waitForTimeout(500);

    // Sidebar should be collapsed again
    sidebarClass = await sidebar.getAttribute('class');
    expect(sidebarClass).toContain('-translate-x-full');
    await expect(overlay).toBeHidden();
  });

});
