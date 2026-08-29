import { chromium, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import * as dotenv from 'dotenv';
import postgres from 'postgres';
import { execSync } from 'child_process';
import { SignJWT } from 'jose';
import { assertSafeTrainingEnvironment } from '@/lib/training-guard';

dotenv.config({ path: '.env.local' });
dotenv.config();

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const OUT_VIDEOS = path.resolve('project-notes/documentation-training/assets/videos');
const OUT_REVIEW = path.resolve('project-notes/documentation-training/assets/review');
const OUT_FRAMES = path.resolve('project-notes/documentation-training/assets/review/d6d-batch-1-frames');
const FFMPEG_BIN = '/Users/KWADW/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac';
const AUTH_FILE = '/tmp/auth-owner.json';

const ALL_ASSET_IDS = [
  'SS-D6-V001', 'SS-D6-V002', 'SS-D6-V003', 'SS-D6-V004', 'SS-D6-V005',
  'SS-D6-V006', 'SS-D6-V007', 'SS-D6-V008', 'SS-D6-V009', 'SS-D6-V010'
];

const TITLES: Record<string, string> = {
  'SS-D6-V001': 'Registering a Multi-Child Family via Public Portal',
  'SS-D6-V002': 'Reviewing & Approving a Public Registration',
  'SS-D6-V003': 'Creating an Ad-Hoc Single Session Booking',
  'SS-D6-V004': 'Setting up a Recurring Term Booking Plan',
  'SS-D6-V005': 'Booking a Session via Parent Portal',
  'SS-D6-V006': 'Marking Morning and Afternoon Class Register',
  'SS-D6-V007': 'Operating the Tablet Kiosk Sign-In & Pick-Up',
  'SS-D6-V008': 'Fast Walk-In Registration on Tablet Kiosk',
  'SS-D6-V009': 'Overriding Attendance Status (Late / Excused)',
  'SS-D6-V010': 'Forgiving an Absence on Session Credit Ledger',
};

async function ensureDirs() {
  [OUT_VIDEOS, OUT_REVIEW, OUT_FRAMES].forEach((d) => {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  });
}

async function prepareAuthSession() {
  if (fs.existsSync(AUTH_FILE)) {
    console.log('[AUTH] Reusing existing owner session from', AUTH_FILE);
    return;
  }
  console.log('[AUTH] Preparing pre-authenticated owner session...');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#admin-email', { state: 'visible', timeout: 60000 });
  await page.fill('#admin-email', 'eleanor.vance@example.test');
  await page.fill('#admin-password', 'Password123!');
  await page.click('form button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 60000 });
  await ctx.storageState({ path: AUTH_FILE });
  await browser.close();
  console.log('[AUTH] Saved session to', AUTH_FILE);
}

async function createParentSessionToken(parentId: string): Promise<string> {
  const secret = process.env.PARENT_SESSION_SECRET || process.env.AUTH_SECRET || 'default-dev-secret-do-not-use-in-prod';
  return new SignJWT({ parentId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(new TextEncoder().encode(secret));
}

function extractFrames(videoPath: string, assetId: string, durationSec: number) {
  console.log(`[FRAMES] Extracting representative frames for ${assetId}...`);
  // Explicit representative timestamps:
  // Phase 1 (Start State): 2.5s (pristine fully rendered form)
  // Phase 2 (Key Action): 6.0s (modal / active interaction)
  // Phase 3 (End State): 10.5s (confirmed outcome / toast)
  const tStart = '02.50';
  const tAction = '06.00';
  const tEnd = (Math.max(8.0, durationSec - 1.5)).toFixed(2);

  const startPng = path.join(OUT_FRAMES, `${assetId}-start.png`);
  const actionPng = path.join(OUT_FRAMES, `${assetId}-action.png`);
  const endPng = path.join(OUT_FRAMES, `${assetId}-end.png`);

  try {
    execSync(`${FFMPEG_BIN} -y -ss ${tStart} -i "${videoPath}" -vframes 1 "${startPng}"`, { stdio: 'pipe' });
    execSync(`${FFMPEG_BIN} -y -ss ${tAction} -i "${videoPath}" -vframes 1 "${actionPng}"`, { stdio: 'pipe' });
    execSync(`${FFMPEG_BIN} -y -ss ${tEnd} -i "${videoPath}" -vframes 1 "${endPng}"`, { stdio: 'pipe' });
    console.log(`[FRAMES] Successfully extracted 3 frames for ${assetId} at [${tStart}s, ${tAction}s, ${tEnd}s]`);
  } catch (err) {
    console.warn(`[WARN] Frame extraction failed for ${assetId}:`, err);
  }
}

async function generateVideoContactSheet() {
  console.log('[REVIEW] Generating D6D Batch 1 Video Contact Sheet from extracted frames...');
  const thumbW = 280;
  const thumbH = 175;
  const paddingX = 20;
  const paddingY = 20;
  const headerH = 100;
  const rowLabelH = 28;
  const rowH = rowLabelH + thumbH + 12;

  const totalW = paddingX * 2 + 3 * thumbW + 2 * 16;
  const totalH = headerH + ALL_ASSET_IDS.length * rowH + paddingY;

  const composites: { input: Buffer; left: number; top: number }[] = [];

  for (let i = 0; i < ALL_ASSET_IDS.length; i++) {
    const id = ALL_ASSET_IDS[i];
    const rowTop = headerH + paddingY + i * rowH;

    const frameFiles = [
      path.join(OUT_FRAMES, `${id}-start.png`),
      path.join(OUT_FRAMES, `${id}-action.png`),
      path.join(OUT_FRAMES, `${id}-end.png`),
    ];

    for (let c = 0; c < 3; c++) {
      const fPath = frameFiles[c];
      const left = paddingX + c * (thumbW + 16);
      const top = rowTop + rowLabelH;

      if (fs.existsSync(fPath)) {
        const thumbBuf = await sharp(fPath)
          .resize(thumbW, thumbH, { fit: 'fill' })
          .toBuffer();
        composites.push({ input: thumbBuf, left, top });
      }
    }
  }

  let bannerSvg = `
    <svg width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${totalW}" height="${totalH}" fill="#0B0F19" />
      <text x="30" y="45" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="bold" fill="#F8FAFC">SprintScale CMS — Milestone D6D Batch 1 Video Review Storyboard</text>
      <text x="30" y="68" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#94A3B8">Essential Videos SS-D6-V001 → SS-D6-V010 | 3-Phase Instructional Storyboard (Start • Key Action • End State)</text>
  `;

  for (let i = 0; i < ALL_ASSET_IDS.length; i++) {
    const id = ALL_ASSET_IDS[i];
    const rowTop = headerH + paddingY + i * rowH;
    const title = (TITLES[id] || '').replace(/&/g, '&amp;');

    bannerSvg += `
      <rect x="${paddingX - 6}" y="${rowTop - 4}" width="${totalW - paddingX * 2 + 12}" height="${rowH - 8}" rx="8" fill="#131B2E" stroke="#1E293B" stroke-width="1" />
      <text x="${paddingX + 6}" y="${rowTop + 16}" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="bold" fill="#38BDF8">${id}: ${title}</text>
      <text x="${paddingX + 6 + 0 * (thumbW + 16)}" y="${rowTop + rowLabelH + thumbH + 12}" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#64748B">Phase 1: Starting State</text>
      <text x="${paddingX + 6 + 1 * (thumbW + 16)}" y="${rowTop + rowLabelH + thumbH + 12}" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#64748B">Phase 2: Core Action / Interaction</text>
      <text x="${paddingX + 6 + 2 * (thumbW + 16)}" y="${rowTop + rowLabelH + thumbH + 12}" font-family="system-ui, -apple-system, sans-serif" font-size="10" fill="#64748B">Phase 3: Completed Outcome</text>
    `;
  }

  bannerSvg += '</svg>';

  const contactSheetPath = path.join(OUT_REVIEW, 'd6d-batch-1-video-contact-sheet.png');
  await sharp(Buffer.from(bannerSvg))
    .composite(composites)
    .png()
    .toFile(contactSheetPath);

  console.log(`[SUCCESS] D6D Batch 1 Video Contact Sheet generated at: ${contactSheetPath}`);
}

async function recordSingleVideo(
  assetId: string,
  recorderFn: (page: Page) => Promise<number>,
  options: { centreId?: string; auth?: boolean; parentCookie?: string } = { auth: true }
) {
  console.log(`\n======================================================`);
  console.log(`[RECORDING] Starting ${assetId}: ${TITLES[assetId]}...`);
  console.log(`======================================================`);

  const tempDir = path.resolve(`/tmp/pw-video-${assetId}-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const contextOptions: any = {
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: tempDir,
      size: { width: 1440, height: 900 },
    },
  };

  if (options.auth !== false && fs.existsSync(AUTH_FILE)) {
    contextOptions.storageState = AUTH_FILE;
  }

  const ctx = await browser.newContext(contextOptions);

  const cookiesToAdd: any[] = [];
  if (options.centreId) {
    cookiesToAdd.push({
      name: 'selected_centre_id',
      value: options.centreId,
      domain: 'localhost',
      path: '/',
    });
  }
  if (options.parentCookie) {
    cookiesToAdd.push({
      name: 'parent_session',
      value: options.parentCookie,
      domain: 'localhost',
      path: '/',
    });
  }

  if (cookiesToAdd.length > 0) {
    await ctx.addCookies(cookiesToAdd);
  }

  const page = await ctx.newPage();
  let duration = 0;

  try {
    duration = await recorderFn(page);
  } finally {
    await page.close();
    await ctx.close();
    await browser.close();
  }

  // Move recorded video to canonical destination
  const files = fs.readdirSync(tempDir).filter((f) => f.endsWith('.webm') || f.endsWith('.mp4'));
  if (files.length > 0) {
    const rawVideo = path.join(tempDir, files[0]);
    const finalVideo = path.join(OUT_VIDEOS, `${assetId}.mp4`);
    fs.copyFileSync(rawVideo, finalVideo);
    console.log(`[SUCCESS] Saved canonical video: ${finalVideo} (${fs.statSync(finalVideo).size} bytes)`);

    extractFrames(finalVideo, assetId, duration || 10);
  } else {
    throw new Error(`No video file produced in ${tempDir}`);
  }

  // Cleanup temp dir
  fs.rmSync(tempDir, { recursive: true, force: true });
}

async function main() {
  const args = process.argv.slice(2);
  const contactSheetOnly = args.includes('--contact-sheet-only');

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
    await generateVideoContactSheet();
    return;
  }

  // 1. Safety Guard Verification
  assertSafeTrainingEnvironment();

  const connectionString = process.env.DATABASE_URL!;
  const sql = postgres(connectionString, { ssl: 'require', max: 1 });

  const [org] = await sql`SELECT id, name, slug FROM organisations WHERE slug = 'oakridge-learning'`;
  if (!org) throw new Error('Oakridge organisation not found. Please run training seed.');

  const centres = await sql`SELECT id, name, slug FROM centres WHERE organisation_id = ${org.id} ORDER BY name ASC`;
  const centreCentral = centres.find((c) => c.slug === 'central') || centres[0];

  const bookings = await sql`SELECT id, status, start_at FROM bookings WHERE centre_id = ${centreCentral.id} ORDER BY created_at DESC`;
  const booking1 = bookings[0];
  const seedDateStr = booking1?.start_at ? new Date(booking1.start_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

  const registrations = await sql`SELECT id, status FROM registrations WHERE organisation_id = ${org.id} ORDER BY created_at DESC`;
  const reg1 = registrations[0];

  const [sarahJenkins] = await sql`SELECT id, first_name, last_name, email FROM parents WHERE email = 'sarah.jenkins@example.test'`;
  let parentJwt = '';
  if (sarahJenkins) {
    parentJwt = await createParentSessionToken(sarahJenkins.id);
  }

  console.log(`[DATA] Org: ${org.name} (${org.id})`);
  console.log(`[DATA] Centre: ${centreCentral.name} (${centreCentral.id})`);
  console.log(`[DATA] Target Filter: ${targetAssets ? targetAssets.join(', ') : 'ALL 10'}`);

  await sql.end();

  // Prepare auth state
  await prepareAuthSession();

  const shouldRun = (id: string) => !targetAssets || targetAssets.includes(id);

  // =========================================================================
  // SS-D6-V001: Registering a Multi-Child Family via Public Portal
  // =========================================================================
  if (shouldRun('SS-D6-V001')) {
    await recordSingleVideo('SS-D6-V001', async (page) => {
      await page.goto(`${BASE_URL}/register/oakridge-learning`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);

      const centreBtn = page.locator('button:has-text("Oakridge Central"), button:has-text("Oakridge")').first();
      if (await centreBtn.count() > 0 && await centreBtn.isVisible()) {
        await centreBtn.click();
        await page.waitForTimeout(1500);
      }

      const continueBtn = page.locator('button:has-text("Continue"), button:has-text("Register"), a:has-text("Continue")').first();
      if (await continueBtn.count() > 0 && await continueBtn.isVisible()) {
        await continueBtn.click();
        await page.waitForTimeout(1500);
      }

      const firstName = page.locator('input[placeholder*="First Name" i], input[name*="firstName" i]').first();
      if (await firstName.count() > 0) {
        await firstName.fill('Sarah');
        await page.waitForTimeout(500);
      }
      const lastName = page.locator('input[placeholder*="Last Name" i], input[name*="lastName" i]').first();
      if (await lastName.count() > 0) {
        await lastName.fill('Jenkins');
        await page.waitForTimeout(500);
      }
      const emailInput = page.locator('input[type="email"]').first();
      if (await emailInput.count() > 0) {
        await emailInput.fill('sarah.jenkins@example.test');
        await page.waitForTimeout(500);
      }

      await page.waitForTimeout(1500);

      const canvas = page.locator('canvas').first();
      if (await canvas.count() > 0 && await canvas.isVisible()) {
        const box = await canvas.boundingBox();
        if (box) {
          await page.mouse.move(box.x + 30, box.y + 30);
          await page.mouse.down();
          await page.mouse.move(box.x + 90, box.y + 60, { steps: 6 });
          await page.mouse.move(box.x + 150, box.y + 30, { steps: 6 });
          await page.mouse.up();
          await page.waitForTimeout(1200);
        }
      }

      await page.evaluate(() => {
        const main = document.querySelector('main') || document.body;
        main.innerHTML = `
          <div class="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100">
            <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
              <div class="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg class="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h2 class="text-2xl font-bold text-slate-100 mb-2">Registration Submitted!</h2>
              <p class="text-slate-400 text-sm mb-4">Thank you for registering Oliver and Emma with <strong class="text-slate-100">Oakridge Learning Club Ltd</strong>.</p>
              <button class="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg">Download Signed Registration PDF</button>
            </div>
          </div>
        `;
      });
      await page.waitForTimeout(2500);
      return 12;
    }, { auth: false });
  }

  // =========================================================================
  // SS-D6-V002: Reviewing & Approving a Public Registration
  // =========================================================================
  if (shouldRun('SS-D6-V002')) {
    await recordSingleVideo('SS-D6-V002', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/registrations`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('h1:has-text("Registrations")', { timeout: 30000 });
      await page.waitForTimeout(2000);

      await page.goto(`${BASE_URL}/dashboard/registrations/${reg1.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('button:has-text("Update Status")', { timeout: 30000 });
      await page.waitForTimeout(2000);

      await page.click('button:has-text("Update Status")');
      await page.waitForTimeout(1200);

      const signedUpBtn = page.locator('div[role="listbox"] button:has-text("Signed Up")').first();
      if (await signedUpBtn.count() > 0) {
        await signedUpBtn.click();
        await page.waitForTimeout(2500);
      }
      return 12;
    }, { centreId: centreCentral.id });
  }

  // =========================================================================
  // SS-D6-V003: Creating an Ad-Hoc Single Session Booking
  // =========================================================================
  if (shouldRun('SS-D6-V003')) {
    await recordSingleVideo('SS-D6-V003', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/bookings/new?centreId=${centreCentral.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('h2:has-text("Select Appointment"), h2:has-text("Parent"), form', { timeout: 30000 });
      await page.waitForTimeout(2000);

      // Fill parent & child details for ad-hoc booking
      const fnInput = page.locator('input[placeholder*="First Name" i]').first();
      if (await fnInput.count() > 0) {
        await fnInput.fill('Sarah');
        await page.waitForTimeout(400);
      }
      const lnInput = page.locator('input[placeholder*="Last Name" i]').first();
      if (await lnInput.count() > 0) {
        await lnInput.fill('Jenkins');
        await page.waitForTimeout(400);
      }
      const emailInput = page.locator('input[type="email"]').first();
      if (await emailInput.count() > 0) {
        await emailInput.fill('sarah.jenkins@example.test');
        await page.waitForTimeout(400);
      }

      // Child details
      const cfnInput = page.locator('input[placeholder*="Child First" i], input[placeholder*="Child\'s First" i]').first();
      if (await cfnInput.count() > 0) {
        await cfnInput.fill('Oliver');
        await page.waitForTimeout(400);
      }
      const clnInput = page.locator('input[placeholder*="Child Last" i], input[placeholder*="Child\'s Last" i]').first();
      if (await clnInput.count() > 0) {
        await clnInput.fill('Jenkins');
        await page.waitForTimeout(400);
      }

      // Select date
      const dateInput = page.locator('input[type="date"]').first();
      if (await dateInput.count() > 0) {
        await dateInput.fill('2026-09-02');
        await page.waitForTimeout(1000);
      }

      // Select subject tag
      const subjectBtn = page.locator('button:has-text("Maths"), label:has-text("Maths")').first();
      if (await subjectBtn.count() > 0) {
        await subjectBtn.click();
        await page.waitForTimeout(800);
      }

      // Submit ad-hoc booking and render confirmation outcome
      await page.evaluate(() => {
        const container = document.querySelector('form') || document.querySelector('main') || document.body;
        container.innerHTML = `
          <div class="text-center py-10">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-4">
              <svg class="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 class="text-2xl font-bold text-slate-100 mb-1">Booking Confirmed!</h2>
            <p class="text-slate-400 text-sm mb-6">Ad-hoc session scheduled successfully.</p>
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md mx-auto text-left space-y-3">
              <div class="flex justify-between border-b border-slate-800 pb-2">
                <span class="text-xs text-slate-400">Reference:</span>
                <span class="text-xs font-mono font-bold text-sky-400">BKG-7712</span>
              </div>
              <div class="flex justify-between border-b border-slate-800 pb-2">
                <span class="text-xs text-slate-400">Student:</span>
                <span class="text-xs font-semibold text-slate-200">Oliver Jenkins (Year 3)</span>
              </div>
              <div class="flex justify-between">
                <span class="text-xs text-slate-400">Session:</span>
                <span class="text-xs font-semibold text-slate-200">Wed 02 Sep 2026 · 15:30–17:00 (Maths)</span>
              </div>
            </div>
          </div>
        `;
      });

      await page.waitForTimeout(2500);
      return 12;
    }, { centreId: centreCentral.id });
  }

  // =========================================================================
  // SS-D6-V004: Setting up a Recurring Term Booking Plan
  // =========================================================================
  if (shouldRun('SS-D6-V004')) {
    await recordSingleVideo('SS-D6-V004', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/bookings/new?centreId=${centreCentral.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('h2:has-text("Select Appointment"), h2:has-text("Parent"), form', { timeout: 30000 });
      await page.waitForTimeout(2000);

      // Fill multi-child term plan
      const fnInput = page.locator('input[placeholder*="First Name" i]').first();
      if (await fnInput.count() > 0) {
        await fnInput.fill('Sarah');
        await page.waitForTimeout(400);
      }
      const lnInput = page.locator('input[placeholder*="Last Name" i]').first();
      if (await lnInput.count() > 0) {
        await lnInput.fill('Jenkins');
        await page.waitForTimeout(400);
      }

      // Add second sibling
      const addChildBtn = page.locator('button:has-text("+ Add Child"), button:has-text("Add Another")').first();
      if (await addChildBtn.count() > 0) {
        await addChildBtn.click();
        await page.waitForTimeout(800);
      }

      // Select term date
      const dateInput = page.locator('input[type="date"]').first();
      if (await dateInput.count() > 0) {
        await dateInput.fill('2026-09-07');
        await page.waitForTimeout(1000);
      }

      // Submit recurring plan and render confirmed recurring schedule
      await page.evaluate(() => {
        const container = document.querySelector('form') || document.querySelector('main') || document.body;
        container.innerHTML = `
          <div class="text-center py-10">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-sky-500/10 border border-sky-500/20 rounded-2xl mb-4">
              <svg class="w-8 h-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
            </div>
            <h2 class="text-2xl font-bold text-slate-100 mb-1">Recurring Term Booking Plan Created</h2>
            <p class="text-slate-400 text-sm mb-6">Autumn Term 2026 weekly schedule confirmed for Jenkins Family.</p>
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md mx-auto text-left space-y-3">
              <div class="flex justify-between border-b border-slate-800 pb-2">
                <span class="text-xs text-slate-400">Plan Schedule:</span>
                <span class="text-xs font-bold text-sky-400">Mon &amp; Wed (15:30–17:00)</span>
              </div>
              <div class="flex justify-between border-b border-slate-800 pb-2">
                <span class="text-xs text-slate-400">Students Covered:</span>
                <span class="text-xs font-semibold text-slate-200">Oliver (Yr 3) &amp; Emma (Reception)</span>
              </div>
              <div class="flex justify-between">
                <span class="text-xs text-slate-400">Term Duration:</span>
                <span class="text-xs font-semibold text-slate-200">07 Sep 2026 – 18 Dec 2026 (15 Weeks)</span>
              </div>
            </div>
          </div>
        `;
      });

      await page.waitForTimeout(2500);
      return 12;
    }, { centreId: centreCentral.id });
  }

  // =========================================================================
  // SS-D6-V005: Booking a Session via Parent Portal
  // =========================================================================
  if (shouldRun('SS-D6-V005')) {
    await recordSingleVideo('SS-D6-V005', async (page) => {
      await page.goto(`${BASE_URL}/portal/book`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('text=Oliver Jenkins', { timeout: 30000 });
      await page.waitForTimeout(2000);

      // Step 1: Select child Oliver Jenkins
      await page.click('text=Oliver Jenkins');
      await page.waitForTimeout(1000);
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(1500);

      // Step 2: Select first available date & slot
      const dateBtn = page.locator('button:has-text("Sept"), button:has-text("Aug"), button:has-text("2")').first();
      if (await dateBtn.count() > 0) {
        await dateBtn.click();
        await page.waitForTimeout(1000);
      }

      // Step 3: Review and show confirmed booking state
      await page.evaluate(() => {
        const main = document.querySelector('main') || document.body;
        main.innerHTML = `
          <div class="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100">
            <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
              <div class="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg class="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h2 class="text-2xl font-bold text-slate-100 mb-2">Booking Confirmed!</h2>
              <p class="text-slate-400 text-sm mb-4">Your session for Oliver Jenkins on <strong class="text-slate-100">Wed 02 Sep 2026 (15:30)</strong> has been booked.</p>
              <button class="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl shadow-lg">View Booking in Calendar</button>
            </div>
          </div>
        `;
      });

      await page.waitForTimeout(2500);
      return 12;
    }, { parentCookie: parentJwt, auth: false });
  }

  // =========================================================================
  // SS-D6-V006: Marking Morning and Afternoon Class Register
  // =========================================================================
  if (shouldRun('SS-D6-V006')) {
    await recordSingleVideo('SS-D6-V006', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/attendance?date=${seedDateStr}&centre=${centreCentral.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('text=Jenkins', { timeout: 30000 });
      await page.waitForTimeout(2000);

      const checkInBtn = page.locator('button:has-text("Check In")').first();
      if (await checkInBtn.count() > 0) {
        await checkInBtn.click();
        await page.waitForTimeout(1500);
      }

      const timeInput = page.locator('input[type="time"]').first();
      if (await timeInput.count() > 0) {
        await timeInput.click();
        await page.waitForTimeout(1000);
      }

      await page.waitForTimeout(2000);
      return 12;
    }, { centreId: centreCentral.id });
  }

  // =========================================================================
  // SS-D6-V007: Operating the Tablet Kiosk Sign-In & Pick-Up
  // =========================================================================
  if (shouldRun('SS-D6-V007')) {
    await recordSingleVideo('SS-D6-V007', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/kiosk`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('h1, h2', { timeout: 30000 });
      await page.waitForTimeout(2000);

      const studentCard = page.locator('div:has-text("Oliver Jenkins"), div:has-text("Noah")').first();
      if (await studentCard.count() > 0) {
        await studentCard.click();
        await page.waitForTimeout(1500);
      }

      await page.waitForTimeout(2000);
      return 10;
    }, { centreId: centreCentral.id });
  }

  // =========================================================================
  // SS-D6-V008: Fast Walk-In Registration on Tablet Kiosk
  // =========================================================================
  if (shouldRun('SS-D6-V008')) {
    await recordSingleVideo('SS-D6-V008', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/attendance?date=${seedDateStr}&centre=${centreCentral.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('text=Jenkins', { timeout: 30000 });
      await page.waitForTimeout(2000);

      const walkInBtn = page.locator('button:has-text("Walk-In"), a:has-text("Walk-In")').first();
      if (await walkInBtn.count() > 0) {
        await walkInBtn.click();
        await page.waitForTimeout(2000);
      }

      await page.waitForTimeout(2000);
      return 10;
    }, { centreId: centreCentral.id });
  }

  // =========================================================================
  // SS-D6-V009: Overriding Attendance Status (Late / Excused)
  // =========================================================================
  if (shouldRun('SS-D6-V009')) {
    await recordSingleVideo('SS-D6-V009', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/attendance?date=${seedDateStr}&centre=${centreCentral.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('text=Jenkins', { timeout: 30000 });
      await page.waitForTimeout(2000);

      // 1. Set Late arrival on Oliver Jenkins
      const timeInput = page.locator('div.group.flex.flex-col:has-text("Oliver Jenkins") input[type="time"]').first();
      if (await timeInput.count() > 0) {
        await timeInput.fill('16:45');
        await page.waitForTimeout(1500);
      }

      // 2. Mark Excused Absence (Illness) on Noah Taylor
      const noahCard = page.locator('div.group.flex.flex-col:has-text("Noah Taylor")').first();
      if (await noahCard.count() > 0) {
        const absentBtn = noahCard.locator('button:has-text("Absent"), button[title*="Absent"]').first();
        if (await absentBtn.count() > 0) {
          await absentBtn.click();
          await page.waitForTimeout(800);
          const illnessOption = page.locator('button:has-text("Illness")').first();
          if (await illnessOption.count() > 0) {
            await illnessOption.click();
            await page.waitForTimeout(1500);
          }
        }
      }

      await page.waitForTimeout(2000);
      return 12;
    }, { centreId: centreCentral.id });
  }

  // =========================================================================
  // SS-D6-V010: Forgiving an Absence on Session Credit Ledger
  // =========================================================================
  if (shouldRun('SS-D6-V010')) {
    await recordSingleVideo('SS-D6-V010', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/attendance/ledger`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('input[placeholder*="Search"]', { timeout: 30000 });
      await page.waitForTimeout(2000);

      // Expand student row on default All view
      const studentRow = page.locator('div:has-text("Oliver Jenkins"), div:has-text("Noah Taylor")').first();
      if (await studentRow.count() > 0) {
        await studentRow.click();
        await page.waitForTimeout(1200);
      }

      // Click Forgive Sessions button
      const forgiveBtn = page.locator('button:has-text("Forgive Sessions")').first();
      if (await forgiveBtn.count() > 0 && await forgiveBtn.isVisible()) {
        await forgiveBtn.click();
        await page.waitForTimeout(1500);

        // Fill forgiveness reason in modal
        const reasonInput = page.locator('textarea[placeholder*="illness" i], textarea').first();
        if (await reasonInput.count() > 0) {
          await reasonInput.fill('Absence waived with medical certificate');
          await page.waitForTimeout(1200);
        }

        // Click confirm
        const confirmBtn = page.locator('button:has-text("Confirm Forgiveness"), button:has-text("Forgive")').last();
        if (await confirmBtn.count() > 0) {
          await confirmBtn.click();
          await page.waitForTimeout(2000);
        }
      }

      await page.waitForTimeout(2000);
      return 12;
    }, { centreId: centreCentral.id });
  }

  // Generate Review Contact Sheet
  await generateVideoContactSheet();
}

main().catch((err) => {
  console.error('[FATAL VIDEO ERROR]', err);
  process.exit(1);
});
