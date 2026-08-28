import { chromium, Browser, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import * as dotenv from 'dotenv';
import postgres from 'postgres';

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

async function annotateImage(
  sourcePath: string,
  targetPath: string,
  callouts: Annotation[],
  viewportW = 1440,
  viewportH = 900
) {
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
      <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${radius}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-dasharray="8,4" opacity="0.95" />
      <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${radius}" fill="${strokeColor}" fill-opacity="0.04" />
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
    const box = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width > 5 && r.height > 5) {
        return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
      }
      return null;
    }, selector);
    if (box) return box;
  } catch {}
  return fallback;
}

async function loginUser(page: Page, email: string) {
  console.log(`[LOGIN] Logging in as ${email}...`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#admin-email', { state: 'visible', timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.fill('#admin-email', email);
  await page.fill('#admin-password', 'Password123!');
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const btn = document.querySelector('form button[type="submit"]') as HTMLButtonElement;
    if (btn) btn.click();
  });

  await page.waitForURL('**/dashboard**', { timeout: 60000 }).catch(async () => {
    console.log(`[LOGIN] Fallback navigating to /dashboard for ${email}...`);
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  });
  console.log(`[LOGIN] Logged in as ${email}! Current URL: ${page.url()}`);
  await page.waitForTimeout(1000);
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);
  const centreRows = await sql`SELECT id, name FROM centres WHERE name LIKE '%Central%'`;
  const centralCentreId = centreRows[0]?.id;

  const childRows = await sql`SELECT id, first_name, last_name FROM children WHERE first_name = 'Oliver'`;
  const childOliverId = childRows[0]?.id;

  await sql.end();

  console.log(`[SETUP] Central Centre ID: ${centralCentreId}, Oliver ID: ${childOliverId}`);

  const browser: Browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
  });

  try {
    // =============================================================
    // Context 1: Manager (Marcus Sterling) for S021 & S024
    // =============================================================
    const mgrCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await mgrCtx.addCookies([{ name: 'selected_centre_id', value: centralCentreId, url: BASE_URL }]);
    const pMgr = await mgrCtx.newPage();
    pMgr.setDefaultTimeout(60000);
    pMgr.setDefaultNavigationTimeout(60000);
    await loginUser(pMgr, 'marcus.sterling@example.test');

    // -------------------------------------------------------------
    // SS-D6-S021: Admin Session Forgiveness Dialog
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S021: Admin Session Forgiveness Dialog...');
    await pMgr.goto(`${BASE_URL}/dashboard/attendance/ledger?centre=${centralCentreId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pMgr.waitForSelector('text=Oliver Jenkins', { timeout: 20000 }).catch(() => {});
    await pMgr.waitForTimeout(800);

    // Expand Oliver Jenkins card
    await pMgr.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('div.cursor-pointer'));
      const oliverCard = cards.find(c => c.textContent?.includes('Oliver Jenkins'));
      if (oliverCard) (oliverCard as HTMLElement).click();
    });
    await pMgr.waitForTimeout(500);

    // Click Forgive Sessions button
    await pMgr.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const forgive = btns.find(b => b.textContent?.includes('Forgive Sessions'));
      if (forgive) forgive.click();
    });
    await pMgr.waitForTimeout(500);

    // Fill note in forgiveness modal
    const noteArea = pMgr.locator('textarea[placeholder*="Parent agreement"]').first();
    if (await noteArea.isVisible().catch(() => false)) {
      await noteArea.fill('Waived illness absence per parent notification on 14/07/2026.');
      await pMgr.waitForTimeout(300);
    }

    const s021Source = path.join(OUT_SOURCE, 'SS-D6-S021-source.png');
    const s021Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S021.png');
    await pMgr.screenshot({ path: s021Source });

    const cardBox21 = await safeBox(pMgr, 'div.bg-surface.border.border-border.rounded-lg', { x: 500, y: 220, width: 440, height: 460 });
    const noteBox21 = await safeBox(pMgr, 'textarea[placeholder*="Parent agreement"]', { x: 524, y: 390, width: 392, height: 80 });
    const confirmBtn21 = await safeBox(pMgr, 'button:has-text("Confirm Forgiveness")', { x: 745, y: 625, width: 170, height: 38 });

    await annotateImage(s021Source, s021Annotated, [
      { x: cardBox21.x, y: cardBox21.y, width: cardBox21.width, height: cardBox21.height, badge: 1 },
      { x: noteBox21.x, y: noteBox21.y, width: noteBox21.width, height: noteBox21.height, badge: 2 },
      { x: confirmBtn21.x, y: confirmBtn21.y, width: confirmBtn21.width, height: confirmBtn21.height, badge: 3 },
    ]);
    console.log('[CAPTURE] S021 done!');

    // -------------------------------------------------------------
    // SS-D6-S024: Restricted Safeguarding Incident Entry (Manager / DSL)
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S024: Restricted Safeguarding Incident Entry...');
    await pMgr.goto(`${BASE_URL}/dashboard/incidents?centre=${centralCentreId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pMgr.waitForTimeout(1000);

    // Open modal via evaluate
    await pMgr.evaluate(() => {
      const btn = document.getElementById('log-incident-btn') || Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Log Incident'));
      if (btn) (btn as HTMLElement).click();
    });
    await pMgr.waitForTimeout(1000);

    // Select Oliver Jenkins
    await pMgr.evaluate(() => {
      const sel = document.getElementById('incident-child') as HTMLSelectElement;
      if (sel) {
        for (let i = 0; i < sel.options.length; i++) {
          if (sel.options[i].text.includes('Oliver')) {
            sel.selectedIndex = i;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }
    });
    await pMgr.waitForTimeout(300);

    // Click Safeguarding record type
    await pMgr.evaluate(() => {
      const btn = document.getElementById('incident-type-safeguarding') || Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Safeguarding'));
      if (btn) (btn as HTMLElement).click();
    });
    await pMgr.waitForTimeout(300);

    // Fill description
    await pMgr.evaluate(() => {
      const ta = document.getElementById('incident-description') as HTMLTextAreaElement;
      if (ta) {
        ta.value = 'Observed sensitive welfare disclosure during afternoon activity. Escalated directly to designated safeguarding lead for internal review.';
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await pMgr.waitForTimeout(300);

    // Draw signature
    await pMgr.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = '#1a1a1a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(30, 40);
          ctx.bezierCurveTo(60, 20, 90, 60, 140, 35);
          ctx.stroke();
        }
      }
    });
    await pMgr.waitForTimeout(300);

    const s024Source = path.join(OUT_SOURCE, 'SS-D6-S024-source.png');
    const s024Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S024.png');
    await pMgr.screenshot({ path: s024Source });

    const sgBtnBox24 = await safeBox(pMgr, '#incident-type-safeguarding', { x: 742, y: 285, width: 200, height: 38 });
    const descBox24 = await safeBox(pMgr, '#incident-description', { x: 494, y: 350, width: 452, height: 95 });
    const submitBox24 = await safeBox(pMgr, 'button[form="incident-form"]', { x: 815, y: 645, width: 130, height: 40 });

    await annotateImage(s024Source, s024Annotated, [
      { x: sgBtnBox24.x, y: sgBtnBox24.y, width: sgBtnBox24.width, height: sgBtnBox24.height, badge: 1 },
      { x: descBox24.x, y: descBox24.y, width: descBox24.width, height: descBox24.height, badge: 2 },
      { x: submitBox24.x, y: submitBox24.y, width: submitBox24.width, height: submitBox24.height, badge: 3 },
    ]);
    console.log('[CAPTURE] S024 done!');

    await pMgr.close();

    // =============================================================
    // Context 2: Front Desk (Chloe Bennett) for S022 & S023
    // =============================================================
    const staffCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await staffCtx.addCookies([{ name: 'selected_centre_id', value: centralCentreId, url: BASE_URL }]);
    const pStaff = await staffCtx.newPage();
    pStaff.setDefaultTimeout(60000);
    pStaff.setDefaultNavigationTimeout(60000);
    await loginUser(pStaff, 'chloe.bennett@example.test');

    // -------------------------------------------------------------
    // SS-D6-S022: Student General Note Logging Form
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S022: Student General Note Logging Form...');
    await pStaff.goto(`${BASE_URL}/dashboard/students/${childOliverId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pStaff.waitForSelector('text=Oliver Jenkins', { timeout: 20000 });
    await pStaff.waitForTimeout(600);

    // Expand Add Progress Note form
    await pStaff.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Add Progress Note'));
      if (btn) (btn as HTMLElement).click();
    });
    await pStaff.waitForTimeout(400);

    // Select Progress chip and Excellent rating
    await pStaff.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('button'));
      const prog = chips.find(b => b.textContent?.trim() === 'Progress');
      if (prog) (prog as HTMLElement).click();
      const exc = chips.find(b => b.textContent?.includes('Excellent'));
      if (exc) (exc as HTMLElement).click();
    });
    await pStaff.waitForTimeout(300);

    // Fill note content
    const noteArea22 = pStaff.locator('textarea[placeholder*="note for Oliver"]').first();
    if (await noteArea22.isVisible().catch(() => false)) {
      await noteArea22.fill('Oliver showed outstanding engagement during science workshop today, collaborating effectively with peers.');
      await pStaff.waitForTimeout(300);
    }

    const s022Source = path.join(OUT_SOURCE, 'SS-D6-S022-source.png');
    const s022Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S022.png');
    await pStaff.screenshot({ path: s022Source });

    const noteCard22 = await safeBox(pStaff, 'div.rounded-md.border.border-border-subtle', { x: 860, y: 390, width: 540, height: 350 });
    const noteAreaBox22 = await safeBox(pStaff, 'textarea[placeholder*="note for Oliver"]', { x: 876, y: 580, width: 508, height: 75 });
    const saveBtn22 = await safeBox(pStaff, 'button:has-text("Save Note")', { x: 1300, y: 670, width: 85, height: 32 });

    await annotateImage(s022Source, s022Annotated, [
      { x: noteCard22.x, y: noteCard22.y, width: noteCard22.width, height: noteCard22.height, badge: 1 },
      { x: noteAreaBox22.x, y: noteAreaBox22.y, width: noteAreaBox22.width, height: noteAreaBox22.height, badge: 2 },
      { x: saveBtn22.x, y: saveBtn22.y, width: saveBtn22.width, height: saveBtn22.height, badge: 3 },
    ]);
    console.log('[CAPTURE] S022 done!');

    // -------------------------------------------------------------
    // SS-D6-S023: First Aid Accident Logging & Body Map
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S023: First Aid Accident Logging & Body Map...');
    await pStaff.goto(`${BASE_URL}/dashboard/incidents?centre=${centralCentreId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pStaff.waitForTimeout(1000);

    // Open modal via evaluate
    await pStaff.evaluate(() => {
      const btn = document.getElementById('log-incident-btn') || Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Log Incident'));
      if (btn) (btn as HTMLElement).click();
    });
    await pStaff.waitForTimeout(1000);

    // Select child
    await pStaff.evaluate(() => {
      const sel = document.getElementById('incident-child') as HTMLSelectElement;
      if (sel) {
        for (let i = 0; i < sel.options.length; i++) {
          if (sel.options[i].text.includes('Oliver')) {
            sel.selectedIndex = i;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }
    });
    await pStaff.waitForTimeout(300);

    // Fill description and treatment
    await pStaff.evaluate(() => {
      const d = document.getElementById('incident-description') as HTMLTextAreaElement;
      if (d) {
        d.value = 'Minor scrape on left knee after tripping during playground tag activity.';
        d.dispatchEvent(new Event('input', { bubbles: true }));
        d.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const t = document.getElementById('incident-treatment') as HTMLTextAreaElement;
      if (t) {
        t.value = 'Wound cleaned with sterile saline wipe; adhesive plaster applied; cold compress for 3 minutes.';
        t.dispatchEvent(new Event('input', { bubbles: true }));
        t.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await pStaff.waitForTimeout(300);

    // Draw signature
    await pStaff.evaluate(() => {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = '#1a1a1a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(30, 40);
          ctx.bezierCurveTo(60, 20, 90, 60, 140, 35);
          ctx.stroke();
        }
      }
    });
    await pStaff.waitForTimeout(300);

    const s023Source = path.join(OUT_SOURCE, 'SS-D6-S023-source.png');
    const s023Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S023.png');
    await pStaff.screenshot({ path: s023Source });

    const childBox23 = await safeBox(pStaff, '#incident-child', { x: 494, y: 145, width: 452, height: 42 });
    const treatBox23 = await safeBox(pStaff, '#incident-treatment', { x: 494, y: 440, width: 452, height: 60 });
    const submitBox23 = await safeBox(pStaff, 'button[form="incident-form"]', { x: 815, y: 730, width: 130, height: 40 });

    await annotateImage(s023Source, s023Annotated, [
      { x: childBox23.x, y: childBox23.y, width: childBox23.width, height: childBox23.height, badge: 1 },
      { x: treatBox23.x, y: treatBox23.y, width: treatBox23.width, height: treatBox23.height, badge: 2 },
      { x: submitBox23.x, y: submitBox23.y, width: submitBox23.width, height: submitBox23.height, badge: 3 },
    ]);
    console.log('[CAPTURE] S023 done!');

    await pStaff.close();

    // =============================================================
    // Context 3: Tutor (Liam Harper) for S025 (403 Role Gate)
    // =============================================================
    const tutorCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await tutorCtx.addCookies([{ name: 'selected_centre_id', value: centralCentreId, url: BASE_URL }]);
    const pTutor = await tutorCtx.newPage();
    pTutor.setDefaultTimeout(60000);
    pTutor.setDefaultNavigationTimeout(60000);
    await loginUser(pTutor, 'liam.harper@example.test');

    // -------------------------------------------------------------
    // SS-D6-S025: Safeguarding Access Denied Screen (403) / Role Boundary
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S025: Safeguarding Access Denied Screen (403)...');
    await pTutor.goto(`${BASE_URL}/dashboard/incidents`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pTutor.waitForTimeout(1000);

    const s025Source = path.join(OUT_SOURCE, 'SS-D6-S025-source.png');
    const s025Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S025.png');
    await pTutor.screenshot({ path: s025Source });

    const sidebarNav25 = await safeBox(pTutor, 'nav, aside', { x: 15, y: 70, width: 230, height: 700 });
    const rolePill25 = await safeBox(pTutor, 'div:has-text("Liam Harper")', { x: 1280, y: 15, width: 140, height: 40 });
    const activeHeader25 = await safeBox(pTutor, 'h1, h2', { x: 280, y: 80, width: 400, height: 50 });

    await annotateImage(s025Source, s025Annotated, [
      { x: sidebarNav25.x, y: sidebarNav25.y, width: sidebarNav25.width, height: sidebarNav25.height, badge: 1 },
      { x: rolePill25.x, y: rolePill25.y, width: rolePill25.width, height: rolePill25.height, badge: 2 },
      { x: activeHeader25.x, y: activeHeader25.y, width: activeHeader25.width, height: activeHeader25.height, badge: 3 },
    ]);
    console.log('[CAPTURE] S025 done!');

    await pTutor.close();

    // =============================================================
    // Context 4: Organisation Owner (Eleanor Vance) for S026, S027, S028, S029, S030
    // =============================================================
    const ownerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ownerCtx.addCookies([{ name: 'selected_centre_id', value: centralCentreId, url: BASE_URL }]);
    const pOwner = await ownerCtx.newPage();
    pOwner.setDefaultTimeout(60000);
    pOwner.setDefaultNavigationTimeout(60000);
    await loginUser(pOwner, 'eleanor.vance@example.test');

    // -------------------------------------------------------------
    // SS-D6-S026: Finance Executive Overview Dashboard
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S026: Finance Executive Overview Dashboard...');
    await pOwner.goto(`${BASE_URL}/dashboard/finance`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pOwner.waitForSelector('text=Finance Ledger', { timeout: 20000 }).catch(() => {});
    await pOwner.waitForTimeout(800);

    const s026Source = path.join(OUT_SOURCE, 'SS-D6-S026-source.png');
    const s026Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S026.png');
    await pOwner.screenshot({ path: s026Source });

    const kpiSummaryBox26 = await safeBox(pOwner, 'div.grid:has-text("Total Invoiced")', { x: 280, y: 150, width: 1100, height: 110 });
    const actionBtns26 = await safeBox(pOwner, 'div.flex.items-center:has-text("Export CSV")', { x: 1050, y: 90, width: 330, height: 45 });
    const invoicesTable26 = await safeBox(pOwner, 'table', { x: 280, y: 350, width: 1100, height: 350 });

    await annotateImage(s026Source, s026Annotated, [
      { x: kpiSummaryBox26.x, y: kpiSummaryBox26.y, width: kpiSummaryBox26.width, height: kpiSummaryBox26.height, badge: 1 },
      { x: actionBtns26.x, y: actionBtns26.y, width: actionBtns26.width, height: actionBtns26.height, badge: 2 },
      { x: invoicesTable26.x, y: invoicesTable26.y, width: invoicesTable26.width, height: invoicesTable26.height, badge: 3 },
    ]);
    console.log('[CAPTURE] S026 done!');

    // -------------------------------------------------------------
    // SS-D6-S027: Family Agreed Monthly Fee Billing Config
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S027: Family Agreed Monthly Fee Billing Config...');
    await pOwner.goto(`${BASE_URL}/dashboard/students/${childOliverId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pOwner.waitForSelector('text=Oliver Jenkins', { timeout: 20000 });
    await pOwner.waitForTimeout(600);

    // Switch to Billing tab
    await pOwner.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const billTab = tabs.find(t => t.textContent?.includes('Billing'));
      if (billTab) (billTab as HTMLElement).click();
    });
    await pOwner.waitForTimeout(600);

    const s027Source = path.join(OUT_SOURCE, 'SS-D6-S027-source.png');
    const s027Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S027.png');
    await pOwner.screenshot({ path: s027Source });

    const agreedFeeCard27 = await safeBox(pOwner, 'div.rounded-xl.border:has-text("Agreed Monthly Fee"), div.bg-surface:has-text("Agreed Monthly Fee")', { x: 280, y: 350, width: 850, height: 260 });
    const feeAmountBox27 = await safeBox(pOwner, 'p:has-text("£280.00"), div:has-text("£280.00")', { x: 300, y: 400, width: 220, height: 45 });
    const statusBadge27 = await safeBox(pOwner, 'span:has-text("Active"), span:has-text("ACTIVE")', { x: 1020, y: 400, width: 80, height: 26 });

    await annotateImage(s027Source, s027Annotated, [
      { x: agreedFeeCard27.x, y: agreedFeeCard27.y, width: agreedFeeCard27.width, height: agreedFeeCard27.height, badge: 1 },
      { x: feeAmountBox27.x, y: feeAmountBox27.y, width: feeAmountBox27.width, height: feeAmountBox27.height, badge: 2 },
      { x: statusBadge27.x, y: statusBadge27.y, width: statusBadge27.width, height: statusBadge27.height, badge: 3 },
    ]);
    console.log('[CAPTURE] S027 done!');

    // -------------------------------------------------------------
    // SS-D6-S028: Sibling Coverage Junction Mapping
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S028: Sibling Coverage Junction Mapping...');
    const s028Source = path.join(OUT_SOURCE, 'SS-D6-S028-source.png');
    const s028Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S028.png');
    await pOwner.screenshot({ path: s028Source });

    const sharedFamilyBox28 = await safeBox(pOwner, 'p:has-text("Shared family billing")', { x: 300, y: 460, width: 300, height: 24 });
    const siblingBadges28 = await safeBox(pOwner, 'div.flex.flex-wrap:has-text("Oliver Jenkins")', { x: 300, y: 485, width: 350, height: 35 });
    const editConfigBtn28 = await safeBox(pOwner, 'button:has-text("Edit")', { x: 1020, y: 460, width: 80, height: 32 });

    await annotateImage(s028Source, s028Annotated, [
      { x: sharedFamilyBox28.x, y: sharedFamilyBox28.y, width: sharedFamilyBox28.width, height: sharedFamilyBox28.height, badge: 1 },
      { x: siblingBadges28.x, y: siblingBadges28.y, width: siblingBadges28.width, height: siblingBadges28.height, badge: 2 },
      { x: editConfigBtn28.x, y: editConfigBtn28.y, width: editConfigBtn28.width, height: editConfigBtn28.height, badge: 3 },
    ]);
    console.log('[CAPTURE] S028 done!');

    // -------------------------------------------------------------
    // SS-D6-S029: Monthly Invoice Batch Generation Run
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S029: Monthly Invoice Batch Generation Run...');
    await pOwner.goto(`${BASE_URL}/dashboard/finance`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pOwner.waitForSelector('text=Billing Cycles', { timeout: 20000 }).catch(() => {});
    await pOwner.waitForTimeout(600);

    // Scroll to Billing Cycles section
    await pOwner.evaluate(() => {
      const el = Array.from(document.querySelectorAll('h2')).find(h => h.textContent?.includes('Billing Cycles'));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
    await pOwner.waitForTimeout(500);

    // Click Generate Invoices / Generate All
    await pOwner.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Generate All') || b.textContent?.includes('Generate Invoice'));
      if (btn) (btn as HTMLElement).click();
    });
    await pOwner.waitForTimeout(500);

    const s029Source = path.join(OUT_SOURCE, 'SS-D6-S029-source.png');
    const s029Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S029.png');
    await pOwner.screenshot({ path: s029Source });

    const modalBox29 = await safeBox(pOwner, 'div.fixed.inset-0 div.bg-card', { x: 480, y: 150, width: 480, height: 600 });
    const feeInputBox29 = await safeBox(pOwner, 'div:has-text("£420.00"), div.space-y-4', { x: 512, y: 250, width: 416, height: 180 });
    const submitBtn29 = await safeBox(pOwner, 'button:has-text("Generate"), button:has-text("Confirm")', { x: 740, y: 680, width: 180, height: 44 });

    await annotateImage(s029Source, s029Annotated, [
      { x: modalBox29.x, y: modalBox29.y, width: modalBox29.width, height: modalBox29.height, badge: 1 },
      { x: feeInputBox29.x, y: feeInputBox29.y, width: feeInputBox29.width, height: feeInputBox29.height, badge: 2 },
      { x: submitBtn29.x, y: submitBtn29.y, width: submitBtn29.width, height: submitBtn29.height, badge: 3 },
    ]);
    console.log('[CAPTURE] S029 done!');

    // -------------------------------------------------------------
    // SS-D6-S030: Invoices Directory & Status Badges
    // -------------------------------------------------------------
    console.log('[CAPTURE] Capturing SS-D6-S030: Invoices Directory & Status Badges...');
    await pOwner.goto(`${BASE_URL}/dashboard/finance/invoices`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pOwner.waitForSelector('text=Full Invoice History', { timeout: 20000 }).catch(() => {});
    await pOwner.waitForTimeout(600);

    const s030Source = path.join(OUT_SOURCE, 'SS-D6-S030-source.png');
    const s030Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S030.png');
    await pOwner.screenshot({ path: s030Source });

    const statusFilterBox30 = await safeBox(pOwner, 'select', { x: 615, y: 145, width: 160, height: 42 });
    const invoiceRow30 = await safeBox(pOwner, 'table tbody tr:first-child', { x: 280, y: 220, width: 1100, height: 60 });
    const statusBadge30 = await safeBox(pOwner, 'table tbody tr:first-child span.rounded-full', { x: 1040, y: 232, width: 75, height: 26 });

    await annotateImage(s030Source, s030Annotated, [
      { x: statusFilterBox30.x, y: statusFilterBox30.y, width: statusFilterBox30.width, height: statusFilterBox30.height, badge: 1 },
      { x: invoiceRow30.x, y: invoiceRow30.y, width: invoiceRow30.width, height: invoiceRow30.height, badge: 2 },
      { x: statusBadge30.x, y: statusBadge30.y, width: statusBadge30.width, height: statusBadge30.height, badge: 3 },
    ]);
    console.log('[CAPTURE] S030 done!');

    await pOwner.close();

    // =============================================================
    // BATCH 3 CONTACT SHEET GENERATION (10-Up Grid)
    // =============================================================
    console.log('[REVIEW] Generating Batch 3 Contact Sheet...');
    const assetIds = [
      'SS-D6-S021', 'SS-D6-S022', 'SS-D6-S023', 'SS-D6-S024', 'SS-D6-S025',
      'SS-D6-S026', 'SS-D6-S027', 'SS-D6-S028', 'SS-D6-S029', 'SS-D6-S030'
    ];

    const titles: Record<string, string> = {
      'SS-D6-S021': 'Admin Session Forgiveness Dialog',
      'SS-D6-S022': 'Student General Note Logging Form',
      'SS-D6-S023': 'First Aid Accident Logging & Body Map',
      'SS-D6-S024': 'Restricted Safeguarding Incident Entry',
      'SS-D6-S025': 'Safeguarding Access Denied Screen (403)',
      'SS-D6-S026': 'Finance Executive Overview Dashboard',
      'SS-D6-S027': 'Family Agreed Monthly Fee Billing Config',
      'SS-D6-S028': 'Sibling Coverage Junction Mapping',
      'SS-D6-S029': 'Monthly Invoice Batch Generation Run',
      'SS-D6-S030': 'Invoices Directory & Status Badges'
    };

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
        <text x="30" y="45" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="bold" fill="#F8FAFC">SprintScale CMS — Milestone D6B Batch 3 Visual Review</text>
        <text x="30" y="68" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#94A3B8">Essential Screenshots SS-D6-S021 → SS-D6-S030 | Oakridge Learning Trust | Verified Synthetic Data</text>
    `;

    for (let i = 0; i < assetIds.length; i++) {
      const id = assetIds[i];
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = padding + c * (thumbW + padding);
      const y = headerH + padding + r * (thumbH + padding);
      const title = (titles[id] || '').replace(/&/g, '&amp;');

      bannerSvg += `
        <rect x="${x}" y="${y}" width="${thumbW}" height="${thumbH}" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1" />
        <text x="${x + 12}" y="${y + 16}" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold" fill="#38BDF8">${id}: ${title}</text>
      `;
    }

    bannerSvg += '</svg>';

    const contactSheetPath = path.join(OUT_REVIEW, 'd6b-batch-3-contact-sheet.png');
    await sharp(Buffer.from(bannerSvg))
      .composite(composites)
      .png()
      .toFile(contactSheetPath);

    console.log(`[REVIEW] Contact sheet generated at: ${contactSheetPath}`);

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
