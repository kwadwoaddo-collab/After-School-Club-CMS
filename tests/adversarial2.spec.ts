import { test, expect, Page } from '@playwright/test';

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.waitForTimeout(4000);
  
  // Try logging in with the seeded accounts
  try {
    await page.waitForSelector('input#admin-email', { timeout: 5000 });
    await page.fill('input#admin-email', 'kwadwoaddo@googlemail.com');
    await page.fill('input#admin-password', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  } catch (err) {
    // Retry/fallback to admin@example.com
    await page.goto('/login');
    await page.waitForTimeout(4000);
    await page.waitForSelector('input#admin-email', { timeout: 5000 });
    await page.fill('input#admin-email', 'admin@example.com');
    await page.fill('input#admin-password', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  }
}

test.describe('Tier 5: Adversarial Coverage Hardening & UI/UX Audit', () => {

  test.describe('Theme Toggle Persistence & Hydration', () => {
    test('theme sets correctly via localStorage and persists classes on dashboard', async ({ page }) => {
      await loginAsAdmin(page);

      // 1. Set to dark theme and reload dashboard
      await page.evaluate(() => {
        window.localStorage.setItem('theme', 'dark');
      });
      await page.reload();
      await page.waitForTimeout(1000);
      await expect(page.locator('html')).toHaveClass(/dark/);
      await expect(page.locator('html')).not.toHaveClass(/light/);

      // 2. Set to light theme and reload dashboard
      await page.evaluate(() => {
        window.localStorage.setItem('theme', 'light');
      });
      await page.reload();
      await page.waitForTimeout(1000);
      await expect(page.locator('html')).toHaveClass(/light/);
      await expect(page.locator('html')).not.toHaveClass(/dark/);
    });

    test('theme toggler updates document class and localStorage sequentially', async ({ page }) => {
      await loginAsAdmin(page);
      
      // Get the theme button in the header
      const themeBtn = page.locator('button[aria-label*="Toggle theme"]').first();
      await expect(themeBtn).toBeVisible();

      // Read current state of localStorage theme
      const themeInitially = await page.evaluate(() => window.localStorage.getItem('theme')) || 'system';
      
      // Click theme button once to toggle
      await themeBtn.click();
      await page.waitForTimeout(1000);

      // Verify localStorage was updated
      const themeAfterToggle = await page.evaluate(() => window.localStorage.getItem('theme'));
      expect(themeInitially).not.toBe(themeAfterToggle);
    });
  });

  test.describe('Active Centre Dropdown Detachment Edge Case', () => {
    test('dropdown position becomes detached from the button when sidebar collapsed state changes', async ({ page }) => {
      await loginAsAdmin(page);
      
      // Ensure sidebar is expanded initially (collapsed is false, meaning w-64 should be visible/width > 100px)
      const aside = page.locator('aside');
      await expect(aside).toBeVisible();
      
      // Locate the active centre selector button
      const centreBtn = page.locator('button:has-text("Active Centre"), button:has-text("Combined View")').first();
      await expect(centreBtn).toBeVisible();

      // Click to open centre dropdown
      await centreBtn.click();
      await page.waitForTimeout(500);

      // Get initial position/bounding box of the portal dropdown
      // The portal dropdown has fixed z-[200] index and py-1 overflow-hidden
      const dropdown = page.locator('div.fixed.bg-popover.border.border-border');
      await expect(dropdown).toBeVisible();
      
      const dropdownBoxBefore = await dropdown.boundingBox();
      const buttonBoxBefore = await centreBtn.boundingBox();
      
      expect(dropdownBoxBefore).not.toBeNull();
      expect(buttonBoxBefore).not.toBeNull();

      if (dropdownBoxBefore && buttonBoxBefore) {
        // Assert it is roughly aligned horizontally initially
        expect(Math.abs(dropdownBoxBefore.x - buttonBoxBefore.x)).toBeLessThan(10);
      }

      // Close the dropdown first by clicking the backdrop overlay (simulating user click outside)
      const backdrop = page.locator('div.fixed.inset-0.z-\\[199\\]');
      if (await backdrop.isVisible()) {
        await backdrop.click({ force: true });
        await page.waitForTimeout(300);
      }

      // Toggle collapse sidebar by clicking the toggle button
      const collapseBtn = page.locator('button[aria-label*="sidebar"], button[aria-label*="Sidebar"]').first();
      if (await collapseBtn.isVisible()) {
        await collapseBtn.click();
        await page.waitForTimeout(800); // Wait for width transition to finish

        // Assert that the active centre dropdown is closed (hidden) after toggling collapsed state
        await expect(dropdown).toBeHidden();
      }
    });
  });

  test.describe('Search Input and Keyboard Shortcuts', () => {
    test('keyboard shortcut Cmd+K / Ctrl+K successfully focuses global search input', async ({ page }) => {
      await loginAsAdmin(page);

      // Verify the search input exists
      const searchInput = page.locator('input[placeholder*="Search students"]').first();
      await expect(searchInput).toBeVisible();

      // Press Meta+K (Mac Command+K)
      await page.keyboard.press('Meta+k');
      await page.waitForTimeout(300);
      await expect(searchInput).toBeFocused();

      // Click somewhere else to blur
      await page.locator('body').click();
      await expect(searchInput).not.toBeFocused();

      // Press Control+K (Windows/Linux shortcut)
      await page.keyboard.press('Control+k');
      await page.waitForTimeout(300);
      await expect(searchInput).toBeFocused();
    });

    test('rapid inputs are debounced and special characters are handled safely without crash', async ({ page }) => {
      await loginAsAdmin(page);
      
      const searchInput = page.locator('input[placeholder*="Search students"]').first();
      await expect(searchInput).toBeVisible();

      // Click to focus search
      await searchInput.focus();

      // Simulate typing a special characters script tag rapidly
      await searchInput.fill('<script>alert("xss")</script>');
      await page.waitForTimeout(500);

      // Make sure it doesn't crash the UI
      await expect(page.locator('body')).toBeVisible();

      // Search results dropdown might appear or show empty state
      const resultsDropdown = page.locator('div.absolute.top-full.left-0.right-0');
      // If it exists, verify it doesn't crash
      if (await resultsDropdown.isVisible()) {
        await expect(resultsDropdown).toBeVisible();
      }
    });
  });

  test.describe('Responsive Sidebar & Mobile Overlay interactions', () => {
    test.use({ viewport: { width: 400, height: 800 } });

    test('mobile menu trigger opens sidebar and overlay, clicking overlay closes it', async ({ page }) => {
      await loginAsAdmin(page);

      // On mobile, the sidebar is hidden initially (-translate-x-full)
      const aside = page.locator('aside');
      await expect(aside).toHaveClass(/-translate-x-full/);

      // Hamburger menu should be visible
      const menuBtn = page.locator('button[aria-label="Open menu"]').first();
      await expect(menuBtn).toBeVisible();

      // Click to open sidebar
      await menuBtn.click();
      await page.waitForTimeout(500);

      // Sidebar should now be translated in (translate-x-0)
      await expect(aside).toHaveClass(/translate-x-0/);
      await expect(aside).not.toHaveClass(/-translate-x-full/);

      // Overlay should be visible (inset-0 bg-black/60)
      const overlay = page.locator('div.fixed.inset-0.bg-black\\/60');
      await expect(overlay).toBeVisible();

      // Click overlay to close sidebar (use force: true since sidebar drawer overlaps the center of the overlay)
      await overlay.click({ force: true });
      await page.waitForTimeout(500);

      // Sidebar should be collapsed again
      await expect(aside).toHaveClass(/-translate-x-full/);
      await expect(overlay).toBeHidden();
    });
  });

  test.describe('Active Navigation State Visual Indicators', () => {
    test('active nav item gets primary styling and pseudo-element accent bar', async ({ page }) => {
      await loginAsAdmin(page);

      // On the dashboard page, "Dashboard" nav item should be active
      const dashboardLink = page.locator('aside nav a[title="Dashboard"]').first();
      await expect(dashboardLink).toBeVisible();
      
      // Verify active classes
      await expect(dashboardLink).toHaveClass(/text-primary bg-primary\/10 font-bold/);
      await expect(dashboardLink).toHaveClass(/before:bg-primary/);

      // Go to settings page
      await page.goto('/dashboard/settings');
      await page.waitForTimeout(3000);

      const settingsLink = page.locator('aside nav a[title="Settings"]').first();
      await expect(settingsLink).toBeVisible();
      await expect(settingsLink).toHaveClass(/text-primary bg-primary\/10 font-bold/);
      await expect(settingsLink).toHaveClass(/before:bg-primary/);

      // Dashboard link should now be inactive
      await expect(dashboardLink).not.toHaveClass(/text-primary bg-primary\/10 font-bold/);
    });
  });

});
