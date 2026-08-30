import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { chromium, Page } from 'playwright';
import { SignJWT } from 'jose';
import sharp from 'sharp';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

import { assertSafeTrainingEnvironment } from '../lib/training-guard';
import { db } from '../db';
import { centres, organisations, parents, invoices, children } from '../db/schema';
import { eq, and } from 'drizzle-orm';

const FFMPEG_BIN = '/Users/KWADW/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac';
const BASE_URL = 'http://localhost:3000';
const OUT_VIDEOS = path.resolve('project-notes/documentation-training/assets/videos');
const OUT_REVIEW = path.resolve('project-notes/documentation-training/assets/review');
const OUT_FRAMES = path.join(OUT_REVIEW, 'd6d-batch-2-frames');

const ALL_ASSET_IDS = [
  'SS-D6-V011', 'SS-D6-V012', 'SS-D6-V013', 'SS-D6-V014', 'SS-D6-V015',
  'SS-D6-V016', 'SS-D6-V017', 'SS-D6-V018', 'SS-D6-V019', 'SS-D6-V020',
];

const TITLES: Record<string, string> = {
  'SS-D6-V011': 'Logging a First Aid Accident on Body Map',
  'SS-D6-V012': 'Creating a Confidential Safeguarding Record',
  'SS-D6-V013': 'Setting up Agreed Monthly Family Tuition Fee',
  'SS-D6-V014': 'Executing Monthly Invoicing Batch Run',
  'SS-D6-V015': 'Recording an Offline Cash Payment',
  'SS-D6-V016': 'Recording an Offline Bank Transfer Payment',
  'SS-D6-V017': 'Reconciling Childcare Vouchers & TFC',
  'SS-D6-V018': 'Voiding an Incorrect Invoice',
  'SS-D6-V019': 'Parent Portal Billing & Invoices Overview',
  'SS-D6-V020': 'Creating & Setting Up a New Centre Venue',
};

const SEMANTIC_TIMESTAMPS: Record<string, { start: string; action: string; end: string }> = {
  'SS-D6-V011': { start: '02.50', action: '07.00', end: '11.50' }, // dur: ~13s
  'SS-D6-V012': { start: '02.50', action: '07.00', end: '11.50' }, // dur: ~13s
  'SS-D6-V013': { start: '02.50', action: '05.50', end: '08.50' }, // dur: ~10s
  'SS-D6-V014': { start: '02.50', action: '05.50', end: '13.50' }, // dur: ~15s
  'SS-D6-V015': { start: '02.50', action: '06.50', end: '11.00' }, // dur: ~14s
  'SS-D6-V016': { start: '02.50', action: '06.50', end: '11.00' }, // dur: ~13s
  'SS-D6-V017': { start: '02.50', action: '06.50', end: '11.50' }, // dur: ~13s
  'SS-D6-V018': { start: '02.50', action: '05.50', end: '09.50' }, // dur: ~12s
  'SS-D6-V019': { start: '02.50', action: '05.50', end: '09.00' }, // dur: ~10s
  'SS-D6-V020': { start: '02.50', action: '06.00', end: '09.50' }, // dur: ~11s
};

const AUTH_OWNER = '/tmp/auth-owner.json';
const AUTH_MANAGER = '/tmp/auth-manager.json';

async function ensureDirs() {
  [OUT_VIDEOS, OUT_REVIEW, OUT_FRAMES].forEach((d) => {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  });
}

