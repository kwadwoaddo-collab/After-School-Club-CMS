import { test, expect } from '@playwright/test';

test.describe('Smoke Tests (Read-Only)', () => {
  
  test('homepage loads successfully', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    // Basic verification it's not a server error
    await expect(page.locator('body')).toBeVisible();
  });

  test('login page loads successfully', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response?.status()).toBe(200);
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  });

  test('booking page loads (public route)', async ({ page }) => {
    const response = await page.goto('/book/test-org');
    // It might be 404 if test-org doesn't exist, so we just check it doesn't 500
    expect(response?.status()).not.toBe(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('parent portal route displays login/magic-link state', async ({ page }) => {
    // Portal usually requires authentication, so it might redirect to /login or show a magic link request form.
    // We just ensure it doesn't 500 crash.
    const response = await page.goto('/portal');
    expect(response?.status() === 200 || response?.status() === 307 || response?.status() === 308).toBeTruthy();
    
    // Depending on logic, it either redirects or shows auth form
    if (page.url().includes('/login')) {
      await expect(page.locator('form')).toBeVisible();
    } else {
      // It might be a magic link request page or unauthenticated state
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('admin protected page redirects or blocks unauthenticated users', async ({ page }) => {
    // Navigating to /dashboard while unauthenticated should redirect to /login or /staff-login
    const response = await page.goto('/dashboard');
    
    // Check if we got redirected to a login page
    expect(page.url()).toMatch(/\/login|\/staff-login/);
    await expect(page.locator('form')).toBeVisible();
  });

  test('404 page behaves correctly', async ({ page }) => {
    const response = await page.goto('/non-existent-route-12345');
    // Next.js usually returns 404
    expect(response?.status()).toBe(404);
    await expect(page.locator('body')).toBeVisible();
  });

});
