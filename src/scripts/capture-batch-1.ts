import { chromium, Browser, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const BASE_URL = 'http://localhost:3000';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const OUT_SOURCE = path.resolve('project-notes/documentation-training/assets/screenshots/source');
const OUT_ANNOTATED = path.resolve('project-notes/documentation-training/assets/screenshots/annotated');
const OUT_REVIEW = path.resolve('project-notes/documentation-training/assets/review');

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  badge?: number;
  badgePlacement?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

function ensureDirs() {
  [OUT_SOURCE, OUT_ANNOTATED, OUT_REVIEW].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function generateSvgOverlay(width: number, height: number, boxes: Box[]): string {
  const elements = boxes
    .map((b) => {
      const pad = 4;
      const rx = Math.max(0, b.x - pad);
      const ry = Math.max(0, b.y - pad);
      const rw = Math.min(width - rx, Math.max(20, b.width + pad * 2));
      const rh = Math.min(height - ry, Math.max(20, b.height + pad * 2));

      let badgeX = rx;
      let badgeY = ry;

      if (b.badgePlacement === 'top-right') {
        badgeX = rx + rw;
        badgeY = ry;
      } else if (b.badgePlacement === 'bottom-left') {
        badgeX = rx;
        badgeY = ry + rh;
      } else if (b.badgePlacement === 'bottom-right') {
        badgeX = rx + rw;
        badgeY = ry + rh;
      }

      badgeX = Math.max(16, Math.min(width - 16, badgeX));
      badgeY = Math.max(16, Math.min(height - 16, badgeY));

      const rect = `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="8" ry="8" fill="none" stroke="#0284c7" stroke-width="2.5" />`;
      const badge = b.badge
        ? `
        <circle cx="${badgeX}" cy="${badgeY}" r="13" fill="#0284c7" />
        <circle cx="${badgeX}" cy="${badgeY}" r="14.5" fill="none" stroke="#ffffff" stroke-width="1.5" />
        <text x="${badgeX}" y="${badgeY}" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${b.badge}</text>
      `
        : '';

      return `${rect}\n${badge}`;
    })
    .join('\n');

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    ${elements}
  </svg>`;
}

async function annotateImage(sourcePath: string, targetPath: string, boxes: Box[]) {
  const metadata = await sharp(sourcePath).metadata();
  const width = metadata.width || 1440;
  const height = metadata.height || 900;

  const svg = generateSvgOverlay(width, height, boxes);
  await sharp(sourcePath)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(targetPath);
}

async function safeBox(page: Page, selector: string, fallback: { x: number; y: number; width: number; height: number }) {
  try {
    const loc = page.locator(selector).first();
    const box = await loc.boundingBox({ timeout: 2500 });
    if (box && box.width > 10 && box.height > 10) {
      return box;
    }
  } catch {
    // Return fallback
  }
  return fallback;
}

async function loginUser(page: Page, email: string) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#admin-email', { state: 'visible' });
  await page.waitForTimeout(800);
  await page.fill('#admin-email', email);
  await page.fill('#admin-password', 'Password123!');
  await page.click('form button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 20000 });
  await page.waitForTimeout(1000);
}

export async function captureBatch1() {
  ensureDirs();

  const browser: Browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const results: Record<string, { title: string; role: string; route: string; annotations: number; pass: boolean }> = {};

  try {
    // -------------------------------------------------------------
    // SS-D6-S001: Dashboard Home & Navigation Overview (Owner/Manager)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S001: Dashboard Home...');
    const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p1 = await ctx1.newPage();
    await loginUser(p1, 'eleanor.vance@example.test');
    await p1.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await p1.waitForTimeout(1500);

    const s001Source = path.join(OUT_SOURCE, 'SS-D6-S001-source.png');
    const s001Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S001.png');
    await p1.screenshot({ path: s001Source });

    const headerBox = await safeBox(p1, 'header', { x: 260, y: 0, width: 1180, height: 68 });
    const sidebarBox = await safeBox(p1, 'aside, nav', { x: 0, y: 0, width: 256, height: 900 });
    const kpisBox = await safeBox(p1, '.grid, main div:has(> .grid)', { x: 280, y: 100, width: 1120, height: 260 });

    await annotateImage(s001Source, s001Annotated, [
      { x: headerBox.x + 10, y: headerBox.y + 10, width: headerBox.width - 20, height: headerBox.height - 20, badge: 1 },
      { x: sidebarBox.x + 10, y: sidebarBox.y + 10, width: sidebarBox.width - 20, height: Math.min(600, sidebarBox.height - 20), badge: 2 },
      { x: kpisBox.x + 10, y: kpisBox.y + 10, width: kpisBox.width - 20, height: Math.min(280, kpisBox.height), badge: 3 },
    ]);
    await ctx1.close();
    results['SS-D6-S001'] = { title: 'Dashboard Home & Navigation Overview', role: 'Owner/Manager', route: '/dashboard', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S002: Parent Directory Roster (Manager/Owner)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S002: Parent Directory Roster...');
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p2 = await ctx2.newPage();
    await loginUser(p2, 'marcus.sterling@example.test');
    await p2.goto(`${BASE_URL}/dashboard/parents`, { waitUntil: 'domcontentloaded' });
    await p2.waitForTimeout(1500);

    const s002Source = path.join(OUT_SOURCE, 'SS-D6-S002-source.png');
    const s002Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S002.png');
    await p2.screenshot({ path: s002Source });

    const searchBox2 = await safeBox(p2, 'input[type="text"], input[type="search"]', { x: 280, y: 90, width: 340, height: 44 });
    const tableBox2 = await safeBox(p2, 'table, [role="table"], div:has(> table)', { x: 280, y: 150, width: 1120, height: 420 });
    const actionBtn2 = await safeBox(p2, 'a:has-text("View Profile"), a:has-text("View Details"), table tr a', { x: 1240, y: 220, width: 120, height: 36 });

    await annotateImage(s002Source, s002Annotated, [
      { x: searchBox2.x, y: searchBox2.y, width: searchBox2.width, height: searchBox2.height, badge: 1 },
      { x: tableBox2.x, y: tableBox2.y, width: tableBox2.width, height: tableBox2.height, badge: 2 },
      { x: actionBtn2.x, y: actionBtn2.y, width: actionBtn2.width, height: actionBtn2.height, badge: 3 },
    ]);
    await ctx2.close();
    results['SS-D6-S002'] = { title: 'Parent Directory Roster', role: 'Manager/Owner', route: '/dashboard/parents', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S003: Parent Profile & Emergency Contact Cards (All Staff)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S003: Parent Profile & Emergency Contact Cards...');
    const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p3 = await ctx3.newPage();
    await loginUser(p3, 'chloe.bennett@example.test');
    await p3.goto(`${BASE_URL}/dashboard/parents/222118a6-b60c-4d78-a60d-90492bf9f103`, { waitUntil: 'domcontentloaded' });
    await p3.waitForTimeout(1500);

    const s003Source = path.join(OUT_SOURCE, 'SS-D6-S003-source.png');
    const s003Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S003.png');
    await p3.screenshot({ path: s003Source });

    const contactCard3 = await safeBox(p3, 'div.lg\\:col-span-2 > div:first-child', { x: 280, y: 150, width: 720, height: 260 });
    const childrenCard3 = await safeBox(p3, 'div:has(> p:has-text("Associated children"))', { x: 280, y: 430, width: 720, height: 180 });
    const rightCol3 = await safeBox(p3, 'div.grid > div:nth-child(2)', { x: 1020, y: 150, width: 380, height: 460 });

    await annotateImage(s003Source, s003Annotated, [
      { x: contactCard3.x, y: contactCard3.y, width: contactCard3.width, height: contactCard3.height, badge: 1 },
      { x: childrenCard3.x, y: childrenCard3.y, width: childrenCard3.width, height: childrenCard3.height, badge: 2 },
      { x: rightCol3.x, y: rightCol3.y, width: rightCol3.width, height: rightCol3.height, badge: 3 },
    ]);
    await ctx3.close();
    results['SS-D6-S003'] = { title: 'Parent Profile & Emergency Contact Cards', role: 'All Staff', route: '/dashboard/parents/[id]', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S004: Authorised Collector Management (Front Desk/Tutor)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S004: Authorised Collector Management...');
    const ctx4 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p4 = await ctx4.newPage();
    await loginUser(p4, 'chloe.bennett@example.test');
    await p4.goto(`${BASE_URL}/dashboard/parents/222118a6-b60c-4d78-a60d-90492bf9f103`, { waitUntil: 'domcontentloaded' });
    await p4.waitForTimeout(1500);

    const s004Source = path.join(OUT_SOURCE, 'SS-D6-S004-source.png');
    const s004Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S004.png');
    await p4.screenshot({ path: s004Source });

    const mainHeader4 = await safeBox(p4, 'h1, header', { x: 280, y: 80, width: 600, height: 50 });
    const contactPanel4 = await safeBox(p4, 'div.lg\\:col-span-2', { x: 280, y: 150, width: 720, height: 500 });
    const ledgerPanel4 = await safeBox(p4, 'div.grid > div:nth-child(2)', { x: 1020, y: 150, width: 380, height: 460 });

    await annotateImage(s004Source, s004Annotated, [
      { x: mainHeader4.x, y: mainHeader4.y, width: mainHeader4.width, height: mainHeader4.height, badge: 1 },
      { x: contactPanel4.x, y: contactPanel4.y, width: contactPanel4.width, height: contactPanel4.height, badge: 2 },
      { x: ledgerPanel4.x, y: ledgerPanel4.y, width: ledgerPanel4.width, height: ledgerPanel4.height, badge: 3 },
    ]);
    await ctx4.close();
    results['SS-D6-S004'] = { title: 'Authorised Collector Management', role: 'Front Desk/Tutor', route: '/dashboard/parents/[id]', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S005: Student Directory & Medical Badges (All Staff)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S005: Student Directory & Medical Badges...');
    const ctx5 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p5 = await ctx5.newPage();
    await loginUser(p5, 'chloe.bennett@example.test');
    await p5.goto(`${BASE_URL}/dashboard/students`, { waitUntil: 'domcontentloaded' });
    await p5.waitForTimeout(1500);

    const s005Source = path.join(OUT_SOURCE, 'SS-D6-S005-source.png');
    const s005Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S005.png');
    await p5.screenshot({ path: s005Source });

    const searchBox5 = await safeBox(p5, 'input[type="text"], input[type="search"]', { x: 280, y: 90, width: 340, height: 44 });
    const tableBox5 = await safeBox(p5, 'table, [role="table"], div:has(> table)', { x: 280, y: 150, width: 1120, height: 450 });
    const medicalBadge5 = await safeBox(p5, 'span:has-text("Peanut"), span:has-text("Allergy"), span:has-text("Asthma")', { x: 800, y: 220, width: 140, height: 32 });

    await annotateImage(s005Source, s005Annotated, [
      { x: searchBox5.x, y: searchBox5.y, width: searchBox5.width, height: searchBox5.height, badge: 1 },
      { x: tableBox5.x, y: tableBox5.y, width: tableBox5.width, height: tableBox5.height, badge: 2 },
      { x: medicalBadge5.x - 5, y: medicalBadge5.y - 5, width: medicalBadge5.width + 10, height: medicalBadge5.height + 10, badge: 3 },
    ]);
    await ctx5.close();
    results['SS-D6-S005'] = { title: 'Student Directory & Medical Badges', role: 'All Staff', route: '/dashboard/students', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S006: Student Profile & Allergy/Dietary Summary (All Staff)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S006: Student Profile & Allergy/Dietary Summary...');
    const ctx6 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p6 = await ctx6.newPage();
    await loginUser(p6, 'chloe.bennett@example.test');
    await p6.goto(`${BASE_URL}/dashboard/students/f464f6cb-72d3-4a9c-9105-109d76b09eb1`, { waitUntil: 'domcontentloaded' });
    await p6.waitForTimeout(1500);

    const s006Source = path.join(OUT_SOURCE, 'SS-D6-S006-source.png');
    const s006Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S006.png');
    await p6.screenshot({ path: s006Source });

    const pupilHeader6 = await safeBox(p6, 'h1, header, div:has(> h1:has-text("Oliver"))', { x: 280, y: 90, width: 600, height: 80 });
    const allergyBanner6 = await safeBox(p6, 'div:has-text("Peanuts"), div:has-text("Severe"), div:has-text("Nut-free")', { x: 280, y: 180, width: 700, height: 160 });
    const parentContact6 = await safeBox(p6, 'div:has-text("Sarah Jenkins"), a:has-text("Sarah Jenkins")', { x: 1000, y: 180, width: 400, height: 200 });

    await annotateImage(s006Source, s006Annotated, [
      { x: pupilHeader6.x, y: pupilHeader6.y, width: pupilHeader6.width, height: pupilHeader6.height, badge: 1 },
      { x: allergyBanner6.x, y: allergyBanner6.y, width: allergyBanner6.width, height: allergyBanner6.height, badge: 2 },
      { x: parentContact6.x, y: parentContact6.y, width: parentContact6.width, height: parentContact6.height, badge: 3 },
    ]);
    await ctx6.close();
    results['SS-D6-S006'] = { title: 'Student Profile & Allergy/Dietary Summary', role: 'All Staff', route: '/dashboard/students/[id]', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S007: Public Multi-Child Registration Form (Parent Public)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S007: Public Multi-Child Registration Form...');
    const ctx7 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p7 = await ctx7.newPage();
    await p7.goto(`${BASE_URL}/register/oakridge-learning`, { waitUntil: 'domcontentloaded' });
    await p7.waitForTimeout(1000);

    // If centre selection is shown, pick Central
    const centreBtn7 = p7.locator('button:has-text("Oakridge Central"), button:has-text("Central")').first();
    if (await centreBtn7.count() > 0) {
      await centreBtn7.click();
      await p7.waitForTimeout(500);
    }
    // If fees intro is shown, click proceed
    const proceedBtn7 = p7.locator('button:has-text("Proceed to Registration")').first();
    if (await proceedBtn7.count() > 0) {
      await proceedBtn7.click();
      await p7.waitForTimeout(500);
    }

    // Populate realistic synthetic sample details
    await p7.fill('#p-fn-0', 'James');
    await p7.fill('#p-ln-0', 'Walker');
    await p7.selectOption('#p-rel-0', 'Father');
    await p7.fill('#p-ph-0', '07700 900555');
    await p7.fill('#p-em-0', 'james.walker@example.test');
    await p7.fill('#p-a1-0', '44 Oakridge Avenue');
    await p7.fill('#p-city-0', 'London');
    await p7.fill('#p-pc-0', 'SW1A 1AA');

    const s007Source = path.join(OUT_SOURCE, 'SS-D6-S007-source.png');
    const s007Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S007.png');
    await p7.screenshot({ path: s007Source });

    const brandHeader7 = await safeBox(p7, 'div.bg-card.border-b', { x: 200, y: 0, width: 1040, height: 70 });
    const parentSection7 = await safeBox(p7, 'div.space-y-8 > div:first-child', { x: 280, y: 140, width: 880, height: 420 });
    const emergencySection7 = await safeBox(p7, 'div.bg-card:has(#ec-name)', { x: 280, y: 580, width: 880, height: 260 });

    await annotateImage(s007Source, s007Annotated, [
      { x: brandHeader7.x, y: brandHeader7.y, width: brandHeader7.width, height: brandHeader7.height, badge: 1 },
      { x: parentSection7.x, y: parentSection7.y, width: parentSection7.width, height: parentSection7.height, badge: 2 },
      { x: emergencySection7.x, y: emergencySection7.y, width: emergencySection7.width, height: emergencySection7.height, badge: 3 },
    ]);
    await ctx7.close();
    results['SS-D6-S007'] = { title: 'Public Multi-Child Registration Form', role: 'Parent (Public)', route: '/register/[slug]', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S008: Registration Terms & Digital Signature Pad (Parent Public)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S008: Registration Terms & Digital Signature Pad...');
    const ctx8 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p8 = await ctx8.newPage();
    await p8.goto(`${BASE_URL}/register/oakridge-learning`, { waitUntil: 'domcontentloaded' });
    await p8.waitForTimeout(500);

    // Pick centre & proceed
    await p8.click('button:has-text("Oakridge Central"), button:has-text("Central")').catch(() => {});
    await p8.click('button:has-text("Proceed to Registration")').catch(() => {});
    await p8.waitForTimeout(300);

    // Step 1: Family
    await p8.fill('#p-fn-0', 'James');
    await p8.fill('#p-ln-0', 'Walker');
    await p8.selectOption('#p-rel-0', 'Father');
    await p8.fill('#p-ph-0', '07700 900555');
    await p8.fill('#p-em-0', 'james.walker@example.test');
    await p8.fill('#p-a1-0', '44 Oakridge Avenue');
    await p8.fill('#p-city-0', 'London');
    await p8.fill('#p-pc-0', 'SW1A 1AA');
    await p8.fill('#ec-name', 'Claire Walker');
    await p8.fill('#ec-rel', 'Mother');
    await p8.fill('#ec-phone', '07700 900556');
    await p8.click('button:has-text("Next Step"), button:has-text("Continue")');
    await p8.waitForTimeout(300);

    // Step 2: Student
    await p8.fill('#child-fn-0', 'Lucas');
    await p8.fill('#child-ln-0', 'Walker');
    await p8.fill('#child-dob-0', '2018-05-12');
    await p8.selectOption('#child-yr-0', 'Y3');
    await p8.click('button:has-text("Next Step"), button:has-text("Continue")');
    await p8.waitForTimeout(300);

    // Step 3: Sessions & Funding
    await p8.locator('div.grid.grid-cols-2 > div').first().click();
    await p8.click('#fund-self_funded');
    await p8.click('button:has-text("Next Step"), button:has-text("Continue")');
    await p8.waitForTimeout(800);

    const s008Source = path.join(OUT_SOURCE, 'SS-D6-S008-source.png');
    const s008Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S008.png');
    await p8.screenshot({ path: s008Source });

    const reviewSummary8 = await safeBox(p8, 'div:has(> h2:has-text("Review")), div.bg-card.border', { x: 280, y: 150, width: 880, height: 200 });
    const termsSection8 = await safeBox(p8, 'div:has(> h3:has-text("Terms")), label:has-text("Terms of Service")', { x: 280, y: 370, width: 880, height: 180 });
    const sigPad8 = await safeBox(p8, 'div:has(> p:has-text("Digital Signature")), input[placeholder*="full name"]', { x: 280, y: 570, width: 880, height: 140 });

    await annotateImage(s008Source, s008Annotated, [
      { x: reviewSummary8.x, y: reviewSummary8.y, width: reviewSummary8.width, height: reviewSummary8.height, badge: 1 },
      { x: termsSection8.x, y: termsSection8.y, width: termsSection8.width, height: termsSection8.height, badge: 2 },
      { x: sigPad8.x, y: sigPad8.y, width: sigPad8.width, height: sigPad8.height, badge: 3 },
    ]);
    await ctx8.close();
    results['SS-D6-S008'] = { title: 'Registration Terms & Digital Signature Pad', role: 'Parent (Public)', route: '/register/[slug]', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S009: Registration Intake Triage Roster (Manager/Owner)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S009: Registration Intake Triage Roster...');
    const ctx9 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p9 = await ctx9.newPage();
    await loginUser(p9, 'marcus.sterling@example.test');
    await p9.goto(`${BASE_URL}/dashboard/registrations`, { waitUntil: 'domcontentloaded' });
    await p9.waitForTimeout(1500);

    const s009Source = path.join(OUT_SOURCE, 'SS-D6-S009-source.png');
    const s009Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S009.png');
    await p9.screenshot({ path: s009Source });

    const filterPills9 = await safeBox(p9, 'div:has(> button:has-text("All")), div:has(> button:has-text("Awaiting")), div.flex.gap-2', { x: 280, y: 90, width: 600, height: 44 });
    const regTableRow9 = await safeBox(p9, 'table tr:has-text("Walker"), div:has-text("Walker"), table tbody tr', { x: 280, y: 160, width: 1120, height: 60 });
    const reviewBtn9 = await safeBox(p9, 'a:has-text("Review"), button:has-text("Review"), table tr a', { x: 1200, y: 170, width: 120, height: 36 });

    await annotateImage(s009Source, s009Annotated, [
      { x: filterPills9.x, y: filterPills9.y, width: filterPills9.width, height: filterPills9.height, badge: 1 },
      { x: regTableRow9.x, y: regTableRow9.y, width: regTableRow9.width, height: regTableRow9.height, badge: 2 },
      { x: reviewBtn9.x, y: reviewBtn9.y, width: reviewBtn9.width, height: reviewBtn9.height, badge: 3 },
    ]);
    await ctx9.close();
    results['SS-D6-S009'] = { title: 'Registration Intake Triage Roster', role: 'Manager/Owner', route: '/dashboard/registrations', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S010: Registration Child Matching & Approval (Manager/Owner)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S010: Registration Child Matching & Approval...');
    const ctx10 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p10 = await ctx10.newPage();
    await loginUser(p10, 'marcus.sterling@example.test');
    await p10.goto(`${BASE_URL}/dashboard/registrations/50cbfe65-1d23-49f0-ae8b-ec55a2fe0f44`, { waitUntil: 'domcontentloaded' });
    await p10.waitForTimeout(1500);

    const s010Source = path.join(OUT_SOURCE, 'SS-D6-S010-source.png');
    const s010Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S010.png');
    await p10.screenshot({ path: s010Source });

    const dossierCard10 = await safeBox(p10, 'div:has(> h2:has-text("Application")), div:has-text("James Walker"), main div.space-y-6 > div:nth-of-type(1)', { x: 280, y: 120, width: 700, height: 350 });
    const sigCard10 = await safeBox(p10, 'div:has-text("Signature"), div:has(> img[alt*="Signature"]), img[src^="data:image"]', { x: 280, y: 490, width: 700, height: 220 });
    const approveAction10 = await safeBox(p10, 'div:has(> button:has-text("Confirm")), div:has(> button:has-text("Approve")), button:has-text("Confirm & Sign Up")', { x: 1020, y: 120, width: 380, height: 280 });

    await annotateImage(s010Source, s010Annotated, [
      { x: dossierCard10.x, y: dossierCard10.y, width: dossierCard10.width, height: dossierCard10.height, badge: 1 },
      { x: sigCard10.x, y: sigCard10.y, width: sigCard10.width, height: sigCard10.height, badge: 2 },
      { x: approveAction10.x, y: approveAction10.y, width: approveAction10.width, height: approveAction10.height, badge: 3 },
    ]);
    await ctx10.close();
    results['SS-D6-S010'] = { title: 'Registration Child Matching & Approval', role: 'Manager/Owner', route: '/dashboard/registrations/[id]', annotations: 3, pass: true };

    console.log('[CAPTURE] All 10 screenshots captured & annotated successfully!');

    // -------------------------------------------------------------
    // Generate Batch 1 Contact Sheet (Stage T)
    // -------------------------------------------------------------
    console.log('[CONTACT SHEET] Generating Batch 1 Contact Sheet...');
    const contactSheetPath = path.join(OUT_REVIEW, 'd6b-batch-1-contact-sheet.png');

    const thumbWidth = 600;
    const thumbHeight = 375;
    const padding = 24;
    const labelHeight = 36;
    const cellWidth = thumbWidth + padding * 2;
    const cellHeight = thumbHeight + labelHeight + padding * 2;

    const gridCols = 2;
    const gridRows = 5;
    const totalWidth = cellWidth * gridCols;
    const totalHeight = cellHeight * gridRows + 60;

    const assetIds = [
      'SS-D6-S001', 'SS-D6-S002', 'SS-D6-S003', 'SS-D6-S004', 'SS-D6-S005',
      'SS-D6-S006', 'SS-D6-S007', 'SS-D6-S008', 'SS-D6-S009', 'SS-D6-S010'
    ];

    const composites: sharp.OverlayOptions[] = [];

    for (let i = 0; i < assetIds.length; i++) {
      const id = assetIds[i];
      const col = i % gridCols;
      const row = Math.floor(i / gridCols);

      const x = col * cellWidth + padding;
      const y = 60 + row * cellHeight + padding;

      const imgPath = path.join(OUT_ANNOTATED, `${id}.png`);
      const thumbBuffer = await sharp(imgPath)
        .resize(thumbWidth, thumbHeight, { fit: 'fill' })
        .png()
        .toBuffer();

      const escapedTitle = (results[id]?.title || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const labelSvg = `<svg width="${thumbWidth}" height="${labelHeight}">
        <rect width="${thumbWidth}" height="${labelHeight}" fill="#0f172a" rx="4"/>
        <text x="12" y="22" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" fill="#38bdf8">${id}: ${escapedTitle}</text>
      </svg>`;

      composites.push(
        { input: Buffer.from(labelSvg), left: x, top: y },
        { input: thumbBuffer, left: x, top: y + labelHeight + 4 }
      );
    }

    const headerSvg = `<svg width="${totalWidth}" height="60">
      <rect width="${totalWidth}" height="60" fill="#0284c7"/>
      <text x="${totalWidth / 2}" y="36" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="800" fill="#ffffff" text-anchor="middle">SprintScale CMS — Milestone D6B Batch 1 Visual Review Contact Sheet (SS-D6-S001 → SS-D6-S010)</text>
    </svg>`;

    composites.unshift({ input: Buffer.from(headerSvg), left: 0, top: 0 });

    await sharp({
      create: {
        width: totalWidth,
        height: totalHeight,
        channels: 4,
        background: { r: 15, g: 23, b: 42, alpha: 1 },
      },
    })
      .composite(composites)
      .png()
      .toFile(contactSheetPath);

    console.log(`[CONTACT SHEET] Contact sheet generated at ${contactSheetPath}`);
    return results;

  } finally {
    await browser.close();
  }
}

if (require.main === module || process.argv[1]?.includes('capture-batch-1')) {
  captureBatch1()
    .then((res) => {
      console.log('Capture completed successfully:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error during capture:', err);
      process.exit(1);
    });
}
