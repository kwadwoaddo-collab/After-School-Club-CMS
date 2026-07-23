import { test, expect } from '@playwright/test';

test.describe('Phase 5 UI Visual Test', () => {
  // Use a fixed session token if possible, or login
  test('navigate through Incidents, Communications, and Wonde settings', async ({ page, context }) => {
    // Clear cookies to avoid JWTSessionError from previous mock token
    await context.clearCookies();
    
    // Login
    await page.goto('/login');
    await page.waitForSelector('input#admin-email');
    await page.fill('input#admin-email', 'kwadwoaddo@googlemail.com');
    await page.fill('input#admin-password', 'password123');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard to load
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    
    // 1. Incidents
    await page.goto('/dashboard/incidents');
    await expect(page.locator('text=Incident & Accident Records')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: '/Users/kwadwo/.gemini/antigravity/brain/883fe739-5b1d-43e4-b0b2-049fa36eb68c/incidents_page.png', fullPage: true });

    // Open the new incident modal
    await page.click('button:has-text("Log Incident")');
    await expect(page.locator('text=Log New Record')).toBeVisible();
    await page.waitForTimeout(1000); // Let animation finish
    await page.screenshot({ path: '/Users/kwadwo/.gemini/antigravity/brain/883fe739-5b1d-43e4-b0b2-049fa36eb68c/incident_modal.png' });
    // Close the modal
    await page.click('button:has-text("Cancel")');

    // 2. Communications
    await page.goto('/dashboard/communications');
    await expect(page.locator('text=Broadcast Messaging')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Compose Message')).toBeVisible();
    
    // Type in a subject
    await page.fill('input[placeholder="e.g. Important Update: Centre Closure Tomorrow"]', 'Test Broadcast');
    await page.fill('textarea[placeholder="Type your message here..."]', 'This is a test message from Playwright.');
    await page.screenshot({ path: '/Users/kwadwo/.gemini/antigravity/brain/883fe739-5b1d-43e4-b0b2-049fa36eb68c/communications_compose.png' });

    // Click History tab
    await page.click('button:has-text("History & Audit Log")');
    await expect(page.locator('text=Date Sent')).toBeVisible();
    await page.screenshot({ path: '/Users/kwadwo/.gemini/antigravity/brain/883fe739-5b1d-43e4-b0b2-049fa36eb68c/communications_history.png' });

    // 3. Wonde Settings
    await page.goto('/dashboard/settings/wonde');
    await expect(page.locator('text=Wonde MIS Integration')).toBeVisible({ timeout: 15000 });
    
    // Click manual sync
    await page.click('button:has-text("Sync Now")');
    // Verify sync result appears (the mock action returns success)
    await expect(page.locator('text=Sync Completed Successfully')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: '/Users/kwadwo/.gemini/antigravity/brain/883fe739-5b1d-43e4-b0b2-049fa36eb68c/wonde_sync_success.png' });
  });
});
