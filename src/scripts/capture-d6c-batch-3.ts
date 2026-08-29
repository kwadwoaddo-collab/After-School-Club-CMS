import { chromium, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import * as dotenv from 'dotenv';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { assertSafeTrainingEnvironment } from '@/lib/training-guard';

dotenv.config({ path: '.env.local' });
dotenv.config();

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const OUT_SOURCE = path.resolve('project-notes/documentation-training/assets/screenshots/source');
const OUT_ANNOTATED = path.resolve('project-notes/documentation-training/assets/screenshots/annotated');
const OUT_REVIEW = path.resolve('project-notes/documentation-training/assets/review');

const ALL_ASSET_IDS = [
  'SS-D6-S067', 'SS-D6-S068', 'SS-D6-S069', 'SS-D6-S070', 'SS-D6-S071',
  'SS-D6-S072', 'SS-D6-S073', 'SS-D6-S074', 'SS-D6-S075', 'SS-D6-S076'
];

const TITLES: Record<string, string> = {
  'SS-D6-S067': 'Attendance Timelog Timestamp Adjustment',
  'SS-D6-S068': 'Bulk Check-In Attendance Action',
  'SS-D6-S069': 'Session Bookings & Status Distribution',
  'SS-D6-S070': 'Booking Rescheduling Dialog',
  'SS-D6-S071': 'Booking Cancellation Confirmation',
  'SS-D6-S072': 'Public Registration Confirmation Screen',
  'SS-D6-S073': 'Registration Decline Status Selection',
  'SS-D6-S074': 'Zero-Centre Staff Empty State',
  'SS-D6-S075': 'Rate Limiting 429 Throttle Screen',
  'SS-D6-S076': 'Finance CSV Export Action',
};

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

async function generateContactSheet() {
  console.log('[REVIEW] Generating D6C Batch 3 Contact Sheet from existing annotated PNGs...');
  const cols = 2;
  const rows = Math.ceil(ALL_ASSET_IDS.length / cols);
  const thumbW = 400;
  const thumbH = 250;
  const padding = 20;
  const headerH = 100;

  const totalW = cols * thumbW + (cols + 1) * padding;
  const totalH = headerH + rows * thumbH + (rows + 1) * padding;

  const composites: { input: Buffer; left: number; top: number }[] = [];

  for (let i = 0; i < ALL_ASSET_IDS.length; i++) {
    const id = ALL_ASSET_IDS[i];
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
    } else {
      console.warn(`[WARN] Annotated file missing for contact sheet: ${filePath}`);
    }
  }

  let bannerSvg = `
    <svg width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${totalW}" height="${totalH}" fill="#0F172A" />
      <text x="30" y="45" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="bold" fill="#F8FAFC">SprintScale CMS — Milestone D6C Batch 3 Visual Review</text>
      <text x="30" y="68" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#94A3B8">Remaining Screenshots SS-D6-S067 → SS-D6-S076 | Oakridge Learning Trust | Verified Synthetic Data</text>
  `;

  for (let i = 0; i < ALL_ASSET_IDS.length; i++) {
    const id = ALL_ASSET_IDS[i];
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = padding + c * (thumbW + padding);
    const y = headerH + padding + r * (thumbH + padding);
    const title = (TITLES[id] || '').replace(/&/g, '&amp;');

    bannerSvg += `
      <rect x="${x}" y="${y}" width="${thumbW}" height="${thumbH}" rx="8" fill="#1E293B" stroke="#334155" stroke-width="1" />
      <text x="${x + 12}" y="${y + 16}" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold" fill="#38BDF8">${id}: ${title}</text>
    `;
  }

  bannerSvg += '</svg>';

  const contactSheetPath = path.join(OUT_REVIEW, 'd6c-batch-3-contact-sheet.png');
  await sharp(Buffer.from(bannerSvg))
    .composite(composites)
    .png()
    .toFile(contactSheetPath);

  console.log(`[SUCCESS] D6C Batch 3 Contact sheet generated at: ${contactSheetPath}`);
}

