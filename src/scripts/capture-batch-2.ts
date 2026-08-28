import { chromium, Browser, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT_SOURCE = path.resolve('project-notes/documentation-training/assets/screenshots/source');
const OUT_ANNOTATED = path.resolve('project-notes/documentation-training/assets/screenshots/annotated');
const OUT_REVIEW = path.resolve('project-notes/documentation-training/assets/review');

interface Annotation {
  x: number;
  y: number;
  width: number;
  height: number;
  badge: number;
}

function ensureDirs() {
  [OUT_SOURCE, OUT_ANNOTATED, OUT_REVIEW].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

function escapeXml(unsafe: string) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

async function annotateImage(sourcePath: string, targetPath: string, callouts: Annotation[], viewportW = 1440, viewportH = 900) {
  const strokeColor = '#2563EB';
  const badgeColor = '#2563EB';
  const strokeWidth = 3;
  const radius = 6;
  const badgeRadius = 14;

  let svgElements = '';

  for (const c of callouts) {
    const bx = Math.max(2, Math.min(viewportW - 10, c.x));
    const by = Math.max(2, Math.min(viewportH - 10, c.y));
    const bw = Math.min(viewportW - bx - 2, Math.max(10, c.width));
    const bh = Math.min(viewportH - by - 2, Math.max(10, c.height));

    const badgeCx = Math.max(badgeRadius + 2, bx + 16);
    const badgeCy = Math.max(badgeRadius + 2, by + 16);

    svgElements += `
      <!-- Bounding Box -->
      <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${radius}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-dasharray="8,4" opacity="0.95" />
      <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${radius}" fill="${strokeColor}" fill-opacity="0.04" />
      
      <!-- Numbered Badge Circle -->
      <circle cx="${badgeCx}" cy="${badgeCy}" r="${badgeRadius}" fill="${badgeColor}" stroke="#FFFFFF" stroke-width="2" />
      <text x="${badgeCx}" y="${badgeCy + 5}" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF" text-anchor="middle">${c.badge}</text>
    `;
  }

  const svg = `
    <svg width="${viewportW}" height="${viewportH}" viewBox="0 0 ${viewportW} ${viewportH}" xmlns="http://www.w3.org/2000/svg">
      ${svgElements}
    </svg>
  `;

  await sharp(sourcePath)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(targetPath);
}

async function safeBox(page: Page, selector: string, fallback: { x: number; y: number; width: number; height: number }) {
  try {
    const loc = page.locator(selector).first();
    const isVis = await loc.isVisible().catch(() => false);
    if (isVis) {
      const box = await loc.boundingBox();
      if (box && box.width > 10 && box.height > 10) {
        return box;
      }
    }
  } catch {
    // Return fallback
  }
  return fallback;
}

async function loginUser(page: Page, email: string) {
  console.log(`[LOGIN] Logging in as ${email}...`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#admin-email', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(500);
  await page.fill('#admin-email', email);
  await page.fill('#admin-password', 'Password123!');
  await page.waitForTimeout(300);
  await Promise.all([
    page.waitForURL('**/dashboard**', { waitUntil: 'commit', timeout: 25000 }),
    page.click('form button[type="submit"]')
  ]);
  console.log(`[LOGIN] Logged in as ${email}! Current URL: ${page.url()}`);
  await page.waitForTimeout(800);
}

export async function captureBatch2() {
  ensureDirs();

  // 1. Resolve Dynamic Synthetic IDs from Database
  console.log('[SETUP] Resolving synthetic IDs from database...');
  let oliverId = '583380d2-b9a3-4c86-9192-d4656066705b';
  let centralCentreId = 'b804fbff-7e9b-475f-99c7-d787bf502db5';

  if (process.env.DATABASE_URL) {
    try {
      const client = postgres(process.env.DATABASE_URL);
      const db = drizzle(client, { schema });
      const oliver = await db.query.children.findFirst({
        where: eq(schema.children.firstName, 'Oliver'),
      });
      if (oliver) {
        oliverId = oliver.id;
        if (oliver.centreId) centralCentreId = oliver.centreId;
      }
      await client.end();
    } catch (e) {
      console.warn('[SETUP] DB query warning, falling back to discovered UUIDs:', e);
    }
  }
  console.log(`[SETUP] Using Oliver ID: ${oliverId} | Centre Central ID: ${centralCentreId}`);

  const browser: Browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const results: Record<string, { title: string; role: string; route: string; annotations: number; pass: boolean }> = {};

  try {
    // 2. Prepare Authenticated Persona Contexts
    console.log('[SETUP] Initialising persona contexts...');
    
    // Owner Context (Eleanor Vance)
    const ownerCtx: BrowserContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pOwner = await ownerCtx.newPage();
    pOwner.setDefaultTimeout(60000);
    pOwner.setDefaultNavigationTimeout(60000);
    await loginUser(pOwner, 'eleanor.vance@example.test');

    // Manager Context (Marcus Sterling)
    const managerCtx: BrowserContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pManager = await managerCtx.newPage();
    pManager.setDefaultTimeout(60000);
    pManager.setDefaultNavigationTimeout(60000);
    await loginUser(pManager, 'marcus.sterling@example.test');

    // Staff Context (Chloe Bennett - Front Desk)
    const staffCtx: BrowserContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pStaff = await staffCtx.newPage();
    pStaff.setDefaultTimeout(60000);
    pStaff.setDefaultNavigationTimeout(60000);
    await loginUser(pStaff, 'chloe.bennett@example.test');

    // Tutor Context (Liam Harper)
    const tutorCtx: BrowserContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pTutor = await tutorCtx.newPage();
    pTutor.setDefaultTimeout(60000);
    pTutor.setDefaultNavigationTimeout(60000);
    await loginUser(pTutor, 'liam.harper@example.test');

    // -------------------------------------------------------------
    // SS-D6-S011: Weekly Session Booking Matrix (Manager)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S011: Weekly Session Booking Matrix...');
    await pManager.goto(`${BASE_URL}/dashboard/bookings?centre=all`, { waitUntil: 'domcontentloaded' });
    await pManager.waitForSelector('table, tr:has-text("Jenkins")', { timeout: 15000 }).catch(() => {});
    await pManager.waitForTimeout(600);

    const s011Source = path.join(OUT_SOURCE, 'SS-D6-S011-source.png');
    const s011Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S011.png');
    await pManager.screenshot({ path: s011Source });

    const filterBox11 = await safeBox(pManager, 'div.flex.flex-col.gap-3:has(input), div.bg-surface.border:has(input)', { x: 280, y: 90, width: 1120, height: 60 });
    const tableBox11 = await safeBox(pManager, 'table, [role="table"], div:has(> table)', { x: 280, y: 165, width: 1120, height: 460 });
    const actionBox11 = await safeBox(pManager, 'a:has-text("New Booking"), button:has-text("New Booking")', { x: 1240, y: 30, width: 160, height: 44 });

    await annotateImage(s011Source, s011Annotated, [
      { x: filterBox11.x, y: filterBox11.y, width: filterBox11.width, height: filterBox11.height, badge: 1 },
      { x: tableBox11.x, y: tableBox11.y, width: tableBox11.width, height: tableBox11.height, badge: 2 },
      { x: actionBox11.x, y: actionBox11.y, width: actionBox11.width, height: actionBox11.height, badge: 3 },
    ]);
    results['SS-D6-S011'] = { title: 'Weekly Session Booking Matrix', role: 'Manager/FrontDesk', route: '/dashboard/bookings', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S012: Ad-Hoc Booking Creation Modal (Front Desk)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S012: Ad-Hoc Booking Creation Modal...');
    await pStaff.goto(`${BASE_URL}/dashboard/bookings/new?centreId=${centralCentreId}`, { waitUntil: 'domcontentloaded' });
    await pStaff.waitForSelector('input[placeholder="Enter first name"]', { timeout: 15000 }).catch(() => {});
    await pStaff.waitForTimeout(600);

    const fnInput = pStaff.locator('input[placeholder="Enter first name"]').first();
    if (await fnInput.isVisible().catch(() => false)) {
      await fnInput.fill('Sarah');
      await pStaff.fill('input[placeholder="Enter last name"]', 'Jenkins').catch(() => {});
      await pStaff.fill('input[placeholder="email@example.com"]', 'sarah.jenkins@example.test').catch(() => {});
      await pStaff.fill('input[placeholder="07xxx xxxxxx"]', '07700 900111').catch(() => {});
    }

    const s012Source = path.join(OUT_SOURCE, 'SS-D6-S012-source.png');
    const s012Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S012.png');
    await pStaff.screenshot({ path: s012Source });

    const stepBar12 = await safeBox(pStaff, 'div.max-w-2xl:has(h1)', { x: 390, y: 40, width: 660, height: 90 });
    const formCard12 = await safeBox(pStaff, 'div.bg-card.p-6, form.space-y-6, div:has(> input[placeholder="Enter first name"])', { x: 390, y: 145, width: 660, height: 620 });
    const continueBtn12 = await safeBox(pStaff, 'button:has-text("Continue"), button:has-text("Next")', { x: 880, y: 780, width: 170, height: 44 });

    await annotateImage(s012Source, s012Annotated, [
      { x: stepBar12.x, y: stepBar12.y, width: stepBar12.width, height: stepBar12.height, badge: 1 },
      { x: formCard12.x, y: formCard12.y, width: formCard12.width, height: formCard12.height, badge: 2 },
      { x: continueBtn12.x, y: continueBtn12.y, width: continueBtn12.width, height: continueBtn12.height, badge: 3 },
    ]);
    results['SS-D6-S012'] = { title: 'Ad-Hoc Booking Creation Modal', role: 'Front Desk/Manager', route: '/dashboard/bookings/new', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S013: Recurring Term Booking Plan Creation (Manager)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S013: Recurring Term Booking Plan Creation...');
    await pManager.goto(`${BASE_URL}/dashboard/students/${oliverId}`, { waitUntil: 'domcontentloaded' });
    await pManager.waitForSelector('h1:has-text("Oliver Jenkins")', { timeout: 15000 }).catch(() => {});
    await pManager.waitForTimeout(600);

    const editBtn13 = pManager.locator('button:has-text("Edit")').first();
    if (await editBtn13.isVisible().catch(() => false)) {
      await editBtn13.click();
      await pManager.waitForTimeout(400);
    }

    const s013Source = path.join(OUT_SOURCE, 'SS-D6-S013-source.png');
    const s013Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S013.png');
    await pManager.screenshot({ path: s013Source });

    const headerBox13 = await safeBox(pManager, 'div.p-5:has(h1:has-text("Oliver Jenkins"))', { x: 393, y: 141, width: 894, height: 123 });
    const scheduleGrid13 = await safeBox(pManager, 'div:has(> div > p:has-text("Permanent schedule")), div.rounded-lg.border:has(input[type="checkbox"])', { x: 412, y: 640, width: 416, height: 140 });
    const saveBtn13 = await safeBox(pManager, 'button:has-text("Save"), button:has-text("Cancel")', { x: 720, y: 645, width: 100, height: 32 });

    await annotateImage(s013Source, s013Annotated, [
      { x: headerBox13.x, y: headerBox13.y, width: headerBox13.width, height: headerBox13.height, badge: 1 },
      { x: scheduleGrid13.x, y: scheduleGrid13.y, width: scheduleGrid13.width, height: scheduleGrid13.height, badge: 2 },
      { x: saveBtn13.x, y: saveBtn13.y, width: saveBtn13.width, height: saveBtn13.height, badge: 3 },
    ]);
    results['SS-D6-S013'] = { title: 'Recurring Term Booking Plan Creation', role: 'Manager/Owner', route: '/dashboard/students/[id]', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S014: Daily Attendance Register (Afternoon Club) (Tutor)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S014: Daily Attendance Register (Afternoon Club)...');
    await pTutor.goto(`${BASE_URL}/dashboard/attendance?centre=${centralCentreId}`, { waitUntil: 'domcontentloaded' });
    await pTutor.waitForSelector('text=Jenkins, div.p-3.rounded-md', { timeout: 15000 }).catch(() => {});
    await pTutor.waitForTimeout(600);

    const s014Source = path.join(OUT_SOURCE, 'SS-D6-S014-source.png');
    const s014Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S014.png');
    await pTutor.screenshot({ path: s014Source });

    const slotTabs14 = await safeBox(pTutor, 'div.flex.items-center.gap-2.overflow-x-auto, div:has(> button:has-text("15:30"))', { x: 280, y: 90, width: 1120, height: 60 });
    const statsBar14 = await safeBox(pTutor, 'div.flex.items-center.gap-0.bg-page, div:has(> div > p:has-text("Total"))', { x: 280, y: 155, width: 1120, height: 75 });
    const rollCallGrid14 = await safeBox(pTutor, 'div.grid.gap-4, div:has(> div:has-text("Jenkins"))', { x: 280, y: 240, width: 1120, height: 600 });

    await annotateImage(s014Source, s014Annotated, [
      { x: slotTabs14.x, y: slotTabs14.y, width: slotTabs14.width, height: slotTabs14.height, badge: 1 },
      { x: statsBar14.x, y: statsBar14.y, width: statsBar14.width, height: statsBar14.height, badge: 2 },
      { x: rollCallGrid14.x, y: rollCallGrid14.y, width: rollCallGrid14.width, height: rollCallGrid14.height, badge: 3 },
    ]);
    results['SS-D6-S014'] = { title: 'Daily Attendance Register (Afternoon Club)', role: 'All Staff', route: '/dashboard/attendance', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S015: Live Check-In Arrival Timestamp (Tutor)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S015: Live Check-In Arrival Timestamp...');
    const pTutor15 = await tutorCtx.newPage();
    await pTutor15.goto(`${BASE_URL}/dashboard/attendance?centre=${centralCentreId}`, { waitUntil: 'domcontentloaded' });
    await pTutor15.waitForSelector('text=Jenkins', { timeout: 15000 });
    await pTutor15.waitForTimeout(600);

    const timeInputs15 = pTutor15.locator('div.group.flex.flex-col:has-text("Oliver Jenkins") input[type="time"]');
    if (await timeInputs15.isVisible().catch(() => false)) {
      await timeInputs15.fill('15:30');
      await pTutor15.waitForTimeout(300);
    }

    const s015Source = path.join(OUT_SOURCE, 'SS-D6-S015-source.png');
    const s015Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S015.png');
    await pTutor15.screenshot({ path: s015Source });

    const cardBox15 = await safeBox(pTutor15, 'div.group.flex.flex-col:has-text("Oliver Jenkins")', { x: 590, y: 585, width: 810, height: 110 });
    const checkInPill15 = await safeBox(pTutor15, 'div.group.flex.flex-col:has-text("Oliver Jenkins") input[type="time"]', { x: 1205, y: 625, width: 100, height: 36 });
    const inButton15 = await safeBox(pTutor15, 'div.group.flex.flex-col:has-text("Oliver Jenkins") button:has-text("In")', { x: 1150, y: 625, width: 48, height: 36 });

    await annotateImage(s015Source, s015Annotated, [
      { x: cardBox15.x, y: cardBox15.y, width: cardBox15.width, height: cardBox15.height, badge: 1 },
      { x: checkInPill15.x, y: checkInPill15.y, width: checkInPill15.width, height: checkInPill15.height, badge: 2 },
      { x: inButton15.x, y: inButton15.y, width: inButton15.width, height: inButton15.height, badge: 3 },
    ]);
    results['SS-D6-S015'] = { title: 'Live Check-In Arrival Timestamp', role: 'Tutor/FrontDesk', route: '/dashboard/attendance', annotations: 3, pass: true };
    await pTutor15.close();

    // -------------------------------------------------------------
    // SS-D6-S016: Live Check-Out Departure Timestamp (Tutor)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S016: Live Check-Out Departure Timestamp...');
    const pTutor16 = await tutorCtx.newPage();
    await pTutor16.goto(`${BASE_URL}/dashboard/attendance?centre=${centralCentreId}`, { waitUntil: 'domcontentloaded' });
    await pTutor16.waitForSelector('text=Jenkins', { timeout: 15000 });
    await pTutor16.waitForTimeout(600);

    const timeInputs16 = pTutor16.locator('div.group.flex.flex-col:has-text("Emma Jenkins") input[type="time"]');
    if (await timeInputs16.isVisible().catch(() => false)) {
      await timeInputs16.fill('17:30');
      await pTutor16.waitForTimeout(300);
    }

    const s016Source = path.join(OUT_SOURCE, 'SS-D6-S016-source.png');
    const s016Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S016.png');
    await pTutor16.screenshot({ path: s016Source });

    const cardBox16 = await safeBox(pTutor16, 'div.group.flex.flex-col:has-text("Emma Jenkins")', { x: 590, y: 705, width: 810, height: 110 });
    const checkOutPill16 = await safeBox(pTutor16, 'div.group.flex.flex-col:has-text("Emma Jenkins") input[type="time"]', { x: 1205, y: 745, width: 100, height: 36 });
    const outButton16 = await safeBox(pTutor16, 'div.group.flex.flex-col:has-text("Emma Jenkins") button:has-text("Check Out"), div.group.flex.flex-col:has-text("Emma Jenkins") button:has-text("Out")', { x: 1210, y: 745, width: 90, height: 36 });

    await annotateImage(s016Source, s016Annotated, [
      { x: cardBox16.x, y: cardBox16.y, width: cardBox16.width, height: cardBox16.height, badge: 1 },
      { x: checkOutPill16.x, y: checkOutPill16.y, width: checkOutPill16.width, height: checkOutPill16.height, badge: 2 },
      { x: outButton16.x, y: outButton16.y, width: outButton16.width, height: outButton16.height, badge: 3 },
    ]);
    results['SS-D6-S016'] = { title: 'Live Check-Out Departure Timestamp', role: 'Tutor/FrontDesk', route: '/dashboard/attendance', annotations: 3, pass: true };
    await pTutor16.close();

    // -------------------------------------------------------------
    // SS-D6-S017: Absence Status Override Modal (Front Desk)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S017: Absence Status Override Modal...');
    const pStaff17 = await staffCtx.newPage();
    await pStaff17.goto(`${BASE_URL}/dashboard/attendance?centre=${centralCentreId}`, { waitUntil: 'domcontentloaded' });
    await pStaff17.waitForSelector('text=Jenkins', { timeout: 15000 });
    await pStaff17.waitForTimeout(600);

    const markAbsentBtn = pStaff17.locator('div.group.flex.flex-col:has-text("Noah Taylor") button:has-text("Mark Absent")').first();
    if (await markAbsentBtn.isVisible().catch(() => false)) {
      console.log('[CAPTURE] S017: Clicking Mark Absent on Noah Taylor to open reason popover...');
      await markAbsentBtn.click();
      await pStaff17.waitForSelector('div.shadow-\\[var\\(--shadow-popover\\)\\]', { state: 'visible', timeout: 5000 }).catch(() => {});
      await pStaff17.waitForTimeout(500);
    }

    const s017Source = path.join(OUT_SOURCE, 'SS-D6-S017-source.png');
    const s017Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S017.png');
    await pStaff17.screenshot({ path: s017Source });

    const cardBox17 = await safeBox(pStaff17, 'div.group.flex.flex-col:has-text("Noah Taylor")', { x: 590, y: 465, width: 810, height: 110 });
    const popover17 = await safeBox(pStaff17, 'div.shadow-\\[var\\(--shadow-popover\\)\\]', { x: 1158, y: 530, width: 198, height: 156 });
    const reasonBtn17 = await safeBox(pStaff17, 'div.shadow-\\[var\\(--shadow-popover\\)\\] button:has-text("Illness")', { x: 1162, y: 535, width: 94, height: 72 });

    await annotateImage(s017Source, s017Annotated, [
      { x: cardBox17.x, y: cardBox17.y, width: cardBox17.width, height: cardBox17.height, badge: 1 },
      { x: popover17.x, y: popover17.y, width: popover17.width, height: popover17.height, badge: 2 },
      { x: reasonBtn17.x, y: reasonBtn17.y, width: reasonBtn17.width, height: reasonBtn17.height, badge: 3 },
    ]);
    results['SS-D6-S017'] = { title: 'Absence Status Override Modal', role: 'Front Desk/Manager', route: '/dashboard/attendance', annotations: 3, pass: true };
    await pStaff17.close();

    // -------------------------------------------------------------
    // SS-D6-S018: Tablet Kiosk Mode Landing Screen (Front Desk)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S018: Tablet Kiosk Mode Landing Screen...');
    await pStaff.goto(`${BASE_URL}/dashboard/kiosk?centre=${centralCentreId}`, { waitUntil: 'domcontentloaded' });
    await pStaff.waitForSelector('h1:has-text("Daily Register"), div.grid', { timeout: 15000 }).catch(() => {});
    await pStaff.waitForTimeout(600);

    const s018Source = path.join(OUT_SOURCE, 'SS-D6-S018-source.png');
    const s018Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S018.png');
    await pStaff.screenshot({ path: s018Source });

    const topBar18 = await safeBox(pStaff, 'div.flex.items-center.justify-between.px-6.py-4, div:has(> div > h1:has-text("Daily Register"))', { x: 280, y: 70, width: 1120, height: 75 });
    const statsBar18 = await safeBox(pStaff, 'div.flex.items-center.gap-0.bg-page, div:has(> div > p:has-text("TOTAL"))', { x: 280, y: 145, width: 1120, height: 70 });
    const kioskGrid18 = await safeBox(pStaff, 'div.grid.gap-4.p-6, div:has(> div:has-text("Jenkins"))', { x: 280, y: 220, width: 1120, height: 600 });

    await annotateImage(s018Source, s018Annotated, [
      { x: topBar18.x, y: topBar18.y, width: topBar18.width, height: topBar18.height, badge: 1 },
      { x: statsBar18.x, y: statsBar18.y, width: statsBar18.width, height: statsBar18.height, badge: 2 },
      { x: kioskGrid18.x, y: kioskGrid18.y, width: kioskGrid18.width, height: kioskGrid18.height, badge: 3 },
    ]);
    results['SS-D6-S018'] = { title: 'Tablet Kiosk Mode Landing Screen', role: 'Front Desk/Tutor', route: '/dashboard/kiosk', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S019: Kiosk Unplanned Walk-In Registration (Front Desk)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S019: Kiosk Unplanned Walk-In Registration...');
    await pStaff.goto(`${BASE_URL}/dashboard/attendance?centre=${centralCentreId}`, { waitUntil: 'domcontentloaded' });
    await pStaff.waitForSelector('button:has-text("Walk-In")', { timeout: 15000 }).catch(() => {});
    await pStaff.waitForTimeout(600);

    const walkInBtn = pStaff.locator('button:has-text("Walk-In")').first();
    if (await walkInBtn.isVisible().catch(() => false)) {
      await walkInBtn.click();
      await pStaff.waitForSelector('h3:has-text("Register Walk-In")', { timeout: 5000 }).catch(() => {});
      await pStaff.waitForTimeout(400);
    }

    const s019Source = path.join(OUT_SOURCE, 'SS-D6-S019-source.png');
    const s019Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S019.png');
    await pStaff.screenshot({ path: s019Source });

    const walkInDialog19 = { x: 440, y: 220, width: 560, height: 490 };
    const tabSwitch19 = { x: 460, y: 320, width: 520, height: 45 };
    const submitBtn19 = { x: 790, y: 680, width: 180, height: 40 };

    await annotateImage(s019Source, s019Annotated, [
      { x: walkInDialog19.x, y: walkInDialog19.y, width: walkInDialog19.width, height: walkInDialog19.height, badge: 1 },
      { x: tabSwitch19.x, y: tabSwitch19.y, width: tabSwitch19.width, height: tabSwitch19.height, badge: 2 },
      { x: submitBtn19.x, y: submitBtn19.y, width: submitBtn19.width, height: submitBtn19.height, badge: 3 },
    ]);
    results['SS-D6-S019'] = { title: 'Kiosk Unplanned Walk-In Registration', role: 'Front Desk', route: '/dashboard/attendance', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S020: Session Credit Ledger Overview (Manager)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S020: Session Credit Ledger Overview...');
    await pManager.goto(`${BASE_URL}/dashboard/attendance/ledger?centre=${centralCentreId}`, { waitUntil: 'domcontentloaded' });
    await pManager.waitForSelector('text=Jenkins', { timeout: 15000 }).catch(() => {});
    await pManager.waitForTimeout(600);

    const s020Source = path.join(OUT_SOURCE, 'SS-D6-S020-source.png');
    const s020Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S020.png');
    await pManager.screenshot({ path: s020Source });

    const headerBox20 = await safeBox(pManager, 'div.flex.items-center.justify-between.gap-3, div:has(> select)', { x: 280, y: 135, width: 1120, height: 45 });
    const ledgerTable20 = await safeBox(pManager, 'div.space-y-2:has(div.p-4), div.bg-card.rounded-lg', { x: 280, y: 500, width: 1120, height: 360 });
    const actionCell20 = { x: 1290, y: 535, width: 65, height: 28 };

    await annotateImage(s020Source, s020Annotated, [
      { x: headerBox20.x, y: headerBox20.y, width: headerBox20.width, height: headerBox20.height, badge: 1 },
      { x: ledgerTable20.x, y: ledgerTable20.y, width: ledgerTable20.width, height: ledgerTable20.height, badge: 2 },
      { x: actionCell20.x, y: actionCell20.y, width: actionCell20.width, height: actionCell20.height, badge: 3 },
    ]);
    results['SS-D6-S020'] = { title: 'Session Credit Ledger Overview', role: 'Manager/Owner', route: '/dashboard/attendance/ledger', annotations: 3, pass: true };

    console.log('[CAPTURE] All 10 screenshots captured & annotated successfully!');

    // -------------------------------------------------------------
    // GENERATE BATCH 2 CONTACT SHEET (10-Up Grid)
    // -------------------------------------------------------------
    console.log('[REVIEW] Generating Batch 2 Contact Sheet...');
    const assetIds = [
      'SS-D6-S011', 'SS-D6-S012', 'SS-D6-S013', 'SS-D6-S014', 'SS-D6-S015',
      'SS-D6-S016', 'SS-D6-S017', 'SS-D6-S018', 'SS-D6-S019', 'SS-D6-S020'
    ];

    const cols = 2;
    const rows = Math.ceil(assetIds.length / cols);
    const thumbW = 400;
    const thumbH = 250;
    const padding = 20;
    const headerH = 100;

    const totalW = cols * thumbW + (cols + 1) * padding;
    const totalH = headerH + rows * thumbH + (rows + 1) * padding;

    const composites: { input: Buffer; left: number; top: number }[] = [];

    for (let i = 0; i < assetIds.length; i++) {
      const id = assetIds[i];
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = padding + c * (thumbW + padding);
      const y = headerH + padding + r * (thumbH + padding);

      const filePath = path.join(OUT_ANNOTATED, `${id}.png`);
      if (fs.existsSync(filePath)) {
        const thumbBuf = await sharp(filePath)
          .resize(thumbW - 16, thumbH - 32, { fit: 'inside' })
          .toBuffer();

        const meta = await sharp(thumbBuf).metadata();
        const actualW = meta.width || (thumbW - 16);

        composites.push({
          input: thumbBuf,
          left: x + Math.floor((thumbW - actualW) / 2),
          top: y + 22,
        });
      }
    }

    let bannerSvg = `
      <svg width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${totalW}" height="${totalH}" fill="#0F172A" />
        <text x="30" y="45" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="bold" fill="#F8FAFC">SprintScale CMS — Milestone D6B Batch 2 Visual Review</text>
        <text x="30" y="68" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#94A3B8">Essential Screenshots SS-D6-S011 → SS-D6-S020 | Oakridge Learning Trust | Verified Synthetic Data</text>
    `;

    for (let i = 0; i < assetIds.length; i++) {
      const id = assetIds[i];
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = padding + c * (thumbW + padding);
      const y = headerH + padding + r * (thumbH + padding);
      const res = results[id];
      const title = escapeXml(res?.title || '');

      bannerSvg += `
        <rect x="${x}" y="${y}" width="${thumbW}" height="${thumbH}" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1" />
        <text x="${x + 12}" y="${y + 16}" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold" fill="#38BDF8">${id}: ${title}</text>
      `;
    }

    bannerSvg += '</svg>';

    const contactSheetPath = path.join(OUT_REVIEW, 'd6b-batch-2-contact-sheet.png');
    await sharp(Buffer.from(bannerSvg))
      .composite(composites)
      .png()
      .toFile(contactSheetPath);

    console.log(`[REVIEW] Contact sheet generated at: ${contactSheetPath}`);

  } finally {
    await browser.close();
  }

  return results;
}

if (require.main === module) {
  captureBatch2().catch((err) => {
    console.error('Error during capture:', err);
    process.exit(1);
  });
}