async function prepareAuthSession(force = false) {
  if (!force && fs.existsSync(AUTH_OWNER) && fs.statSync(AUTH_OWNER).size > 100) {
    console.log('[AUTH] Reusing existing owner session from', AUTH_OWNER);
    return;
  }
  if (fs.existsSync(AUTH_OWNER)) {
    try { fs.unlinkSync(AUTH_OWNER); } catch {}
  }
  console.log('[AUTH] Authenticating fresh session as eleanor.vance@example.test...');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#admin-email', { state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1000); // Ensure hydration
  await page.fill('#admin-email', 'eleanor.vance@example.test');
  await page.fill('#admin-password', 'Password123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
  await context.storageState({ path: AUTH_OWNER });
  await browser.close();
  console.log('[AUTH] Saved fresh owner session to', AUTH_OWNER);
}

async function prepareManagerAuthSession(force = false) {
  if (!force && fs.existsSync(AUTH_MANAGER) && fs.statSync(AUTH_MANAGER).size > 100) {
    console.log('[AUTH] Reusing existing manager session from', AUTH_MANAGER);
    return;
  }
  if (fs.existsSync(AUTH_MANAGER)) {
    try { fs.unlinkSync(AUTH_MANAGER); } catch {}
  }
  console.log('[AUTH] Authenticating fresh session as marcus.sterling@example.test (Manager / DSL)...');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#admin-email', { state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1000); // Ensure hydration
  await page.fill('#admin-email', 'marcus.sterling@example.test');
  await page.fill('#admin-password', 'Password123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
  await context.storageState({ path: AUTH_MANAGER });
  await browser.close();
  console.log('[AUTH] Saved fresh manager session to', AUTH_MANAGER);
}

async function createParentSessionToken(parentId: string): Promise<string> {
  const secret = process.env.PARENT_SESSION_SECRET || process.env.AUTH_SECRET || 'default-dev-secret-do-not-use-in-prod';
  return new SignJWT({ parentId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(new TextEncoder().encode(secret));
}

function extractFrames(videoPath: string, assetId: string, durationSec: number = 10) {
  console.log(`[FRAMES] Extracting representative frames for ${assetId}...`);
  const ts = SEMANTIC_TIMESTAMPS[assetId] || {
    start: '02.50',
    action: (durationSec * 0.55).toFixed(2),
    end: (Math.max(1.0, durationSec - 1.2)).toFixed(2)
  };

  const startPng = path.join(OUT_FRAMES, `${assetId}-start.png`);
  const actionPng = path.join(OUT_FRAMES, `${assetId}-action.png`);
  const endPng = path.join(OUT_FRAMES, `${assetId}-end.png`);

  try {
    execSync(`${FFMPEG_BIN} -y -ss ${ts.start} -i "${videoPath}" -vframes 1 "${startPng}"`, { stdio: 'pipe' });
    execSync(`${FFMPEG_BIN} -y -ss ${ts.action} -i "${videoPath}" -vframes 1 "${actionPng}"`, { stdio: 'pipe' });
    execSync(`${FFMPEG_BIN} -y -ss ${ts.end} -i "${videoPath}" -vframes 1 "${endPng}"`, { stdio: 'pipe' });
    console.log(`[FRAMES] Successfully extracted 3 frames for ${assetId} at [${ts.start}s, ${ts.action}s, ${ts.end}s]`);
  } catch (err) {
    console.warn(`[WARN] Frame extraction failed for ${assetId}:`, err);
  }
}

async function generateVideoContactSheet() {
  console.log('[REVIEW] Generating D6D Batch 2 Video Contact Sheet from extracted frames...');
  const thumbW = 280;
  const thumbH = 175;
  const paddingX = 20;
  const paddingY = 20;
  const headerH = 100;
  const rowLabelH = 28;
  const rowH = rowLabelH + thumbH + 12;

  const totalW = paddingX * 2 + 3 * thumbW + 2 * 16;
  const totalH = headerH + ALL_ASSET_IDS.length * rowH + paddingY;

  // Ensure all frames exist for available videos
  for (const id of ALL_ASSET_IDS) {
    const canonicalMp4 = path.join(OUT_VIDEOS, `${id}.mp4`);
    const startPng = path.join(OUT_FRAMES, `${id}-start.png`);
    const actionPng = path.join(OUT_FRAMES, `${id}-action.png`);
    const endPng = path.join(OUT_FRAMES, `${id}-end.png`);

    if (fs.existsSync(canonicalMp4) && (!fs.existsSync(startPng) || !fs.existsSync(actionPng) || !fs.existsSync(endPng))) {
      extractFrames(canonicalMp4, id);
    }
  }

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
      <text x="30" y="45" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="bold" fill="#F8FAFC">SprintScale CMS — Milestone D6D Batch 2 Video Review Storyboard</text>
      <text x="30" y="68" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#94A3B8">Essential Videos SS-D6-V011 → SS-D6-V020 | 3-Phase Instructional Storyboard (Start • Key Action • End State)</text>
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

  const contactSheetPath = path.join(OUT_REVIEW, 'd6d-batch-2-video-contact-sheet.png');
  await sharp(Buffer.from(bannerSvg))
    .composite(composites)
    .png()
    .toFile(contactSheetPath);

  console.log(`[SUCCESS] D6D Batch 2 Video Contact Sheet generated at: ${contactSheetPath}`);
}

async function recordSingleVideo(
  assetId: string,
  recordFlow: (page: Page) => Promise<number>,
  options?: { authFile?: string; centreId?: string; parentToken?: string }
) {
  console.log(`\n======================================================`);
  console.log(`[RECORDING] Starting ${assetId}: ${TITLES[assetId]}...`);
  console.log(`======================================================`);

  const tempVideoDir = path.join(OUT_VIDEOS, `temp_${assetId}_${Date.now()}`);
  if (!fs.existsSync(tempVideoDir)) {
    fs.mkdirSync(tempVideoDir, { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const contextOptions: any = {
    recordVideo: {
      dir: tempVideoDir,
      size: { width: 1440, height: 900 },
    },
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  };

  if (options?.authFile && !options?.parentToken && fs.existsSync(options.authFile)) {
    contextOptions.storageState = options.authFile;
  }

  const context = await browser.newContext(contextOptions);

  if (options?.parentToken) {
    await context.addCookies([
      {
        name: 'parent_session',
        value: options.parentToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);
  }

  if (options?.centreId) {
    await context.addCookies([
      {
        name: 'selected_centre_id',
        value: options.centreId,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
      {
        name: 'selected_centre',
        value: options.centreId,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ]);
  }

  const page = await context.newPage();

  // Execute instructional flow
  try {
    await recordFlow(page);
  } catch (err) {
    console.error(`[ERROR] Workflow failed for ${assetId}:`, err);
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  // Identify generated video file
  const videoFiles = fs.readdirSync(tempVideoDir).filter((f) => f.endsWith('.webm') || f.endsWith('.mp4'));
  if (videoFiles.length === 0) {
    console.error(`[ERROR] No video produced for ${assetId}`);
    return;
  }

  const rawVideoPath = path.join(tempVideoDir, videoFiles[0]);
  const canonicalMp4 = path.join(OUT_VIDEOS, `${assetId}.mp4`);

  // Copy canonical video
  fs.copyFileSync(rawVideoPath, canonicalMp4);
  console.log(`[SUCCESS] Saved canonical video: ${canonicalMp4} (${fs.statSync(canonicalMp4).size} bytes)`);

  // Clean temp dir
  try {
    fs.rmSync(tempVideoDir, { recursive: true, force: true });
  } catch {}

  // Extract representative frames
  extractFrames(canonicalMp4, assetId);
}

async function main() {
  await ensureDirs();

  const targetArg = process.argv[2];
  const shouldRun = (id: string) => !targetArg || targetArg === id || targetArg === 'all';

  assertSafeTrainingEnvironment();

  if (targetArg === 'contact-sheet') {
    await generateVideoContactSheet();
    return;
  }

  console.log('[DATA] Retrieving organisation & centre fixtures...');
  const org = await db.query.organisations.findFirst({
    where: eq(organisations.slug, 'oakridge-learning'),
  });
  if (!org) throw new Error('Organisation oakridge-learning not found. Run seed script first.');

  const centreCentral = await db.query.centres.findFirst({
    where: and(eq(centres.organisationId, org.id), eq(centres.slug, 'central')),
  });
  if (!centreCentral) throw new Error('Centre central not found.');

  const parentSarah = await db.query.parents.findFirst({
    where: and(eq(parents.organisationId, org.id), eq(parents.email, 'sarah.jenkins@example.test')),
  });
  if (!parentSarah) throw new Error('Parent Sarah Jenkins not found.');

  const childOliver = await db.query.children.findFirst({
    where: and(eq(children.organisationId, org.id), eq(children.firstName, 'Oliver'), eq(children.lastName, 'Jenkins')),
  });

  await prepareAuthSession(true);
  await prepareManagerAuthSession(true);

  // =========================================================================
  // SS-D6-V011: Logging a First Aid Accident on Body Map
  // =========================================================================
  if (shouldRun('SS-D6-V011')) {
    await recordSingleVideo('SS-D6-V011', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/incidents?centre=${centreCentral.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#log-incident-btn', { timeout: 30000 });
      await page.waitForTimeout(2500); // 0.0s - 3.0s: Settled Starting State

      // 1. Open Log Incident modal
      await page.click('#log-incident-btn');
      await page.waitForSelector('#incident-child', { timeout: 10000 });
      await page.waitForTimeout(500);

      // 2. Select child
      await page.waitForSelector('#incident-child option:not([value=""])', { state: 'attached', timeout: 10000 });
      const childSelect = page.locator('#incident-child');
      try {
        await childSelect.selectOption({ label: 'Oliver Jenkins' });
      } catch {
        await childSelect.selectOption({ index: 1 });
      }
      await page.waitForTimeout(400);

      // 3. Select Accident Record Type (default) & fill description/treatment
      await page.fill('#incident-description', 'Minor scrape on left forearm after playing in outdoor park.');
      await page.waitForTimeout(300);
      await page.fill('#incident-treatment', 'Cold compress applied and wound cleaned with sterile antiseptic wipe. Child returned to session.');
      await page.waitForTimeout(300);

      // 4. Fill Witness
      await page.fill('#incident-witnesses', 'Liam Harper (Tutor)');
      await page.waitForTimeout(300);

      // 5. Draw Signature
      const canvas = page.locator('canvas[aria-label="Staff signature pad"]');
      await canvas.scrollIntoViewIfNeeded();
      const box = await canvas.boundingBox();
      if (box) {
        await page.mouse.move(box.x + 40, box.y + 40);
        await page.mouse.down();
        await page.mouse.move(box.x + 120, box.y + 60);
        await page.mouse.move(box.x + 200, box.y + 40);
        await page.mouse.up();
      }
      await page.waitForTimeout(1500); // 7.0s: Action Frame (Filled Incident Modal with Body Map)

      // 6. Submit Incident
      await page.click('button[form="incident-form"]');
      await page.waitForSelector('td:has-text("Accident"), td:has-text("Oliver Jenkins")', { timeout: 15000 });
      await page.waitForTimeout(3000); // 11.5s: End Frame (Table with new Accident record)

      return 13;
    }, { authFile: AUTH_OWNER, centreId: centreCentral.id });
  }

  // =========================================================================
  // SS-D6-V012: Creating a Confidential Safeguarding Record
  // =========================================================================
  if (shouldRun('SS-D6-V012')) {
    await recordSingleVideo('SS-D6-V012', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/incidents?centre=${centreCentral.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#log-incident-btn', { timeout: 30000 });
      await page.waitForTimeout(2500); // 0.0s - 3.0s: Settled Starting State

      // 1. Open Log Incident modal
      await page.click('#log-incident-btn');
      await page.waitForSelector('#incident-child', { timeout: 10000 });
      await page.waitForTimeout(500);

      // 2. Select child Emma Jenkins
      await page.waitForSelector('#incident-child option:not([value=""])', { state: 'attached', timeout: 10000 });
      const childSelect = page.locator('#incident-child');
      try {
        await childSelect.selectOption({ label: 'Emma Jenkins' });
      } catch {
        await childSelect.selectOption({ index: 2 });
      }
      await page.waitForTimeout(400);

      // 3. Select Safeguarding Record Type
      await page.click('#incident-type-safeguarding');
      await page.waitForTimeout(500);

      // 4. Fill Confidential Description & Witnesses
      await page.fill('#incident-description', 'Confidential disclosure noted regarding home circumstances. Observation shared with DSL.');
      await page.waitForTimeout(300);
      await page.fill('#incident-witnesses', 'Marcus Sterling (Designated Safeguarding Lead)');
      await page.waitForTimeout(300);

      // 5. Draw Signature
      const canvas2 = page.locator('canvas[aria-label="Staff signature pad"]');
      await canvas2.scrollIntoViewIfNeeded();
      const box2 = await canvas2.boundingBox();
      if (box2) {
        await page.mouse.move(box2.x + 40, box2.y + 40);
        await page.mouse.down();
        await page.mouse.move(box2.x + 120, box2.y + 60);
        await page.mouse.move(box2.x + 200, box2.y + 40);
        await page.mouse.up();
      }
      await page.waitForTimeout(1500); // 7.0s: Action Frame (Confidential Safeguarding Modal Active)

      // 6. Submit Safeguarding Record
      await page.click('button[form="incident-form"]');
      await page.waitForSelector('td:has-text("Safeguarding")', { timeout: 15000 });
      await page.waitForTimeout(3000); // 11.5s: End Frame (Table with Safeguarding badge)

      return 13;
    }, { authFile: AUTH_MANAGER, centreId: centreCentral.id });
  }

  // =========================================================================
  // SS-D6-V013: Setting up Agreed Monthly Family Tuition Fee
  // =========================================================================
  if (shouldRun('SS-D6-V013')) {
    await recordSingleVideo('SS-D6-V013', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/students/${childOliver?.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('text=Oliver Jenkins', { timeout: 30000 });
      await page.waitForTimeout(2500); // 0.0s - 3.0s: Settled Starting State

      // 1. Switch to Billing tab
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('button'));
        const billTab = tabs.find(t => t.textContent?.includes('Billing'));
        if (billTab) (billTab as HTMLElement).click();
      });
      await page.waitForSelector('text=Edit billing settings', { timeout: 10000 });
      await page.waitForTimeout(1500); // 6.0s: Action Frame (Agreed Monthly Fee Card & Sibling Chips)

      // 2. Hover / Focus Edit action
      const editBtn = page.locator('button:has-text("Edit billing settings")').first();
      if (await editBtn.count() > 0) {
        await editBtn.hover();
      }
      await page.waitForTimeout(3000); // 8.5s: End Frame (Settled Family Billing Configuration)

      return 10;
    }, { authFile: AUTH_OWNER });
  }

  // =========================================================================
  // SS-D6-V014: Executing Monthly Invoicing Batch Run
  // =========================================================================
  if (shouldRun('SS-D6-V014')) {
    await recordSingleVideo('SS-D6-V014', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/finance?centre=${centreCentral.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('text=Billing Cycles', { timeout: 30000 });
      await page.waitForTimeout(2500); // 0.0s - 3.0s: Settled Starting State

      // 1. Scroll to Billing Cycles
      const billingHeading = page.locator('h2:has-text("Billing Cycles")');
      await billingHeading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);

      // 2. Click Generate All
      const genBtn = page.locator('button:has-text("Generate All"), button:has-text("Generate")').first();
      await genBtn.scrollIntoViewIfNeeded();
      await genBtn.click();
      await page.waitForSelector('text=Generate Invoices', { timeout: 10000 });
      await page.waitForTimeout(1800); // 5.5s: Action Frame (Batch Generation Preview Modal Open)

      // 3. Confirm and Execute Batch Generation
      const confirmBtn = page.locator('div[role="dialog"] button, div.fixed button').filter({ hasText: 'Generate' }).last();
      await confirmBtn.click();
      await page.waitForSelector('text=invoices generated', { timeout: 30000 });
      await page.waitForTimeout(4000); // 13.5s: End Frame (Batch Invoicing Execution Success State)

      return 15;
    }, { authFile: AUTH_OWNER });
  }

  // =========================================================================
  // SS-D6-V015: Recording an Offline Cash Payment
  // =========================================================================
  if (shouldRun('SS-D6-V015')) {
    await recordSingleVideo('SS-D6-V015', async (page) => {
      const unpaidInv = await db.query.invoices.findFirst({
        where: and(eq(invoices.organisationId, org.id), eq(invoices.invoiceNumber, 'INV-2026-003')),
      });
      const invoiceId = unpaidInv?.id || '833d2feb-32ac-4ec0-af62-f73a4e614b09';

      await page.goto(`${BASE_URL}/dashboard/finance/invoices/${invoiceId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('button:has-text("Record Payment")', { timeout: 30000 });
      await page.waitForTimeout(2500); // 0.0s - 3.0s: Settled Starting State

      // 1. Click Record Payment
      await page.click('button:has-text("Record Payment")');
      await page.waitForSelector('text=Amount Received', { timeout: 10000 });
      await page.waitForTimeout(500);

      // 2. Select Cash method
      await page.click('button:has-text("Cash")');
      await page.waitForTimeout(400);

      // 3. Fill Payment Reference
      const refInput = page.locator('input[placeholder*="reference"], input[placeholder*="Transfer"], input[placeholder*="Reference"], input').last();
      await refInput.fill('CASH-RECEPTION-01');
      await page.waitForTimeout(1500); // 6.5s: Action Frame (Filled Cash Modal)

      // 4. Submit Payment
      await page.locator('button:has-text("Record Payment")').last().click();
      await page.waitForSelector('text=Payment recorded successfully', { timeout: 15000 });
      await page.waitForTimeout(3000); // 11.0s: End Frame (PAID status badge + Payment History)

      return 12;
    }, { authFile: AUTH_OWNER });
  }

  // =========================================================================
  // SS-D6-V016: Recording an Offline Bank Transfer Payment
  // =========================================================================
  if (shouldRun('SS-D6-V016')) {
    await recordSingleVideo('SS-D6-V016', async (page) => {
      const unpaidInv = await db.query.invoices.findFirst({
        where: and(eq(invoices.organisationId, org.id), eq(invoices.invoiceNumber, 'INV-2026-004')),
      });
      const invoiceId = unpaidInv?.id || '4640893f-f5b7-4346-b26a-20d98893eda1';

      await page.goto(`${BASE_URL}/dashboard/finance/invoices/${invoiceId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('button:has-text("Record Payment")', { timeout: 30000 });
      await page.waitForTimeout(2500); // 0.0s - 3.0s: Settled Starting State

      // 1. Click Record Payment
      await page.click('button:has-text("Record Payment")');
      await page.waitForSelector('text=Amount Received', { timeout: 10000 });
      await page.waitForTimeout(500);

      // 2. Bank Transfer is selected by default, enter BACS reference
      const refInput = page.locator('input[placeholder*="reference"], input[placeholder*="Transfer"], input[placeholder*="Reference"], input').last();
      await refInput.fill('BACS-OAKRIDGE-991');
      await page.waitForTimeout(1500); // 6.5s: Action Frame (Filled Bank Transfer Modal)

      // 3. Submit Payment
      await page.locator('button:has-text("Record Payment")').last().click();
      await page.waitForSelector('text=Payment recorded successfully', { timeout: 15000 });
      await page.waitForTimeout(3000); // 11.0s: End Frame (PAID status badge)

      return 12;
    }, { authFile: AUTH_OWNER });
  }

  // =========================================================================
  // SS-D6-V017: Reconciling Childcare Vouchers & TFC
  // =========================================================================
  if (shouldRun('SS-D6-V017')) {
    await recordSingleVideo('SS-D6-V017', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/finance/reconciliation?centre=${centreCentral.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('text=Payment Reconciliation', { timeout: 30000 });
      await page.waitForTimeout(2500); // 0.0s - 3.0s: Settled Starting State

      // 1. Select pending invoice
      await page.waitForSelector('button:has-text("David Patel")', { timeout: 15000 });
      await page.click('button:has-text("David Patel")');
      await page.waitForSelector('input[type="number"]', { timeout: 10000 });
      await page.waitForTimeout(500);

      // 2. Fill Amount and TFC Reference
      await page.fill('input[type="number"]', '70.00');
      await page.waitForTimeout(300);
      await page.fill('input[placeholder*="JSMIT"], input[placeholder*="reference"], input[placeholder*="TFC"]', 'TFC-OAK-9921');
      await page.waitForTimeout(2000); // 6.5s: Action Frame (Filled Reconciliation Details)

      // 3. Click Reconcile Payment
      await page.click('button:has-text("Reconcile Payment")');
      await page.waitForSelector('text=Payment reconciled successfully', { timeout: 15000 });
      await page.waitForTimeout(3500); // 11.5s: End Frame (Reconciled Success Toast & State)

      return 13;
    }, { authFile: AUTH_OWNER, centreId: centreCentral.id });
  }

  // =========================================================================
  // SS-D6-V018: Voiding and Reissuing an Incorrect Invoice
  // =========================================================================
  if (shouldRun('SS-D6-V018')) {
    await recordSingleVideo('SS-D6-V018', async (page) => {
      const invToVoid = await db.query.invoices.findFirst({
        where: and(eq(invoices.organisationId, org.id), eq(invoices.invoiceNumber, 'INV-2026-005')),
      });
      const invoiceId = invToVoid?.id || '0a4c745e-547c-4611-9a18-22fbde3706f9';

      await page.goto(`${BASE_URL}/dashboard/finance/invoices/${invoiceId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('button:has-text("Void")', { timeout: 30000 });
      await page.waitForTimeout(2500); // 0.0s - 3.0s: Settled Starting State

      // 1. Click Void button
      await page.click('button:has-text("Void")');
      await page.waitForSelector('text=Void Invoice', { timeout: 10000 });
      await page.waitForTimeout(1500); // 6.0s: Action Frame (Confirmation Modal Open)

      // 2. Confirm Void Action
      const confirmBtn = page.locator('button:has-text("Void Invoice"), button:has-text("Confirm")').last();
      await confirmBtn.click();
      await page.waitForSelector('span:has-text("VOID")', { timeout: 15000 });
      await page.waitForTimeout(3000); // 9.5s: End Frame (VOID Status Badge Active)

      return 11;
    }, { authFile: AUTH_OWNER });
  }

  // =========================================================================
  // SS-D6-V019: Parent Portal Billing & Receipt PDF Download
  // =========================================================================
  if (shouldRun('SS-D6-V019')) {
    const parentSarahCurrent = await db.query.parents.findFirst({
      where: and(eq(parents.organisationId, org.id), eq(parents.email, 'sarah.jenkins@example.test')),
    });
    const parentSessionToken = await createParentSessionToken(parentSarahCurrent!.id);

    await recordSingleVideo('SS-D6-V019', async (page) => {
      await page.goto(`${BASE_URL}/portal/billing`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('text=Billing & Invoices', { timeout: 30000 });
      await page.waitForTimeout(2500); // 0.0s - 3.0s: Settled Starting State

      // 1. Scroll through invoice breakdown and payment history
      await page.evaluate(() => window.scrollBy({ top: 250, behavior: 'smooth' }));
      await page.waitForTimeout(2000); // 5.5s: Action Frame (Invoice Breakdown & Voucher Form)

      await page.evaluate(() => window.scrollBy({ top: 200, behavior: 'smooth' }));
      await page.waitForTimeout(4000); // 9.0s: End Frame (Payment History & Full Breakdown)

      return 12;
    }, { parentToken: parentSessionToken });
  }

  // =========================================================================
  // SS-D6-V020: Creating & Setting Up a New Centre Venue
  // =========================================================================
  if (shouldRun('SS-D6-V020')) {
    await recordSingleVideo('SS-D6-V020', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/centres/add`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#name', { timeout: 30000 });
      await page.waitForTimeout(2500); // 0.0s - 3.0s: Settled Starting State

      // 1. Fill Centre Name
      await page.fill('#name', 'Oakridge North Branch');
      await page.waitForTimeout(400);

      // 2. Fill Address
      await page.fill('#address', '44 Highfield Road, Oakridge, London, N12 8QA');
      await page.waitForTimeout(2000); // 6.0s: Action Frame (Filled Add Centre Form)

      // 3. Submit Centre Creation
      await page.click('button:has-text("Create centre")');
      await page.waitForURL('**/dashboard/centres/**/settings', { timeout: 15000 });
      await page.waitForSelector('button:has-text("General")', { timeout: 15000 });
      await page.waitForTimeout(3500); // 11.5s: End Frame (New Centre Venue Settings View)

      return 13;
    }, { authFile: AUTH_OWNER });
  }

  // Generate Review Contact Sheet
  await generateVideoContactSheet();
}

main().catch((err) => {
  console.error('[FATAL BATCH 2 VIDEO ERROR]', err);
  process.exit(1);
});
