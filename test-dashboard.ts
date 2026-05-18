import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to login...');
    await page.goto('http://localhost:3000/login');
    
    console.log('Filling credentials...');
    await page.fill('input[type="email"]', 'kwadwoaddo@googlemail.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    console.log('Waiting for navigation to dashboard...');
    await page.waitForURL('**/dashboard**', { timeout: 10000 });
    
    console.log('Checking /dashboard status...');
    const dashboardTitle = await page.title();
    console.log('Dashboard Title:', dashboardTitle);
    
    const h1 = await page.locator('h1').first().textContent();
    console.log('Dashboard H1:', h1);

    if (!h1 || h1.includes('500') || h1.includes('Application error')) {
      throw new Error('Dashboard crashed!');
    }

    console.log('Navigating to /dashboard/finance...');
    await page.goto('http://localhost:3000/dashboard/finance');
    
    const financeTitle = await page.title();
    console.log('Finance Title:', financeTitle);

    const financeH1 = await page.locator('h1').first().textContent();
    console.log('Finance H1:', financeH1);

    if (!financeH1 || financeH1.includes('500') || financeH1.includes('Application error')) {
      throw new Error('Finance Dashboard crashed!');
    }

    console.log('✅ All tests passed! No crashes detected.');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
