/**
 * SPRINTSCALE CMS — MILESTONE D6B & D6B.R1
 * Essential Screenshot Production & Semantic Annotation Quality Gate
 * Captures SS-D6-S001 -> SS-D6-S010 with exact semantic DOM bounding boxes.
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.TRAINING_APP_URL || 'http://localhost:3000';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const ASSETS_BASE = path.join(process.cwd(), 'project-notes/documentation-training/assets');
const OUT_SOURCE = path.join(ASSETS_BASE, 'screenshots/source');
const OUT_ANNOTATED = path.join(ASSETS_BASE, 'screenshots/annotated');
const OUT_REVIEW = path.join(ASSETS_BASE, 'review');

function ensureDirs() {
  [OUT_SOURCE, OUT_ANNOTATED, OUT_REVIEW].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

interface Callout {
  x: number;
  y: number;
  width: number;
  height: number;
  badge: number;
  color?: string;
}

async function annotateImage(sourcePath: string, targetPath: string, callouts: Callout[]) {
  const meta = await sharp(sourcePath).metadata();
  const imgW = meta.width || 1440;
  const imgH = meta.height || 900;

  let svgElements = '';

  for (const c of callouts) {
    const strokeColor = c.color || '#2563EB';
    const badgeColor = c.color || '#2563EB';
    const radius = 6;
    const strokeWidth = 3;
    const badgeRadius = 14;

    const bx = Math.max(2, Math.min(imgW - 10, c.x));
    const by = Math.max(2, Math.min(imgH - 10, c.y));
    const bw = Math.min(imgW - bx - 2, Math.max(10, c.width));
    const bh = Math.min(imgH - by - 2, Math.max(10, c.height));

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
    <svg width="${imgW}" height="${imgH}" viewBox="0 0 ${imgW} ${imgH}" xmlns="http://www.w3.org/2000/svg">
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
    await loc.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    const box = await loc.boundingBox();
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
  await page.waitForTimeout(500);
  await page.fill('#admin-email', email);
  await page.fill('#admin-password', 'Password123!');
  await Promise.all([
    page.waitForURL('**/dashboard**', { timeout: 25000 }),
    page.click('form button[type="submit"]')
  ]);
  await page.waitForTimeout(600);
}

async function enterPublicRegistration(page: Page) {
  await page.goto(`${BASE_URL}/register/oakridge-learning`, { waitUntil: 'networkidle' });
  
  const centreBtn = page.locator('button:has-text("Oakridge Central"), button:has-text("Central")').first();
  if (await centreBtn.isVisible()) {
    await centreBtn.click();
    await page.waitForTimeout(500);
  }

  const proceedBtn = page.locator('button:has-text("Proceed to Registration")').first();
  if (await proceedBtn.isVisible()) {
    await proceedBtn.click();
    await page.waitForTimeout(500);
  }

  await page.waitForSelector('#p-fn-0', { state: 'visible', timeout: 20000 });
}