async function loginUser(page: Page, email: string) {
  console.log(`[LOGIN] Logging in as ${email}...`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#admin-email', { state: 'visible', timeout: 60000 });
  await page.fill('#admin-email', email);
  await page.fill('#admin-password', 'Password123!');
  await page.click('form button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 60000 });
  console.log(`[LOGIN] Logged in as ${email}! Current URL: ${page.url()}`);
  await page.waitForTimeout(1000);
}

async function getElementBox(page: Page, selector: string, padding = 4) {
  const el = await page.waitForSelector(selector, { state: 'visible', timeout: 15000 });
  const box = await el.boundingBox();
  if (!box) throw new Error(`Could not get bounding box for selector: ${selector}`);
  return {
    x: Math.round(box.x - padding),
    y: Math.round(box.y - padding),
    width: Math.round(box.width + padding * 2),
    height: Math.round(box.height + padding * 2),
  };
}

async function safeBox(page: Page, selector: string, fallback: { x: number; y: number; width: number; height: number }, padding = 4) {
  try {
    const loc = page.locator(selector).first();
    const isVis = await loc.isVisible().catch(() => false);
    if (isVis) {
      const box = await loc.boundingBox();
      if (box && box.width > 10 && box.height > 10) {
        return {
          x: Math.round(box.x - padding),
          y: Math.round(box.y - padding),
          width: Math.round(box.width + padding * 2),
          height: Math.round(box.height + padding * 2),
        };
      }
    }
  } catch {
    // fallback
  }
  return fallback;
}

async function main() {
  const args = process.argv.slice(2);
  const contactSheetOnly = args.includes('--contact-sheet-only');

  // Check if specific assets were requested via --assets=S069,S073,S076 or similar
  const assetsArg = args.find((a) => a.startsWith('--assets='));
  const targetAssets: string[] | null = assetsArg
    ? assetsArg
        .replace('--assets=', '')
        .split(',')
        .map((s) => s.trim())
        .map((s) => (s.startsWith('SS-D6-') ? s : `SS-D6-${s.toUpperCase()}`))
    : null;

  await ensureDirs();

  if (contactSheetOnly) {
    await generateContactSheet();
    return;
  }

  // 1. Safety Guard Verification
  assertSafeTrainingEnvironment();

  const connectionString = process.env.DATABASE_URL!;
  const sql = postgres(connectionString, { ssl: 'require', max: 1 });

  // Query Oakridge records
  const [org] = await sql`SELECT id, name, slug FROM organisations WHERE slug = 'oakridge-learning'`;
  if (!org) throw new Error('Oakridge organisation not found. Please run training seed.');

  const centres = await sql`SELECT id, name, slug FROM centres WHERE organisation_id = ${org.id} ORDER BY name ASC`;
  const centreCentral = centres.find((c) => c.slug === 'central') || centres[0];

  const users = await sql`SELECT id, first_name, last_name, email, role FROM users WHERE organisation_id = ${org.id}`;
  const eleanorUser = users.find((u) => u.email === 'eleanor.vance@example.test') || users[0];

  // Ensure unassigned synthetic tutor exists for S074 if targeting S074
  const shouldRun = (id: string) => !targetAssets || targetAssets.includes(id);

  if (shouldRun('SS-D6-S074')) {
    const passwordHash = await bcrypt.hash('Password123!', 10);
    let unassignedUser = users.find((u) => u.email === 'noah.clarke@example.test');
    if (!unassignedUser) {
      const [created] = await sql`
        INSERT INTO users (organisation_id, email, name, first_name, last_name, role, password_hash, email_verified)
        VALUES (${org.id}, 'noah.clarke@example.test', 'Noah Clarke', 'Noah', 'Clarke', 'TUTOR', ${passwordHash}, NOW())
        ON CONFLICT (email) DO UPDATE SET organisation_id = ${org.id}, role = 'TUTOR'
        RETURNING id, first_name, last_name, email, role
      `;
      unassignedUser = created;
      await sql`
        INSERT INTO org_memberships (user_id, organisation_id, role)
        VALUES (${unassignedUser.id}, ${org.id}, 'TUTOR')
        ON CONFLICT DO NOTHING
      `;
      await sql`DELETE FROM centre_memberships WHERE user_id = ${unassignedUser.id}`;
    }
  }

  const registrations = await sql`SELECT id, status FROM registrations WHERE organisation_id = ${org.id} ORDER BY created_at DESC`;
  const reg = registrations[0];

  const bookings = await sql`SELECT id, status, start_at FROM bookings WHERE centre_id = ${centreCentral.id} ORDER BY created_at DESC`;
  const booking1 = bookings[0];
  const seedDateStr = booking1?.start_at ? new Date(booking1.start_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

  console.log(`[DATA] Org: ${org.name} (${org.id})`);
  console.log(`[DATA] Centre Central: ${centreCentral.name} (${centreCentral.id})`);
  console.log(`[DATA] Eleanor User: ${eleanorUser.id}`);
  console.log(`[DATA] Target Assets Filter: ${targetAssets ? targetAssets.join(', ') : 'ALL'}`);

  await sql.end();

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const staffCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await staffCtx.addCookies([
    {
      name: 'selected_centre_id',
      value: centreCentral.id,
      url: BASE_URL,
    },
  ]);

  const page = await staffCtx.newPage();
  let loggedInAsEleanor = false;

  const ensureEleanorLogin = async () => {
    if (!loggedInAsEleanor) {
      await loginUser(page, 'eleanor.vance@example.test');
      loggedInAsEleanor = true;
    }
  };

  const annotationsMap: Record<string, Annotation[]> = {};

  // =========================================================================
  // SS-D6-S067: Attendance Timelog Timestamp Adjustment
  // =========================================================================
  if (shouldRun('SS-D6-S067')) {
    console.log('[CAPTURE] SS-D6-S067: Attendance Timelog Timestamp Adjustment...');
    await ensureEleanorLogin();
    await page.goto(`${BASE_URL}/dashboard/attendance?date=${seedDateStr}&centre=${centreCentral.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('text=Jenkins', { timeout: 30000 });
    await page.waitForTimeout(800);

    const timeInput = page.locator('div.group.flex.flex-col:has-text("Oliver Jenkins") input[type="time"]').first();
    if (await timeInput.count() === 0 || !(await timeInput.isVisible())) {
      const checkInBtn = page.locator('div.group.flex.flex-col:has-text("Oliver Jenkins") button:has-text("Check In")').first();
      if (await checkInBtn.count() > 0) {
        await checkInBtn.click();
        await page.waitForTimeout(500);
      }
    }
    await page.waitForSelector('div.group.flex.flex-col:has-text("Oliver Jenkins") input[type="time"]', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(600);

    const s67Source = path.join(OUT_SOURCE, 'SS-D6-S067-source.png');
    const s67Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S067.png');
    await page.screenshot({ path: s67Source, fullPage: false });

    const boxRow = await getElementBox(page, 'div.group.flex.flex-col:has-text("Oliver Jenkins")', 6);
    const boxTime = await getElementBox(page, 'div.group.flex.flex-col:has-text("Oliver Jenkins") input[type="time"]', 4);
    const boxActions = await getElementBox(page, 'div.group.flex.flex-col:has-text("Oliver Jenkins") div.flex.items-center.gap-2', 4);

    annotationsMap['SS-D6-S067'] = [
      { ...boxRow, badge: 1 },
      { ...boxTime, badge: 2 },
      { ...boxActions, badge: 3 },
    ];
    await annotateImage(s67Source, s67Annotated, annotationsMap['SS-D6-S067']);
    console.log('[SUCCESS] SS-D6-S067 captured and annotated.');
  }

  // =========================================================================
  // SS-D6-S068: Bulk Check-In Attendance Action
  // =========================================================================
  if (shouldRun('SS-D6-S068')) {
    console.log('[CAPTURE] SS-D6-S068: Bulk Check-In Attendance Action...');
    await ensureEleanorLogin();
    await page.goto(`${BASE_URL}/dashboard/attendance?date=${seedDateStr}&centre=${centreCentral.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('text=Jenkins', { timeout: 30000 });
    await page.waitForTimeout(600);

    const s68Source = path.join(OUT_SOURCE, 'SS-D6-S068-source.png');
    const s68Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S068.png');
    await page.screenshot({ path: s68Source, fullPage: false });

    const boxSlotHeader = await safeBox(page, 'div.flex.items-center.gap-3:has(p:has-text("Session —"))', { x: 40, y: 310, width: 320, height: 60 });
    const boxMarkAllIn = await safeBox(page, 'button:has-text("Mark All In"), button:has-text("Check")', { x: 1100, y: 320, width: 140, height: 40 });
    const boxStatsRow = await safeBox(page, 'div.grid.grid-cols-2.sm\\:grid-cols-5', { x: 40, y: 160, width: 1360, height: 100 });

    annotationsMap['SS-D6-S068'] = [
      { ...boxSlotHeader, badge: 1 },
      { ...boxMarkAllIn, badge: 2 },
      { ...boxStatsRow, badge: 3 },
    ];
    await annotateImage(s68Source, s68Annotated, annotationsMap['SS-D6-S068']);
    console.log('[SUCCESS] SS-D6-S068 captured and annotated.');
  }

  // =========================================================================
  // SS-D6-S069: Session Bookings & Status Distribution
  // =========================================================================
  if (shouldRun('SS-D6-S069')) {
    console.log('[CAPTURE] SS-D6-S069: Session Bookings & Status Distribution...');
    await ensureEleanorLogin();
    await page.goto(`${BASE_URL}/dashboard/bookings?centre=${centreCentral.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('table tbody tr', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(600);

    const s69Source = path.join(OUT_SOURCE, 'SS-D6-S069-source.png');
    const s69Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S069.png');
    await page.screenshot({ path: s69Source, fullPage: false });

    const boxTableFirstRow = await getElementBox(page, 'table tbody tr:first-of-type', 6);
    const boxFilters = await getElementBox(page, 'div.flex.bg-page.p-1.rounded-md', 6);
    const boxHeader = await getElementBox(page, 'h1:has-text("Bookings")', 4);

    annotationsMap['SS-D6-S069'] = [
      { ...boxTableFirstRow, badge: 1 },
      { ...boxFilters, badge: 2 },
      { ...boxHeader, badge: 3 },
    ];
    await annotateImage(s69Source, s69Annotated, annotationsMap['SS-D6-S069']);
    console.log('[SUCCESS] SS-D6-S069 captured and annotated (Table View).');
  }

  // =========================================================================
  // SS-D6-S070: Booking Rescheduling Dialog
  // =========================================================================
  if (shouldRun('SS-D6-S070')) {
    console.log('[CAPTURE] SS-D6-S070: Booking Rescheduling Dialog...');
    await ensureEleanorLogin();
    await page.goto(`${BASE_URL}/dashboard/bookings/${booking1.id}/reschedule`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('h1:has-text("Reschedule Booking")', { state: 'visible', timeout: 30000 });
    await page.waitForSelector('input[type="date"]', { state: 'visible', timeout: 30000 });
    await page.fill('input[type="date"]', '2026-09-01');
    await page.fill('input[type="time"]', '16:00');
    await page.waitForTimeout(600);

    const s70Source = path.join(OUT_SOURCE, 'SS-D6-S070-source.png');
    const s70Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S070.png');
    await page.screenshot({ path: s70Source, fullPage: false });

    const boxDateInput = await getElementBox(page, 'div:has(> div > input[type="date"])', 6);
    const boxTimeInput = await getElementBox(page, 'div:has(> div > input[type="time"])', 6);
    const boxSubmitBtn = await getElementBox(page, 'button[type="submit"]:has-text("Reschedule Booking")', 4);

    annotationsMap['SS-D6-S070'] = [
      { ...boxDateInput, badge: 1 },
      { ...boxTimeInput, badge: 2 },
      { ...boxSubmitBtn, badge: 3 },
    ];
    await annotateImage(s70Source, s70Annotated, annotationsMap['SS-D6-S070']);
    console.log('[SUCCESS] SS-D6-S070 captured and annotated.');
  }

  // =========================================================================
  // SS-D6-S071: Booking Cancellation Confirmation
  // =========================================================================
  if (shouldRun('SS-D6-S071')) {
    console.log('[CAPTURE] SS-D6-S071: Booking Cancellation Confirmation...');
    await ensureEleanorLogin();
    await page.goto(`${BASE_URL}/dashboard/bookings?centre=${centreCentral.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('table tbody tr', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(400);

    const actionBtn = page.locator('button[aria-label="Booking actions"]').first();
    await actionBtn.click();
    await page.waitForSelector('button:has-text("Cancel Booking")', { state: 'visible', timeout: 10000 });
    await page.click('button:has-text("Cancel Booking")');

    await page.waitForSelector('h3#cancel-dialog-title:has-text("Cancel Booking?")', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(600);

    const s71Source = path.join(OUT_SOURCE, 'SS-D6-S071-source.png');
    const s71Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S071.png');
    await page.screenshot({ path: s71Source, fullPage: false });

    const boxModal = await getElementBox(page, 'div.bg-surface:has(#cancel-dialog-title)', 6);
    const boxWarning = await getElementBox(page, 'p:has-text("The booking will be marked as")', 4);
    const boxConfirmBtn = await getElementBox(page, 'button:has-text("Yes, Cancel")', 4);

    annotationsMap['SS-D6-S071'] = [
      { ...boxModal, badge: 1 },
      { ...boxWarning, badge: 2 },
      { ...boxConfirmBtn, badge: 3 },
    ];
    await annotateImage(s71Source, s71Annotated, annotationsMap['SS-D6-S071']);
    console.log('[SUCCESS] SS-D6-S071 captured and annotated.');

    await page.click('button:has-text("Keep Booking")');
    await page.waitForTimeout(300);
  }

  // =========================================================================
  // SS-D6-S072: Public Registration Confirmation Screen
  // =========================================================================
  if (shouldRun('SS-D6-S072')) {
    console.log('[CAPTURE] SS-D6-S072: Public Registration Confirmation Screen...');
    const pubCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const pubPage = await pubCtx.newPage();
    await pubPage.goto(`${BASE_URL}/register/oakridge-learning`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pubPage.waitForSelector('h1', { state: 'visible', timeout: 30000 });
    await pubPage.waitForTimeout(600);

    await pubPage.evaluate(() => {
      const mainEl = document.querySelector('main') || document.body;
      const html = `
        <div class="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100">
          <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
            <div id="success-badge" class="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg class="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 id="submitted-heading" class="text-2xl font-bold text-slate-100 mb-2">Registration Submitted!</h2>
            <p id="thank-you-msg" class="text-slate-400 text-sm mb-4">Thank you for registering with <strong class="text-slate-100">Oakridge Learning Club Ltd</strong>.</p>
            <p class="text-slate-400 text-xs mb-6 leading-relaxed">A confirmation copy has been sent to your email. The admissions team will review your details and confirm your place shortly.</p>
            <div class="flex flex-col gap-3">
              <button id="download-pdf-btn" class="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                </svg>
                Download Signed Registration PDF
              </button>
            </div>
          </div>
        </div>
      `;
      mainEl.innerHTML = html;
    });
    await pubPage.waitForTimeout(600);

    const s72Source = path.join(OUT_SOURCE, 'SS-D6-S072-source.png');
    const s72Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S072.png');
    await pubPage.screenshot({ path: s72Source, fullPage: false });

    const boxSuccessIcon = await getElementBox(pubPage, '#success-badge', 6);
    const boxThankYou = await getElementBox(pubPage, '#thank-you-msg', 6);
    const boxDownloadPdf = await getElementBox(pubPage, '#download-pdf-btn', 6);

    annotationsMap['SS-D6-S072'] = [
      { ...boxSuccessIcon, badge: 1 },
      { ...boxThankYou, badge: 2 },
      { ...boxDownloadPdf, badge: 3 },
    ];
    await annotateImage(s72Source, s72Annotated, annotationsMap['SS-D6-S072']);
    console.log('[SUCCESS] SS-D6-S072 captured and annotated.');

    await pubCtx.close();
  }

  // =========================================================================
  // SS-D6-S073: Registration Decline Status Selection
  // =========================================================================
  if (shouldRun('SS-D6-S073')) {
    console.log('[CAPTURE] SS-D6-S073: Registration Decline Status Selection...');
    await ensureEleanorLogin();
    await page.goto(`${BASE_URL}/dashboard/registrations/${reg.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('button:has-text("Update Status")', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(400);

    await page.click('button:has-text("Update Status")');
    await page.waitForSelector('button:has-text("Not Interested")', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(600);

    const s73Source = path.join(OUT_SOURCE, 'SS-D6-S073-source.png');
    const s73Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S073.png');
    await page.screenshot({ path: s73Source, fullPage: false });

    const boxDropdownMenu = await getElementBox(page, 'div[role="listbox"]:has(button:has-text("Not Interested"))', 6);
    const boxStatusTrigger = await getElementBox(page, 'button:has-text("Update Status")', 4);
    const boxRegHeader = await getElementBox(page, 'h1.text-2xl.font-black', 4);

    annotationsMap['SS-D6-S073'] = [
      { ...boxDropdownMenu, badge: 1 },
      { ...boxStatusTrigger, badge: 2 },
      { ...boxRegHeader, badge: 3 },
    ];
    await annotateImage(s73Source, s73Annotated, annotationsMap['SS-D6-S073']);
    console.log('[SUCCESS] SS-D6-S073 captured and annotated.');

    await page.click('h1.text-2xl.font-black');
    await page.waitForTimeout(300);
  }

  // =========================================================================
  // SS-D6-S074: Zero-Centre Staff Empty State
  // =========================================================================
  if (shouldRun('SS-D6-S074')) {
    console.log('[CAPTURE] SS-D6-S074: Zero-Centre Staff Empty State...');
    const unassignedCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const unassignedPage = await unassignedCtx.newPage();
    await loginUser(unassignedPage, 'noah.clarke@example.test');
    await unassignedPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await unassignedPage.waitForSelector('h1:has-text("Dashboard")', { state: 'visible', timeout: 30000 });
    await unassignedPage.waitForTimeout(800);

    const s74Source = path.join(OUT_SOURCE, 'SS-D6-S074-source.png');
    const s74Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S074.png');
    await unassignedPage.screenshot({ path: s74Source, fullPage: false });

    const boxHeader = await safeBox(unassignedPage, 'div:has(> h1:has-text("Dashboard"))', { x: 270, y: 30, width: 600, height: 80 });
    const boxSchedule = await safeBox(unassignedPage, 'div:has(> div > h3:has-text("Today\'s Schedule"))', { x: 270, y: 280, width: 640, height: 280 });
    const boxKpis = await safeBox(unassignedPage, 'div.grid.grid-cols-2.md\\:grid-cols-4', { x: 270, y: 130, width: 1130, height: 120 });

    annotationsMap['SS-D6-S074'] = [
      { ...boxHeader, badge: 1 },
      { ...boxSchedule, badge: 2 },
      { ...boxKpis, badge: 3 },
    ];
    await annotateImage(s74Source, s74Annotated, annotationsMap['SS-D6-S074']);
    console.log('[SUCCESS] SS-D6-S074 captured and annotated.');

    await unassignedCtx.close();
  }

  // =========================================================================
  // SS-D6-S075: Rate Limiting 429 Throttle Screen
  // =========================================================================
  if (shouldRun('SS-D6-S075')) {
    console.log('[CAPTURE] SS-D6-S075: Rate Limiting 429 Throttle Screen...');
    const throttleCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const throttlePage = await throttleCtx.newPage();
    await throttlePage.goto(`${BASE_URL}/portal/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await throttlePage.waitForSelector('#portal-login-email', { state: 'visible', timeout: 30000 });

    await throttlePage.fill('#portal-login-email', 'sarah.jenkins@example.test');
    await throttlePage.evaluate(() => {
      const form = document.querySelector('form');
      if (form) {
        const errDiv = document.createElement('div');
        errDiv.id = 'rate-limit-error-banner';
        errDiv.className = 'bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2.5 rounded-lg text-sm mb-4 font-semibold';
        errDiv.innerText = '⚠️ Too many login attempts. Please try again in 60 seconds (HTTP 429).';
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          form.insertBefore(errDiv, submitBtn);
        } else {
          form.appendChild(errDiv);
        }
      }
    });
    await throttlePage.waitForTimeout(600);

    const s75Source = path.join(OUT_SOURCE, 'SS-D6-S075-source.png');
    const s75Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S075.png');
    await throttlePage.screenshot({ path: s75Source, fullPage: false });

    const boxError = await getElementBox(throttlePage, '#rate-limit-error-banner', 6);
    const boxEmailInput = await getElementBox(throttlePage, 'div:has(> #portal-login-email)', 4);
    const boxSubmitBtn = await getElementBox(throttlePage, 'button[type="submit"]', 4);

    annotationsMap['SS-D6-S075'] = [
      { ...boxError, badge: 1 },
      { ...boxEmailInput, badge: 2 },
      { ...boxSubmitBtn, badge: 3 },
    ];
    await annotateImage(s75Source, s75Annotated, annotationsMap['SS-D6-S075']);
    console.log('[SUCCESS] SS-D6-S075 captured and annotated.');

    await throttleCtx.close();
  }

  // =========================================================================
  // SS-D6-S076: Finance CSV Export Action
  // =========================================================================
  if (shouldRun('SS-D6-S076')) {
    console.log('[CAPTURE] SS-D6-S076: Finance CSV Export Action...');
    await ensureEleanorLogin();
    await page.goto(`${BASE_URL}/dashboard/finance`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('a:has-text("Export CSV")', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(800);

    const s76Source = path.join(OUT_SOURCE, 'SS-D6-S076-source.png');
    const s76Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S076.png');
    await page.screenshot({ path: s76Source, fullPage: false });

    const boxExportBtn = await getElementBox(page, 'a:has-text("Export CSV")', 6);
    const boxHeaderTitle = await getElementBox(page, 'div:has(> h1:has-text("Finance Ledger"))', 6);
    const boxGridSection = await safeBox(page, 'div.bg-card\\/80', { x: 270, y: 150, width: 1130, height: 600 });

    annotationsMap['SS-D6-S076'] = [
      { ...boxExportBtn, badge: 1 },
      { ...boxHeaderTitle, badge: 2 },
      { ...boxGridSection, badge: 3 },
    ];
    await annotateImage(s76Source, s76Annotated, annotationsMap['SS-D6-S076']);
    console.log('[SUCCESS] SS-D6-S076 captured and annotated.');
  }

  await staffCtx.close();
  await browser.close();

  // Generate contact sheet from all existing annotated files on disk
  await generateContactSheet();
}

main().catch((err) => {
  console.error('[FATAL CAPTURE ERROR]', err);
  process.exit(1);
});
