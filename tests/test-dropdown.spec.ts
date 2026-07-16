import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = '/Users/kwadwo/.gemini/antigravity-ide/brain/044c3e20-deb8-425f-863b-7a4bdeb0a2ff';

test('test active centre dropdown on live site', async ({ page }) => {
  // Ensure artifacts directory exists
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  console.log('Navigating to live login page...');
  await page.goto('/login');
  
  // Try logging in as kwadwoaddo@googlemail.com first
  console.log('Attempting login with kwadwoaddo@googlemail.com...');
  await page.waitForSelector('input#admin-email');
  await page.fill('input#admin-email', 'kwadwoaddo@googlemail.com');
  await page.fill('input#admin-password', 'password123');
  await page.click('button[type="submit"]');

  // Wait to see if we navigate to dashboard
  try {
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('Login successful with kwadwoaddo@googlemail.com!');
  } catch (err) {
    console.log('Login failed or timed out with kwadwoaddo@googlemail.com, trying admin@example.com...');
    await page.goto('/login');
    await page.waitForSelector('input#admin-email');
    await page.fill('input#admin-email', 'admin@example.com');
    await page.fill('input#admin-password', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log('Login successful with admin@example.com!');
  }

  // Allow dashboard to load completely
  await page.waitForTimeout(3000);

  // Take a screenshot of the main dashboard
  const mainPath = path.join(ARTIFACTS_DIR, 'dashboard_initial.png');
  await page.screenshot({ path: mainPath });
  console.log(`Saved initial dashboard screenshot to ${mainPath}`);

  // Inspect the sidebar structure
  const sidebarHtml = await page.locator('aside').innerHTML();
  console.log('--- Sidebar HTML snippet ---');
  console.log(sidebarHtml.slice(0, 1500)); // Log first 1500 chars of sidebar
  console.log('---------------------------');

  // Check if the centres selector/dropdown is present
  const centreBtn = page.locator('button:has-text("Active Centre"), button:has-text("Combined View")');
  const count = await centreBtn.count();
  console.log(`Found ${count} active centre dropdown buttons.`);

  if (count > 0) {
    console.log('Clicking the Active Centre dropdown button...');
    await centreBtn.first().click();
    await page.waitForTimeout(1000); // wait for transition

    // Take screenshot of opened dropdown
    const openPath = path.join(ARTIFACTS_DIR, 'dashboard_dropdown_open.png');
    await page.screenshot({ path: openPath });
    console.log(`Saved dropdown open screenshot to ${openPath}`);

    // Check if collapsed state is toggleable and how it behaves
    const collapseBtn = page.locator('aside button[aria-label*="sidebar"], aside button[aria-label*="Sidebar"]');
    const collapseCount = await collapseBtn.count();
    console.log(`Found ${collapseCount} sidebar collapse toggle buttons.`);
    if (collapseCount > 0) {
      console.log('Collapsing the sidebar...');
      await collapseBtn.first().click();
      await page.waitForTimeout(1000);

      // Re-trigger dropdown in collapsed state if possible
      const collapsedCentreBtn = page.locator('aside button[title*="View"], aside button[title*="Centre"]');
      if (await collapsedCentreBtn.count() > 0) {
        console.log('Clicking active centre button in collapsed sidebar...');
        await collapsedCentreBtn.first().click();
        await page.waitForTimeout(1000);

        const collapsedOpenPath = path.join(ARTIFACTS_DIR, 'dashboard_collapsed_dropdown_open.png');
        await page.screenshot({ path: collapsedOpenPath });
        console.log(`Saved collapsed dropdown open screenshot to ${collapsedOpenPath}`);
      }
    }
  } else {
    console.log('Active Centre dropdown button was not found. This might mean the user only has access to one centre, so the dropdown is not rendered.');
  }
});
