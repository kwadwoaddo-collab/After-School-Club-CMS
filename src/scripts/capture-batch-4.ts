import { chromium, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3000';
const OUT_SOURCE = path.resolve('project-notes/documentation-training/assets/screenshots/source');
const OUT_ANNOTATED = path.resolve('project-notes/documentation-training/assets/screenshots/annotated');
const OUT_REVIEW = path.resolve('project-notes/documentation-training/assets/review');

// Oakridge Central Centre ID
const OAKRIDGE_CENTRE_ID = '435439fe-fab5-444f-a897-df568fce0254';

interface Annotation {
  x: number;
  y: number;
  width: number;
  height: number;
  badge: number;
}

async function ensureDirs() {
  [OUT_SOURCE, OUT_ANNOTATED, OUT_REVIEW].forEach((d) => {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  });
}

async function annotateImage(
  sourcePath: string,
  targetPath: string,
  callouts: Annotation[]
) {
  const meta = await sharp(sourcePath).metadata();
  const w = meta.width || 1440;
  const h = meta.height || 900;

  const strokeColor = '#2563EB';
  const badgeColor = '#2563EB';
  const strokeWidth = 3;
  const radius = 6;
  const badgeRadius = 14;

  let svgElements = '';

  for (const c of callouts) {
    const bx = Math.max(2, Math.min(w - 10, c.x));
    const by = Math.max(2, Math.min(h - 10, c.y));
    const bw = Math.min(w - bx - 2, Math.max(10, c.width));
    const bh = Math.min(h - by - 2, Math.max(10, c.height));

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
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      ${svgElements}
    </svg>
  `;

  await sharp(sourcePath)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(targetPath);
}

async function loginUser(page: Page, email: string) {
  console.log(`[LOGIN] Logging in as ${email}...`);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('#admin-email', { state: 'visible', timeout: 60000 });
      await page.waitForTimeout(500);
      await page.fill('#admin-email', email);
      await page.fill('#admin-password', 'Password123!');
      await page.waitForTimeout(300);

      await page.evaluate(() => {
        const btn = document.querySelector('form button[type="submit"]') as HTMLButtonElement;
        if (btn) btn.click();
      });

      await page.waitForURL('**/dashboard**', { timeout: 15000 });
      console.log(`[LOGIN] Logged in as ${email}!`);
      await page.waitForTimeout(1000);
      return;
    } catch (err) {
      console.log(`[LOGIN] Attempt ${attempt} failed, retrying...`);
      await page.waitForTimeout(2000);
    }
  }
  // Final fallback
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1000);
}

async function main() {
  await ensureDirs();

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await ctx.addCookies([
    {
      name: 'selected_centre_id',
      value: OAKRIDGE_CENTRE_ID,
      url: BASE_URL,
    },
  ]);

  const page = await ctx.newPage();

  // Login as Eleanor Vance (ORG_OWNER)
  await loginUser(page, 'eleanor.vance@example.test');

  const annotationsMap: Record<string, Annotation[]> = {};

  // -------------------------------------------------------------
  // SS-D6-S031: Detailed Invoice View & Payment History (INV-2026-001)
  // -------------------------------------------------------------
  console.log('[CAPTURE] SS-D6-S031: Detailed Invoice View & Payment History...');
  await page.goto(`${BASE_URL}/dashboard/finance/invoices/b30613b0-bd03-451a-a71d-c5175a013d2b`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('text=INV-2026-001', { timeout: 60000 });
  await page.waitForTimeout(1000);

  const s31Source = path.join(OUT_SOURCE, 'SS-D6-S031-source.png');
  const s31Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S031.png');
  await page.screenshot({ path: s31Source });

  const s31_header = await page.evaluate(() => {
    const el = document.querySelector('h1');
    if (!el) return { x: 230, y: 280, width: 280, height: 110 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 12, y: r.y - 12, width: r.width + 24, height: r.height + 45 };
  });

  const s31_total = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).find(d => d.textContent?.trim().startsWith('TOTAL AMOUNT') && d.textContent?.includes('£280.00'));
    if (!el) return { x: 510, y: 280, width: 220, height: 110 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 8, y: r.y - 8, width: r.width + 16, height: r.height + 16 };
  });

  const s31_summary = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).find(d => d.textContent?.startsWith('Summary') && d.textContent?.includes('Total Billed') && d.textContent?.includes('£0.00'));
    if (!el) return { x: 720, y: 230, width: 290, height: 320 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  annotationsMap['SS-D6-S031'] = [
    { x: s31_header.x, y: s31_header.y, width: s31_header.width, height: s31_header.height, badge: 1 },
    { x: s31_total.x, y: s31_total.y, width: s31_total.width, height: s31_total.height, badge: 2 },
    { x: s31_summary.x, y: s31_summary.y, width: s31_summary.width, height: s31_summary.height, badge: 3 },
  ];
  await annotateImage(s31Source, s31Annotated, annotationsMap['SS-D6-S031']);

  // -------------------------------------------------------------
  // SS-D6-S032: Offline Cash Payment Recording Dialog (INV-2026-003)
  // -------------------------------------------------------------
  console.log('[CAPTURE] SS-D6-S032: Offline Cash Payment Recording Dialog...');
  await page.goto(`${BASE_URL}/dashboard/finance/invoices/500ee9d0-71f6-48d0-bebb-fa67cc427e8f`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('text=Record Payment', { timeout: 60000 });
  await page.click('button:has-text("Record Payment")');
  await page.waitForSelector('h2:has-text("Record Payment")', { timeout: 60000 });
  await page.waitForTimeout(500);

  // Click Cash method
  await page.evaluate(() => {
    const cashBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Cash'));
    if (cashBtn) cashBtn.click();
  });
  await page.waitForTimeout(300);

  // Fill reference
  await page.fill('input[placeholder*="Bank Ref"]', 'CASH-REC-001');

  const s32Source = path.join(OUT_SOURCE, 'SS-D6-S032-source.png');
  const s32Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S032.png');
  await page.screenshot({ path: s32Source });

  const s32_modal = await page.evaluate(() => {
    const el = document.querySelector('div.fixed.inset-0 > div');
    if (!el) return { x: 465, y: 95, width: 510, height: 710 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  const s32_cash = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Cash'));
    if (!el) return { x: 725, y: 420, width: 220, height: 60 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  const s32_btn = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Record Payment') && b.getAttribute('type') === 'submit');
    if (!el) return { x: 760, y: 840, width: 180, height: 48 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 4, y: r.y - 4, width: r.width + 8, height: r.height + 8 };
  });

  annotationsMap['SS-D6-S032'] = [
    { x: s32_modal.x, y: s32_modal.y, width: s32_modal.width, height: s32_modal.height, badge: 1 },
    { x: s32_cash.x, y: s32_cash.y, width: s32_cash.width, height: s32_cash.height, badge: 2 },
    { x: s32_btn.x, y: s32_btn.y, width: s32_btn.width, height: s32_btn.height, badge: 3 },
  ];
  await annotateImage(s32Source, s32Annotated, annotationsMap['SS-D6-S032']);

  // -------------------------------------------------------------
  // SS-D6-S033: Offline Bank Transfer Payment Recording (INV-2026-003)
  // -------------------------------------------------------------
  console.log('[CAPTURE] SS-D6-S033: Offline Bank Transfer Payment Recording...');
  // Click Bank Transfer method
  await page.evaluate(() => {
    const btBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Bank Transfer'));
    if (btBtn) btBtn.click();
  });
  await page.waitForTimeout(300);
  await page.fill('input[placeholder*="Bank Ref"]', 'BACS-WALKER-SEP');

  const s33Source = path.join(OUT_SOURCE, 'SS-D6-S033-source.png');
  const s33Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S033.png');
  await page.screenshot({ path: s33Source });

  const s33_bt = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Bank Transfer'));
    if (!el) return { x: 495, y: 420, width: 220, height: 60 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  const s33_ref = await page.evaluate(() => {
    const el = document.querySelector('input[placeholder*="Bank Ref"]');
    if (!el) return { x: 495, y: 720, width: 450, height: 50 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  annotationsMap['SS-D6-S033'] = [
    { x: s32_modal.x, y: s32_modal.y, width: s32_modal.width, height: s32_modal.height, badge: 1 },
    { x: s33_bt.x, y: s33_bt.y, width: s33_bt.width, height: s33_bt.height, badge: 2 },
    { x: s33_ref.x, y: s33_ref.y, width: s33_ref.width, height: s33_ref.height, badge: 3 },
  ];
  await annotateImage(s33Source, s33Annotated, annotationsMap['SS-D6-S033']);

  // -------------------------------------------------------------
  // SS-D6-S034: Childcare Voucher & TFC Verification Triage
  // -------------------------------------------------------------
  console.log('[CAPTURE] SS-D6-S034: Childcare Voucher & TFC Verification Triage...');
  await page.goto(`${BASE_URL}/dashboard/finance/reconciliation`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('text=Pending Invoices', { timeout: 60000 });
  await page.waitForTimeout(500);

  // Select first pending invoice
  await page.evaluate(() => {
    const btn = document.querySelector('div.max-h-\\[600px\\] button') as HTMLElement;
    if (btn) btn.click();
  });
  await page.waitForTimeout(400);

  // Fill in form inputs cleanly without touching navbar search
  await page.evaluate(() => {
    const amountInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    if (amountInput) {
      amountInput.value = '70.00';
      amountInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const refInput = Array.from(document.querySelectorAll('div.space-y-5 input[type="text"]'))[0] as HTMLInputElement;
    if (refInput) {
      refInput.value = 'TFC-PATEL-889';
      refInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await page.waitForTimeout(300);

  const s34Source = path.join(OUT_SOURCE, 'SS-D6-S034-source.png');
  const s34Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S034.png');
  await page.screenshot({ path: s34Source });

  const s34_list = await page.evaluate(() => {
    const el = document.querySelector('div.max-h-\\[600px\\]');
    if (!el) return { x: 205, y: 280, width: 375, height: 100 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  const s34_methods = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).find(d => d.textContent?.includes('Tax-Free Childcare') && d.textContent?.includes('Childcare Voucher') && !d.textContent?.includes('Reconciling for'));
    if (!el) return { x: 608, y: 430, width: 345, height: 180 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  const s34_btn = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Reconcile Payment'));
    if (!el) return { x: 608, y: 870, width: 345, height: 45 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  annotationsMap['SS-D6-S034'] = [
    { x: s34_list.x, y: s34_list.y, width: s34_list.width, height: s34_list.height, badge: 1 },
    { x: s34_methods.x, y: s34_methods.y, width: s34_methods.width, height: s34_methods.height, badge: 2 },
    { x: s34_btn.x, y: s34_btn.y, width: s34_btn.width, height: s34_btn.height, badge: 3 },
  ];
  await annotateImage(s34Source, s34Annotated, annotationsMap['SS-D6-S034']);

  // -------------------------------------------------------------
  // SS-D6-S035: Partial Payment Invoice State Display (INV-2026-002)
  // -------------------------------------------------------------
  console.log('[CAPTURE] SS-D6-S035: Partial Payment Invoice State Display...');
  await page.goto(`${BASE_URL}/dashboard/finance/invoices/eff04804-56bd-4bfe-a127-0513b61f6334`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('text=INV-2026-002', { timeout: 60000 });
  await page.waitForTimeout(1000);

  const s35Source = path.join(OUT_SOURCE, 'SS-D6-S035-source.png');
  const s35Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S035.png');
  await page.screenshot({ path: s35Source });

  const s35_badge = await page.evaluate(() => {
    const el = document.querySelector('h1');
    if (!el) return { x: 230, y: 280, width: 280, height: 110 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 12, y: r.y - 12, width: r.width + 24, height: r.height + 45 };
  });

  const s35_total = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).find(d => d.textContent?.trim().startsWith('TOTAL AMOUNT') && d.textContent?.includes('£140.00'));
    if (!el) return { x: 510, y: 280, width: 220, height: 110 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 8, y: r.y - 8, width: r.width + 16, height: r.height + 16 };
  });

  const s35_summary = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).find(d => d.textContent?.startsWith('Summary') && d.textContent?.includes('Total Paid') && d.textContent?.includes('£70.00'));
    if (!el) return { x: 720, y: 230, width: 290, height: 320 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  annotationsMap['SS-D6-S035'] = [
    { x: s35_badge.x, y: s35_badge.y, width: s35_badge.width, height: s35_badge.height, badge: 1 },
    { x: s35_total.x, y: s35_total.y, width: s35_total.width, height: s35_total.height, badge: 2 },
    { x: s35_summary.x, y: s35_summary.y, width: s35_summary.width, height: s35_summary.height, badge: 3 },
  ];
  await annotateImage(s35Source, s35Annotated, annotationsMap['SS-D6-S035']);

  // -------------------------------------------------------------
  // SS-D6-S036: Payment Confirmation PDF Receipt
  // -------------------------------------------------------------
  console.log('[CAPTURE] SS-D6-S036: Payment Confirmation PDF Receipt...');
  await page.goto(`${BASE_URL}/dashboard/finance/receipt`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('text=Cash Receipt Generator', { timeout: 60000 });
  await page.waitForTimeout(500);

  // Select Oliver Jenkins
  await page.evaluate(() => {
    const sel = document.querySelector('select') as HTMLSelectElement;
    if (sel) {
      const opt = Array.from(sel.options).find(o => o.text.includes('Oliver Jenkins'));
      if (opt) {
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });
  await page.waitForTimeout(400);

  const s36Source = path.join(OUT_SOURCE, 'SS-D6-S036-source.png');
  const s36Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S036.png');
  await page.screenshot({ path: s36Source });

  const s36_form = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div.border')).find(d => d.textContent?.includes('Receipt Details') && d.textContent?.includes('RECEIPT NO'));
    if (!el) return { x: 210, y: 235, width: 300, height: 760 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  const s36_slip = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div.bg-white, div.shadow-2xl')).find(d => d.textContent?.includes('OFFICIAL RECEIPT') && d.textContent?.includes('ELEANOR VANCE'));
    if (!el) return { x: 540, y: 295, width: 400, height: 560 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  const s36_print = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Print') || b.textContent?.includes('Save PDF'));
    if (!el) return { x: 830, y: 235, width: 115, height: 45 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 4, y: r.y - 4, width: r.width + 8, height: r.height + 8 };
  });

  annotationsMap['SS-D6-S036'] = [
    { x: s36_form.x, y: s36_form.y, width: s36_form.width, height: s36_form.height, badge: 1 },
    { x: s36_slip.x, y: s36_slip.y, width: s36_slip.width, height: s36_slip.height, badge: 2 },
    { x: s36_print.x, y: s36_print.y, width: s36_print.width, height: s36_print.height, badge: 3 },
  ];
  await annotateImage(s36Source, s36Annotated, annotationsMap['SS-D6-S036']);

  // -------------------------------------------------------------
  // SS-D6-S037: Multi-Centre Venue Directory
  // -------------------------------------------------------------
  console.log('[CAPTURE] SS-D6-S037: Multi-Centre Venue Directory...');
  await page.goto(`${BASE_URL}/dashboard/centres`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('text=Centres', { timeout: 60000 });
  await page.waitForTimeout(500);

  const s37Source = path.join(OUT_SOURCE, 'SS-D6-S037-source.png');
  const s37Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S037.png');
  await page.screenshot({ path: s37Source });

  const s37_header = await page.evaluate(() => {
    const el = document.querySelector('div.bg-surface');
    if (!el) return { x: 185, y: 100, width: 800, height: 45 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: 48 };
  });

  const s37_c1 = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('tr, div.flex.items-center.justify-between, div.group')).find(d => d.textContent?.includes('Oakridge Central') && d.textContent?.includes('EY123456'));
    if (!el) return { x: 185, y: 160, width: 800, height: 90 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  const s37_c2 = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('tr, div.flex.items-center.justify-between, div.group')).find(d => d.textContent?.includes('Oakridge Riverside') && d.textContent?.includes('EY654321'));
    if (!el) return { x: 185, y: 260, width: 800, height: 90 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  annotationsMap['SS-D6-S037'] = [
    { x: s37_header.x, y: s37_header.y, width: s37_header.width, height: s37_header.height, badge: 1 },
    { x: s37_c1.x, y: s37_c1.y, width: s37_c1.width, height: s37_c1.height, badge: 2 },
    { x: s37_c2.x, y: s37_c2.y, width: s37_c2.width, height: s37_c2.height, badge: 3 },
  ];
  await annotateImage(s37Source, s37Annotated, annotationsMap['SS-D6-S037']);

  // -------------------------------------------------------------
  // SS-D6-S038: Centre General Settings & Capacity
  // -------------------------------------------------------------
  console.log('[CAPTURE] SS-D6-S038: Centre General Settings & Capacity...');
  await page.goto(`${BASE_URL}/dashboard/centres/${OAKRIDGE_CENTRE_ID}/settings`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('text=Oakridge Central', { timeout: 60000 });
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent?.includes('Sessions'));
    if (b) (b as HTMLElement).click();
  });
  await page.waitForTimeout(500);

  const s38Source = path.join(OUT_SOURCE, 'SS-D6-S038-source.png');
  const s38Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S038.png');
  await page.screenshot({ path: s38Source });

  const s38_tabs = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).find(d => d.textContent?.includes('General') && d.textContent?.includes('Sessions') && d.textContent?.includes('Billing') && d.children.length === 3);
    if (!el) return { x: 270, y: 230, width: 240, height: 48 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  const s38_session1 = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div.border, div.rounded-2xl')).find(d => d.textContent?.includes('Breakfast Club') && d.textContent?.includes('07:30'));
    if (!el) return { x: 288, y: 400, width: 590, height: 280 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  const s38_session2 = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div.border, div.rounded-2xl')).find(d => d.textContent?.includes('After School') && d.textContent?.includes('15:30'));
    if (!el) return { x: 288, y: 690, width: 590, height: 270 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  annotationsMap['SS-D6-S038'] = [
    { x: s38_tabs.x, y: s38_tabs.y, width: s38_tabs.width, height: s38_tabs.height, badge: 1 },
    { x: s38_session1.x, y: s38_session1.y, width: s38_session1.width, height: s38_session1.height, badge: 2 },
    { x: s38_session2.x, y: s38_session2.y, width: s38_session2.width, height: s38_session2.height, badge: 3 },
  ];
  await annotateImage(s38Source, s38Annotated, annotationsMap['SS-D6-S038']);

  // -------------------------------------------------------------
  // SS-D6-S039: Centre Bank Details Card (Owner-Only)
  // -------------------------------------------------------------
  console.log('[CAPTURE] SS-D6-S039: Centre Bank Details Card (Owner-Only)...');
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent?.includes('Billing'));
    if (b) (b as HTMLElement).click();
  });
  await page.waitForTimeout(500);

  const s39Source = path.join(OUT_SOURCE, 'SS-D6-S039-source.png');
  const s39Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S039.png');
  await page.screenshot({ path: s39Source });

  const s39_fees = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div.border, div.rounded-2xl')).find(d => d.textContent?.includes('Financial configuration') && d.textContent?.includes('SELF-FINANCE FEE'));
    if (!el) return { x: 270, y: 300, width: 625, height: 160 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: 160 };
  });

  const s39_bankName = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div')).find(d => d.textContent?.includes('Bank details') && d.textContent?.includes('BANK NAME') && d.querySelector('input'));
    if (!el) return { x: 270, y: 470, width: 625, height: 120 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: 120 };
  });

  const s39_sortCode = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div.grid.grid-cols-2')).find(d => d.textContent?.includes('SORT CODE') && d.textContent?.includes('ACCOUNT NUMBER'));
    if (!el) return { x: 288, y: 600, width: 468, height: 70 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  annotationsMap['SS-D6-S039'] = [
    { x: s39_fees.x, y: s39_fees.y, width: s39_fees.width, height: s39_fees.height, badge: 1 },
    { x: s39_bankName.x, y: s39_bankName.y, width: s39_bankName.width, height: s39_bankName.height, badge: 2 },
    { x: s39_sortCode.x, y: s39_sortCode.y, width: s39_sortCode.width, height: s39_sortCode.height, badge: 3 },
  ];
  await annotateImage(s39Source, s39Annotated, annotationsMap['SS-D6-S039']);

  // -------------------------------------------------------------
  // SS-D6-S040: Staff Directory & Role Badges
  // -------------------------------------------------------------
  console.log('[CAPTURE] SS-D6-S040: Staff Directory & Role Badges...');
  await page.goto(`${BASE_URL}/dashboard/staff`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('text=Active Staff', { timeout: 60000 });
  await page.waitForTimeout(1000);

  const s40Source = path.join(OUT_SOURCE, 'SS-D6-S040-source.png');
  const s40Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S040.png');
  await page.screenshot({ path: s40Source });

  const s40_header = await page.evaluate(() => {
    const el = document.querySelector('div.grid.grid-cols-2.md\\:grid-cols-4') || document.querySelector('div.grid.grid-cols-2');
    if (!el) return { x: 188, y: 98, width: 792, height: 88 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  const s40_staffCard = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('tbody tr')).find(tr => tr.textContent?.includes('Eleanor Vance'));
    if (!el) return { x: 188, y: 618, width: 790, height: 75 };
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  const s40_roleBadge = await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('tbody tr')).find(tr => tr.textContent?.includes('Eleanor Vance'));
    const badge = row?.querySelectorAll('td')[1];
    if (!badge) return { x: 480, y: 625, width: 130, height: 60 };
    const r = badge.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  annotationsMap['SS-D6-S040'] = [
    { x: s40_header.x, y: s40_header.y, width: s40_header.width, height: s40_header.height, badge: 1 },
    { x: s40_staffCard.x, y: s40_staffCard.y, width: s40_staffCard.width, height: s40_staffCard.height, badge: 2 },
    { x: s40_roleBadge.x, y: s40_roleBadge.y, width: s40_roleBadge.width, height: s40_roleBadge.height, badge: 3 },
  ];
  await annotateImage(s40Source, s40Annotated, annotationsMap['SS-D6-S040']);

  // -------------------------------------------------------------
  // Generate Batch 4 Contact Sheet
  // -------------------------------------------------------------
  console.log('[REVIEW] Generating Batch 4 Contact Sheet...');
  const assetIds = [
    'SS-D6-S031', 'SS-D6-S032', 'SS-D6-S033', 'SS-D6-S034', 'SS-D6-S035',
    'SS-D6-S036', 'SS-D6-S037', 'SS-D6-S038', 'SS-D6-S039', 'SS-D6-S040'
  ];

  const titles: Record<string, string> = {
    'SS-D6-S031': 'Detailed Invoice View & Payment History',
    'SS-D6-S032': 'Offline Cash Payment Recording Dialog',
    'SS-D6-S033': 'Offline Bank Transfer Payment Recording',
    'SS-D6-S034': 'Childcare Voucher & TFC Verification Triage',
    'SS-D6-S035': 'Partial Payment Invoice State Display',
    'SS-D6-S036': 'Payment Confirmation PDF Receipt',
    'SS-D6-S037': 'Multi-Centre Venue Directory',
    'SS-D6-S038': 'Centre General Settings & Capacity',
    'SS-D6-S039': 'Centre Bank Details Card (Owner-Only)',
    'SS-D6-S040': 'Staff Directory & Role Badges'
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
      <text x="30" y="45" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="bold" fill="#F8FAFC">SprintScale CMS — Milestone D6B Batch 4 Visual Review</text>
      <text x="30" y="68" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#94A3B8">Essential Screenshots SS-D6-S031 → SS-D6-S040 | Oakridge Learning Trust | Verified Synthetic Data</text>
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

  const contactSheetPath = path.join(OUT_REVIEW, 'd6b-batch-4-contact-sheet.png');
  await sharp(Buffer.from(bannerSvg))
    .composite(composites)
    .png()
    .toFile(contactSheetPath);

  console.log(`[SUCCESS] Batch 4 Contact sheet generated at: ${contactSheetPath}`);

  await browser.close();
}

main().catch(console.error);