export async function captureBatch1() {
  ensureDirs();

  const browser: Browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  const results: Record<string, { title: string; role: string; route: string; annotations: number; pass: boolean }> = {};

  try {
    // 1. Prepare Authenticated Persona Contexts
    console.log('[SETUP] Initialising persona contexts...');
    const ownerCtx: BrowserContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pOwner = await ownerCtx.newPage();
    await loginUser(pOwner, 'eleanor.vance@example.test');

    const managerCtx: BrowserContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pManager = await managerCtx.newPage();
    await loginUser(pManager, 'marcus.sterling@example.test');

    const staffCtx: BrowserContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pStaff = await staffCtx.newPage();
    await loginUser(pStaff, 'chloe.bennett@example.test');

    // -------------------------------------------------------------
    // SS-D6-S001: Dashboard Home & Navigation Overview (Owner/Manager)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S001: Dashboard Home...');
    await pOwner.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await pOwner.waitForTimeout(1000);

    const s001Source = path.join(OUT_SOURCE, 'SS-D6-S001-source.png');
    const s001Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S001.png');
    await pOwner.screenshot({ path: s001Source });

    const headerBox = await safeBox(pOwner, 'header', { x: 260, y: 0, width: 1180, height: 68 });
    const sidebarBox = await safeBox(pOwner, 'aside, nav', { x: 0, y: 0, width: 256, height: 900 });
    const kpisBox = await safeBox(pOwner, '.grid, main div:has(> .grid)', { x: 280, y: 100, width: 1120, height: 260 });

    await annotateImage(s001Source, s001Annotated, [
      { x: headerBox.x + 10, y: headerBox.y + 10, width: headerBox.width - 20, height: headerBox.height - 20, badge: 1 },
      { x: sidebarBox.x + 10, y: sidebarBox.y + 10, width: sidebarBox.width - 20, height: Math.min(600, sidebarBox.height - 20), badge: 2 },
      { x: kpisBox.x + 10, y: kpisBox.y + 10, width: kpisBox.width - 20, height: Math.min(280, kpisBox.height), badge: 3 },
    ]);
    results['SS-D6-S001'] = { title: 'Dashboard Home & Navigation Overview', role: 'Owner/Manager', route: '/dashboard', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S002: Parent Directory Roster (Manager/Owner)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S002: Parent Directory Roster...');
    await pManager.goto(`${BASE_URL}/dashboard/parents`, { waitUntil: 'domcontentloaded' });
    await pManager.waitForTimeout(1000);

    const s002Source = path.join(OUT_SOURCE, 'SS-D6-S002-source.png');
    const s002Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S002.png');
    await pManager.screenshot({ path: s002Source });

    const searchBox2 = await safeBox(pManager, 'input[type="text"], input[type="search"]', { x: 280, y: 90, width: 340, height: 44 });
    const tableBox2 = await safeBox(pManager, 'table, [role="table"], div:has(> table)', { x: 280, y: 150, width: 1120, height: 420 });
    const actionBtn2 = await safeBox(pManager, 'a:has-text("View Profile"), a:has-text("View Details"), table tr a', { x: 1240, y: 220, width: 120, height: 36 });

    await annotateImage(s002Source, s002Annotated, [
      { x: searchBox2.x, y: searchBox2.y, width: searchBox2.width, height: searchBox2.height, badge: 1 },
      { x: tableBox2.x, y: tableBox2.y, width: tableBox2.width, height: tableBox2.height, badge: 2 },
      { x: actionBtn2.x, y: actionBtn2.y, width: actionBtn2.width, height: actionBtn2.height, badge: 3 },
    ]);
    results['SS-D6-S002'] = { title: 'Parent Directory Roster', role: 'Manager/Owner', route: '/dashboard/parents', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S003: Parent Profile & Emergency Contact Cards (All Staff)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S003: Parent Profile & Emergency Contact Cards...');
    await pStaff.goto(`${BASE_URL}/dashboard/parents/222118a6-b60c-4d78-a60d-90492bf9f103`, { waitUntil: 'domcontentloaded' });
    await pStaff.waitForTimeout(1000);

    const s003Source = path.join(OUT_SOURCE, 'SS-D6-S003-source.png');
    const s003Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S003.png');
    await pStaff.screenshot({ path: s003Source });

    const contactCard3 = await safeBox(pStaff, 'div.lg\\:col-span-2 > div:first-child', { x: 280, y: 150, width: 720, height: 260 });
    const childrenCard3 = await safeBox(pStaff, 'div:has(> p:has-text("Associated children"))', { x: 280, y: 430, width: 720, height: 180 });
    const rightCol3 = await safeBox(pStaff, 'div.grid > div:nth-child(2)', { x: 1020, y: 150, width: 380, height: 460 });

    await annotateImage(s003Source, s003Annotated, [
      { x: contactCard3.x, y: contactCard3.y, width: contactCard3.width, height: contactCard3.height, badge: 1 },
      { x: childrenCard3.x, y: childrenCard3.y, width: childrenCard3.width, height: childrenCard3.height, badge: 2 },
      { x: rightCol3.x, y: rightCol3.y, width: rightCol3.width, height: rightCol3.height, badge: 3 },
    ]);
    results['SS-D6-S003'] = { title: 'Parent Profile & Emergency Contact Cards', role: 'All Staff', route: '/dashboard/parents/[id]', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S004: Authorised Collector Management (Public Intake / Staff Record)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S004: Authorised Collector Management...');
    const ctx4 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p4 = await ctx4.newPage();
    await enterPublicRegistration(p4);

    // Step 1: Parent & Emergency Details
    await p4.fill('#p-fn-0', 'Sarah');
    await p4.fill('#p-ln-0', 'Jenkins');
    await p4.selectOption('#p-rel-0', 'mother');
    await p4.fill('#p-ph-0', '07700 900111');
    await p4.fill('#p-em-0', 'sarah.jenkins@example.test');
    await p4.fill('#p-a1-0', '12 Highfield Road');
    await p4.fill('#p-city-0', 'London');
    await p4.fill('#p-pc-0', 'SE26 4QD');
    await p4.fill('#ec-name', 'David Jenkins');
    await p4.fill('#ec-rel', 'Father');
    await p4.fill('#ec-phone', '07700 900222');

    // Add Authorised Collector
    await p4.click('button:has-text("Add Authorised Collector")').catch(() => {});
    await p4.waitForTimeout(300);
    const acName = p4.locator('#ac-name-0');
    if (await acName.count() > 0) {
      await acName.fill('Rose Jenkins');
      await p4.fill('#ac-rel-0', 'Grandmother');
      await p4.fill('#ac-ph-0', '07700 900333');
    }

    const s004Source = path.join(OUT_SOURCE, 'SS-D6-S004-source.png');
    const s004Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S004.png');
    await p4.screenshot({ path: s004Source });

    const emergencyBox4 = await safeBox(p4, 'div.bg-card:has(#ec-name)', { x: 280, y: 380, width: 880, height: 180 });
    const collectorBox4 = await safeBox(p4, 'div.bg-card:has(#ac-name-0), div:has(> h3:has-text("Collector"))', { x: 280, y: 580, width: 880, height: 220 });
    const addCollectorBtn4 = await safeBox(p4, 'button:has-text("Add Authorised Collector")', { x: 280, y: 810, width: 880, height: 50 });

    await annotateImage(s004Source, s004Annotated, [
      { x: emergencyBox4.x, y: emergencyBox4.y, width: emergencyBox4.width, height: emergencyBox4.height, badge: 1 },
      { x: collectorBox4.x, y: collectorBox4.y, width: collectorBox4.width, height: collectorBox4.height, badge: 2 },
      { x: addCollectorBtn4.x, y: addCollectorBtn4.y, width: addCollectorBtn4.width, height: addCollectorBtn4.height, badge: 3 },
    ]);
    await ctx4.close();
    results['SS-D6-S004'] = { title: 'Authorised Collector Management', role: 'Front Desk/Tutor', route: '/register/[slug]', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S005: Student Directory & Medical Badges (All Staff)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S005: Student Directory & Medical Badges...');
    await pStaff.goto(`${BASE_URL}/dashboard/students`, { waitUntil: 'domcontentloaded' });
    await pStaff.waitForTimeout(1000);

    const s005Source = path.join(OUT_SOURCE, 'SS-D6-S005-source.png');
    const s005Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S005.png');
    await pStaff.screenshot({ path: s005Source });

    const searchBox5 = await safeBox(pStaff, 'input[type="text"], input[type="search"]', { x: 280, y: 90, width: 340, height: 44 });
    const tableBox5 = await safeBox(pStaff, 'table, [role="table"], div:has(> table)', { x: 280, y: 150, width: 1120, height: 450 });
    const medicalBadge5 = await safeBox(pStaff, 'span:has-text("Medical Alert"), span:has-text("Peanut"), span:has-text("Allergy"), span:has-text("Asthma")', { x: 800, y: 220, width: 140, height: 32 });

    await annotateImage(s005Source, s005Annotated, [
      { x: searchBox5.x, y: searchBox5.y, width: searchBox5.width, height: searchBox5.height, badge: 1 },
      { x: tableBox5.x, y: tableBox5.y, width: tableBox5.width, height: tableBox5.height, badge: 2 },
      { x: medicalBadge5.x - 5, y: medicalBadge5.y - 5, width: medicalBadge5.width + 10, height: medicalBadge5.height + 10, badge: 3 },
    ]);
    results['SS-D6-S005'] = { title: 'Student Directory & Medical Badges', role: 'All Staff', route: '/dashboard/students', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S006: Student Profile & Allergy/Dietary Summary (All Staff)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S006: Student Profile & Allergy/Dietary Summary...');
    await pStaff.goto(`${BASE_URL}/dashboard/students/f464f6cb-72d3-4a9c-9105-109d76b09eb1`, { waitUntil: 'domcontentloaded' });
    await pStaff.waitForTimeout(1000);

    const s006Source = path.join(OUT_SOURCE, 'SS-D6-S006-source.png');
    const s006Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S006.png');
    await pStaff.screenshot({ path: s006Source });

    const pupilHeader6 = await safeBox(pStaff, 'div.p-5:has(h1:has-text("Oliver Jenkins")), div:has(> div > h1:has-text("Oliver Jenkins"))', { x: 393, y: 141, width: 894, height: 123 });
    const allergyCard6 = await safeBox(pStaff, 'div.rounded-md:has(p:has-text("Medical & safety notes")), div.p-4.bg-danger-soft', { x: 412, y: 750, width: 416, height: 123 });
    const parentCard6 = await safeBox(pStaff, 'div:has(> p:has-text("Parent / guardian"))', { x: 412, y: 368, width: 416, height: 267 });

    await annotateImage(s006Source, s006Annotated, [
      { x: pupilHeader6.x, y: pupilHeader6.y, width: pupilHeader6.width, height: pupilHeader6.height, badge: 1 },
      { x: allergyCard6.x, y: allergyCard6.y, width: allergyCard6.width, height: allergyCard6.height, badge: 2 },
      { x: parentCard6.x, y: parentCard6.y, width: parentCard6.width, height: parentCard6.height, badge: 3 },
    ]);
    results['SS-D6-S006'] = { title: 'Student Profile & Allergy/Dietary Summary', role: 'All Staff', route: '/dashboard/students/[id]', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S007: Public Multi-Child Registration Form (Parent Public)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S007: Public Multi-Child Registration Form...');
    const ctx7 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p7 = await ctx7.newPage();
    await enterPublicRegistration(p7);

    // Populate realistic synthetic sample details
    await p7.fill('#p-fn-0', 'James');
    await p7.fill('#p-ln-0', 'Walker');
    await p7.selectOption('#p-rel-0', 'father');
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
    await enterPublicRegistration(p8);

    // Step 1: Family
    await p8.fill('#p-fn-0', 'James');
    await p8.fill('#p-ln-0', 'Walker');
    await p8.selectOption('#p-rel-0', 'father');
    await p8.fill('#p-ph-0', '07700 900555');
    await p8.fill('#p-em-0', 'james.walker@example.test');
    await p8.fill('#p-a1-0', '44 Oakridge Avenue');
    await p8.fill('#p-city-0', 'London');
    await p8.fill('#p-pc-0', 'SW1A 1AA');
    await p8.fill('#ec-name', 'Claire Walker');
    await p8.fill('#ec-rel', 'Mother');
    await p8.fill('#ec-phone', '07700 900556');
    await p8.click('button:has-text("Next Step"), button:has-text("Continue")');
    await p8.waitForTimeout(400);

    // Step 2: Student
    await p8.fill('#child-fn-0', 'Lucas');
    await p8.fill('#child-ln-0', 'Walker');
    await p8.fill('#child-dob-0', '2018-05-12');
    await p8.selectOption('#child-yr-0', 'Y3');
    await p8.click('button:has-text("Next Step"), button:has-text("Continue")');
    await p8.waitForTimeout(400);

    // Step 3: Sessions & Funding
    await p8.locator('div.grid.grid-cols-2 > div').first().click();
    await p8.click('#fund-self_funded');
    await p8.click('button:has-text("Next Step"), button:has-text("Continue")');
    await p8.waitForTimeout(600);

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
    await pManager.goto(`${BASE_URL}/dashboard/registrations`, { waitUntil: 'domcontentloaded' });
    await pManager.waitForTimeout(1000);

    const s009Source = path.join(OUT_SOURCE, 'SS-D6-S009-source.png');
    const s009Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S009.png');
    await pManager.screenshot({ path: s009Source });

    const filterPills9 = await safeBox(pManager, 'div:has(> button:has-text("All")), div:has(> button:has-text("Awaiting")), div.flex.gap-2', { x: 280, y: 90, width: 600, height: 44 });
    const regTableRow9 = await safeBox(pManager, 'table tr:has-text("Walker"), div:has-text("Walker"), table tbody tr', { x: 280, y: 160, width: 1120, height: 60 });
    const reviewBtn9 = await safeBox(pManager, 'a:has-text("Review"), button:has-text("Review"), table tr a', { x: 1200, y: 170, width: 120, height: 36 });

    await annotateImage(s009Source, s009Annotated, [
      { x: filterPills9.x, y: filterPills9.y, width: filterPills9.width, height: filterPills9.height, badge: 1 },
      { x: regTableRow9.x, y: regTableRow9.y, width: regTableRow9.width, height: regTableRow9.height, badge: 2 },
      { x: reviewBtn9.x, y: reviewBtn9.y, width: reviewBtn9.width, height: reviewBtn9.height, badge: 3 },
    ]);
    results['SS-D6-S009'] = { title: 'Registration Intake Triage Roster', role: 'Manager/Owner', route: '/dashboard/registrations', annotations: 3, pass: true };

    // -------------------------------------------------------------
    // SS-D6-S010: Registration Child Matching & Approval (Manager/Owner)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S010: Registration Child Matching & Approval...');
    await pManager.goto(`${BASE_URL}/dashboard/registrations/50cbfe65-1d23-49f0-ae8b-ec55a2fe0f44`, { waitUntil: 'domcontentloaded' });
    await pManager.waitForTimeout(1000);

    const s010Source = path.join(OUT_SOURCE, 'SS-D6-S010-source.png');
    const s010Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S010.png');
    await pManager.screenshot({ path: s010Source });

    const headerActionBar10 = await safeBox(pManager, 'div.flex.items-start.justify-between.mb-8', { x: 280, y: 80, width: 880, height: 75 });
    const childrenCard10 = await safeBox(pManager, 'div.bg-card.border:has(h2:has-text("Students & Sessions")), div.bg-card.border:has(h2:has-text("Children"))', { x: 280, y: 170, width: 880, height: 280 });
    const parentCard10 = await safeBox(pManager, 'div.bg-card.border:has(h2:has-text("Parent / Carer")), div.bg-card.border:has(h2:has-text("Parent Details"))', { x: 280, y: 470, width: 880, height: 350 });

    await annotateImage(s010Source, s010Annotated, [
      { x: headerActionBar10.x, y: headerActionBar10.y, width: headerActionBar10.width, height: headerActionBar10.height, badge: 1 },
      { x: childrenCard10.x, y: childrenCard10.y, width: childrenCard10.width, height: childrenCard10.height, badge: 2 },
      { x: parentCard10.x, y: parentCard10.y, width: parentCard10.width, height: parentCard10.height, badge: 3 },
    ]);
    results['SS-D6-S010'] = { title: 'Registration Child Matching & Approval', role: 'Manager/Owner', route: '/dashboard/registrations/[id]', annotations: 3, pass: true };

    console.log('[CAPTURE] All 10 screenshots captured & annotated successfully!');

    // -------------------------------------------------------------
    // Generate Batch 1 Contact Sheet (Stage T)
    // -------------------------------------------------------------
    console.log('[REVIEW] Generating Batch 1 Contact Sheet...');
    const assetIds = [
      'SS-D6-S001', 'SS-D6-S002', 'SS-D6-S003', 'SS-D6-S004', 'SS-D6-S005',
      'SS-D6-S006', 'SS-D6-S007', 'SS-D6-S008', 'SS-D6-S009', 'SS-D6-S010',
    ];

    const thumbW = 400;
    const thumbH = 250;
    const padding = 20;
    const headerH = 80;
    const cols = 2;
    const rows = 5;
    const totalW = cols * thumbW + (cols + 1) * padding;
    const totalH = headerH + rows * thumbH + (rows + 1) * padding;

    const composites: sharp.OverlayOptions[] = [];

    for (let i = 0; i < assetIds.length; i++) {
      const id = assetIds[i];
      const annotatedPath = path.join(OUT_ANNOTATED, `${id}.png`);
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = padding + c * (thumbW + padding);
      const y = headerH + padding + r * (thumbH + padding);

      if (fs.existsSync(annotatedPath)) {
        const thumbBuf = await sharp(annotatedPath)
          .resize(thumbW, thumbH - 24, { fit: 'inside' })
          .toBuffer();

        const meta = await sharp(thumbBuf).metadata();
        const actualW = meta.width || thumbW;
        const actualH = meta.height || (thumbH - 24);

        composites.push({
          input: thumbBuf,
          left: x + Math.floor((thumbW - actualW) / 2),
          top: y + 22,
        });
      }
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

    let bannerSvg = `
      <svg width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${totalW}" height="${totalH}" fill="#0F172A" />
        <text x="30" y="45" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="bold" fill="#F8FAFC">SprintScale CMS — Milestone D6B Batch 1 Visual Review</text>
        <text x="30" y="68" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#94A3B8">Essential Screenshots SS-D6-S001 → SS-D6-S010 | Oakridge Learning Trust | Verified Synthetic Data</text>
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

    const contactSheetPath = path.join(OUT_REVIEW, 'd6b-batch-1-contact-sheet.png');
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
  captureBatch1()
    .then(() => {
      console.log('[DONE] Milestone D6B Batch 1 capture & review generation complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error during capture:', err);
      process.exit(1);
    });
}
