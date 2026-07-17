import { test, expect } from '@playwright/test';

// ⚠️  SAFETY GUARD: This test submits real booking forms into the database.
// It must ONLY run against a dedicated test/staging environment.
// To enable: set E2E_BASE_URL env var to your staging URL (not production).
const isTestEnv = !!(process.env.E2E_BASE_URL && !process.env.E2E_BASE_URL.includes('production'));
test.skip(!isTestEnv, 'Skipped on production — set E2E_BASE_URL to a staging URL to enable this test');

test('E2E booking flow for child with multiple custom subjects', async ({ page }) => {
  // Navigate to Dagenham booking portal
  const url = '/book/sydenham-after-school-club-ltd/dagenham-after-school-club-okt16';
  console.log(`Navigating to: ${url}`);
  await page.goto(url);
  await page.waitForTimeout(5000);
  // Step 1: Parent Details
  console.log('Step 1: Filling Parent Details');
  await page.fill('input[placeholder="Enter first name"]', 'Jane');
  await page.fill('input[placeholder="Enter last name"]', 'Doe');
  await page.fill('input[placeholder="email@example.com"]', `jane.e2e.${Date.now()}@example.com`);
  await page.fill('input[placeholder="07xxx xxxxxx"]', '07700900077');
  
  // Select preferred contact (e.g., Email)
  await page.click('text="Email"');
  await page.click('text="Continue →"');
  
  // Step 2: Child Details
  console.log('Step 2: Filling Child Details');
  await page.fill('input[placeholder="Child\'s first name"]', 'Alpha');
  await page.fill('input[placeholder="Child\'s last name"]', 'Balde');
  await page.selectOption('select', { label: 'Y1' });
  
  // Click multiple subjects
  console.log('Selecting Science & Tech and Homework Help');
  await page.click('text="Science & Tech"');
  await page.click('text="Homework Help"');
  await page.fill('textarea', 'E2E Testing unique constraints');
  await page.click('text="Continue →"');
  
  // Step 3: Choose Appointment
  console.log('Step 3: Choosing Appointment');
  // Find next Wednesday in the future to ensure the club is open
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + ((3 + 7 - targetDate.getDay()) % 7 || 7)); // Next Wednesday
  const dateStr = targetDate.toISOString().split('T')[0];
  console.log(`Selecting date: ${dateStr}`);
  
  await page.fill('input[type="date"]', dateStr);
  await page.fill('input[type="time"]', '16:00');
  await page.click('text="Continue →"');
  
  // Step 4: Confirm Booking
  console.log('Step 4: Confirming Booking');
  // Wait for consent checkbox to be visible
  await page.waitForSelector('input[name="consent.communications"]', { timeout: 15000 });
  // Click consent checkbox
  await page.locator('input[name="consent.communications"]').check();
  
  // Click Confirm Booking
  await page.click('button:has-text("Confirm Booking")');
  
  // Verification
  console.log('Verifying booking success');
  
  // We expect a confirmation message to load and the loading state to complete
  const successHeader = page.locator('h2:has-text("Booking Confirmed!")');
  try {
    await successHeader.waitFor({ state: 'visible', timeout: 20000 });
  } catch (e) {
    console.log('Success header did not appear in 20 seconds');
  }
  
  const isSuccess = await successHeader.isVisible();
  
  // Ensure no error toast is showing
  const errorToast = page.locator('text="Failed to create booking"');
  const hasError = await errorToast.isVisible();
  
  console.log(`Booking result - Success: ${isSuccess}, Error showing: ${hasError}`);
  
  if (hasError) {
    const errorText = await page.locator('.hot-toast-message').textContent();
    console.error('Error Toast Text:', errorText);
  }
  
  expect(hasError).toBeFalsy();
  expect(isSuccess).toBeTruthy();
});
