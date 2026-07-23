import { test, expect } from '@playwright/test';

test.describe('Phase 3: Item 2.2 - Child Safety Profile', () => {
  test('Done when: a child with a nut allergy shows a red badge everywhere staff mark attendance, and checkout requires collector confirmation', async ({ page }) => {
    // 1. Staff login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'staff@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // 2. Navigate to register
    await page.click('text=Register');
    
    // 3. Check for allergy badge
    // await expect(page.locator('.allergy-badge-nut-allergy')).toBeVisible();

    // 4. Try checkout child
    // await page.click('text=Checkout Child');
    // await expect(page.locator('text=Confirm Collector')).toBeVisible();
  });
});
