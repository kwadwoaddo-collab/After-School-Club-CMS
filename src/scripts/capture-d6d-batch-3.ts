import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { chromium, Page } from 'playwright';
import sharp from 'sharp';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

import { assertSafeTrainingEnvironment } from '../lib/training-guard';
import { db } from '../db';
import { centres, organisations, parents, users } from '../db/schema';
import { eq, and } from 'drizzle-orm';

const FFMPEG_BIN = '/Users/KWADW/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac';
const BASE_URL = 'http://localhost:3000';
const OUT_VIDEOS = path.resolve('project-notes/documentation-training/assets/videos');
const OUT_REVIEW = path.resolve('project-notes/documentation-training/assets/review');
const OUT_FRAMES = path.join(OUT_REVIEW, 'd6d-batch-3-frames');

const ALL_ASSET_IDS = [
  'SS-D6-V021', 'SS-D6-V022', 'SS-D6-V023', 'SS-D6-V024', 'SS-D6-V025',
  'SS-D6-V026', 'SS-D6-V027', 'SS-D6-V028', 'SS-D6-V029', 'SS-D6-V030',
];

const TITLES: Record<string, string> = {
  'SS-D6-V021': 'Managing Centre Bank Account Details',
  'SS-D6-V022': 'Inviting a New Staff Member via Email',
  'SS-D6-V023': 'Accepting a Staff Email Invitation',
  'SS-D6-V024': 'Scoping Staff Access Across Specific Centres',
  'SS-D6-V025': 'Updating Staff Role & Privileges',
  'SS-D6-V026': 'Safely Deactivating a Staff Member',
  'SS-D6-V027': 'Broadcasting an Email to Consented Parents',
  'SS-D6-V028': 'Moving a Family to the 30-Day Recovery Bin',
  'SS-D6-V029': 'Restoring an Archived Family from Bin',
  'SS-D6-V030': 'Irreversible Permanent GDPR Family Purge',
};

const SEMANTIC_TIMESTAMPS: Record<string, { start: string; action: string; end: string }> = {
  'SS-D6-V021': { start: '02.50', action: '07.00', end: '10.00' }, // dur: 11.44s
  'SS-D6-V022': { start: '02.50', action: '07.00', end: '12.00' }, // dur: ~14s
  'SS-D6-V023': { start: '02.50', action: '06.50', end: '11.50' }, // dur: ~13s
  'SS-D6-V024': { start: '02.50', action: '07.00', end: '11.50' }, // dur: ~13s
  'SS-D6-V025': { start: '02.50', action: '07.00', end: '11.50' }, // dur: ~13s
  'SS-D6-V026': { start: '02.50', action: '07.00', end: '11.50' }, // dur: ~13s
  'SS-D6-V027': { start: '02.50', action: '07.50', end: '12.50' }, // dur: ~14s
  'SS-D6-V028': { start: '03.00', action: '07.00', end: '12.00' }, // dur: ~14s
  'SS-D6-V029': { start: '02.50', action: '06.50', end: '12.00' }, // dur: ~14s
  'SS-D6-V030': { start: '02.50', action: '07.00', end: '12.50' }, // dur: ~15s
};

const AUTH_OWNER = '/tmp/auth-owner.json';
const AUTH_MANAGER = '/tmp/auth-manager.json';
const AUTH_FRONT_DESK = '/tmp/auth-front-desk.json';

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
  await page.waitForTimeout(1000);
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
  console.log('[AUTH] Authenticating fresh session as marcus.sterling@example.test (Manager)...');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#admin-email', { state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.fill('#admin-email', 'marcus.sterling@example.test');
  await page.fill('#admin-password', 'Password123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
  await context.storageState({ path: AUTH_MANAGER });
  await browser.close();
  console.log('[AUTH] Saved fresh manager session to', AUTH_MANAGER);
}

async function prepareFrontDeskAuthSession(force = false) {
  if (!force && fs.existsSync(AUTH_FRONT_DESK) && fs.statSync(AUTH_FRONT_DESK).size > 100) {
    console.log('[AUTH] Reusing existing front desk session from', AUTH_FRONT_DESK);
    return;
  }
  if (fs.existsSync(AUTH_FRONT_DESK)) {
    try { fs.unlinkSync(AUTH_FRONT_DESK); } catch {}
  }
  console.log('[AUTH] Authenticating fresh session as chloe.bennett@example.test (Front Desk)...');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#admin-email', { state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.fill('#admin-email', 'chloe.bennett@example.test');
  await page.fill('#admin-password', 'Password123!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
  await context.storageState({ path: AUTH_FRONT_DESK });
  await browser.close();
  console.log('[AUTH] Saved fresh front desk session to', AUTH_FRONT_DESK);
}

function extractRepresentativeFrames(assetId: string, mp4Path: string) {
  const ts = SEMANTIC_TIMESTAMPS[assetId];
  if (!ts) throw new Error(`Missing semantic timestamps for ${assetId}`);

  console.log(`[FRAMES] Extracting representative frames for ${assetId}...`);
  const startOut = path.join(OUT_FRAMES, `${assetId}-start.png`);
  const actionOut = path.join(OUT_FRAMES, `${assetId}-action.png`);
  const endOut = path.join(OUT_FRAMES, `${assetId}-end.png`);

  try {
    execSync(`${FFMPEG_BIN} -y -ss ${ts.start} -i "${mp4Path}" -vframes 1 "${startOut}"`, { stdio: 'pipe' });
    execSync(`${FFMPEG_BIN} -y -ss ${ts.action} -i "${mp4Path}" -vframes 1 "${actionOut}"`, { stdio: 'pipe' });
    execSync(`${FFMPEG_BIN} -y -ss ${ts.end} -i "${mp4Path}" -vframes 1 "${endOut}"`, { stdio: 'pipe' });
    console.log(`[FRAMES] Successfully extracted 3 frames for ${assetId} at [${ts.start}s, ${ts.action}s, ${ts.end}s]`);
  } catch (err) {
    console.warn(`[WARN] Frame extraction failed for ${assetId}:`, err);
  }
}

async function generateVideoContactSheet() {
  console.log('[REVIEW] Generating D6D Batch 3 Video Contact Sheet from extracted frames...');
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
      extractRepresentativeFrames(id, canonicalMp4);
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
      <text x="30" y="45" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="bold" fill="#F8FAFC">SprintScale CMS — Milestone D6D Batch 3 Video Review Storyboard</text>
      <text x="30" y="68" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#94A3B8">Essential Videos SS-D6-V021 → SS-D6-V030 | 3-Phase Instructional Storyboard (Start • Key Action • End State)</text>
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

  const contactSheetPath = path.join(OUT_REVIEW, 'd6d-batch-3-video-contact-sheet.png');
  await sharp(Buffer.from(bannerSvg))
    .composite(composites)
    .png()
    .toFile(contactSheetPath);

  console.log(`[SUCCESS] D6D Batch 3 Video Contact Sheet generated at: ${contactSheetPath}`);
}

async function recordSingleVideo(
  assetId: string,
  workflow: (page: Page) => Promise<number>,
  options: {
    authFile?: string;
    centreId?: string;
    viewport?: { width: number; height: number };
  } = {}
) {
  console.log(`\n======================================================`);
  console.log(`[RECORDING] Starting ${assetId}: ${TITLES[assetId]}...`);
  console.log(`======================================================`);

  const tmpDir = path.resolve(`/tmp/pw-rec-${assetId}-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const vp = options.viewport || { width: 1440, height: 900 };
  const contextOptions: Parameters<typeof browser.newContext>[0] = {
    viewport: vp,
    recordVideo: {
      dir: tmpDir,
      size: vp,
    },
  };

  if (options.authFile && fs.existsSync(options.authFile)) {
    contextOptions.storageState = options.authFile;
  }

  const context = await browser.newContext(contextOptions);

  if (options.centreId) {
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

  try {
    await workflow(page);
  } catch (err) {
    console.error(`[ERROR] Workflow failed for ${assetId}:`, err);
  } finally {
    await page.waitForTimeout(1000);
    await page.close();
    await context.close();
    await browser.close();
  }

  const videoFiles = fs.readdirSync(tmpDir).filter(f => f.endsWith('.webm') || f.endsWith('.mp4'));
  if (videoFiles.length === 0) {
    throw new Error(`No video recorded in ${tmpDir} for ${assetId}`);
  }

  const rawVideoPath = path.join(tmpDir, videoFiles[0]);
  const canonicalMp4 = path.join(OUT_VIDEOS, `${assetId}.mp4`);

  fs.copyFileSync(rawVideoPath, canonicalMp4);

  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}

  const stats = fs.statSync(canonicalMp4);
  console.log(`[SUCCESS] Saved canonical video: ${canonicalMp4} (${stats.size} bytes)`);

  extractRepresentativeFrames(assetId, canonicalMp4);
}

async function main() {
  await ensureDirs();

  const targetArg = process.argv[2];
  const shouldRun = (id: string) => !targetArg || targetArg === id || targetArg === 'all' || targetArg.split(',').includes(id);

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

  const centreRiverside = await db.query.centres.findFirst({
    where: and(eq(centres.organisationId, org.id), eq(centres.slug, 'riverside')),
  });
  if (!centreRiverside) throw new Error('Centre riverside not found.');

  const parentWalker = await db.query.parents.findFirst({
    where: and(eq(parents.organisationId, org.id), eq(parents.email, 'james.walker@example.test')),
  });
  if (!parentWalker) throw new Error('Parent James Walker not found.');

  const staffChloe = await db.query.users.findFirst({
    where: and(eq(users.organisationId, org.id), eq(users.email, 'chloe.bennett@example.test')),
  });
  if (!staffChloe) throw new Error('Staff Chloe Bennett not found.');

  const staffLiam = await db.query.users.findFirst({
    where: and(eq(users.organisationId, org.id), eq(users.email, 'liam.harper@example.test')),
  });
  if (!staffLiam) throw new Error('Staff Liam Harper not found.');

  const staffAlex = await db.query.users.findFirst({
    where: and(eq(users.organisationId, org.id), eq(users.email, 'alex.morgan@example.test')),
  });

  await prepareAuthSession(true);
  await prepareManagerAuthSession(true);
  await prepareFrontDeskAuthSession(true);

  // =========================================================================
  // SS-D6-V021: Managing Centre Bank Account Details
  // =========================================================================
  if (shouldRun('SS-D6-V021')) {
    await recordSingleVideo('SS-D6-V021', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/centres/${centreCentral.id}/settings`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('text=Oakridge Central', { timeout: 30000 });
      await page.waitForTimeout(2500); // 0.0s - 3.0s: Settled Starting State (General Tab)

      // 1. Switch to Billing tab
      const billingTabBtn = page.locator('button').filter({ hasText: 'Billing' }).first();
      await billingTabBtn.click();
      await page.waitForSelector('text="Bank details"', { timeout: 10000 });
      await page.waitForTimeout(600);

      // 2. Interactively configure bank account details
      const bankNameInput = page.locator('input[name="bankName"]');
      await bankNameInput.click();
      await bankNameInput.fill('Barclays Business');

      const sortCodeInput = page.locator('input[name="sortCode"]');
      await sortCodeInput.click();
      await sortCodeInput.fill('20-04-01');

      const accountNoInput = page.locator('input[name="accountNo"]');
      await accountNoInput.click();
      await accountNoInput.fill('83920194');
      await page.waitForTimeout(1800); // 07.00s: Action Frame (Active Bank Form with Unsaved Changes Bar)

      // 3. Save Changes
      const saveBtn = page.locator('button:has-text("Save changes")').first();
      await saveBtn.click();
      await page.waitForSelector('text=Unsaved changes', { state: 'hidden', timeout: 15000 });
      await page.waitForTimeout(2500); // 11.50s: End Frame (Settled Financial Configuration with saved details)

      return 13;
    }, { authFile: AUTH_OWNER });
  }

  // =========================================================================
  // SS-D6-V022: Inviting a New Staff Member via Email
  // =========================================================================
  if (shouldRun('SS-D6-V022')) {
    await recordSingleVideo('SS-D6-V022', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/staff/invite`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#invite-email', { timeout: 30000 });
      await page.waitForTimeout(2500); // 0.0s - 3.0s: Settled Starting State (Invite Form)

      // 1. Fill invitation form fields
      await page.fill('#invite-email', 'sophia.williams@example.test');
      await page.fill('#invite-first-name', 'Sophia');
      await page.fill('#invite-last-name', 'Williams');

      const centreSelect = page.locator('#invite-centre');
      if (await centreSelect.count() > 0) {
        await centreSelect.selectOption({ label: 'Oakridge Central' });
      }

      // 2. Select Front Desk role card
      const roleRadio = page.locator('input[value="FRONT_DESK"]').first();
      await roleRadio.click();
      await page.waitForTimeout(2000); // 07.00s: Action Frame (Completed Invite Form with Front Desk Role Selected)

      // 3. Send Invitation
      const sendBtn = page.locator('button[type="submit"]:has-text("Send invitation")').first();
      await sendBtn.click();
      await page.waitForURL('**/dashboard/staff**', { timeout: 15000 });

      // 4. Switch to Pending Invites tab to show settled result
      const pendingTab = page.locator('button').filter({ hasText: /Pending/ }).first();
      if (await pendingTab.count() > 0) {
        await pendingTab.click();
      }
      await page.waitForSelector('text=sophia.williams@example.test', { timeout: 15000 });
      await page.waitForTimeout(2500); // 12.00s: End Frame (Settled Staff Dashboard Pending Invites Tab)

      return 14;
    }, { authFile: AUTH_OWNER });
  }

  // =========================================================================
  // SS-D6-V023: Accepting a Staff Email Invitation
  // =========================================================================
  if (shouldRun('SS-D6-V023')) {
    await recordSingleVideo('SS-D6-V023', async (page) => {
      await page.goto(`${BASE_URL}/accept-invite?token=d6c-invite-token-synthetic-2026`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('text=You\'re invited!', { timeout: 30000 });
      await page.waitForSelector('text=sophie.reed@example.test', { timeout: 30000 });
      await page.waitForTimeout(2500); // 0.0s - 3.0s: Settled Starting State (Invitation Landing Card)

      // 1. Review invite details and prepare to accept
      await page.waitForTimeout(1500);

      // 2. Click Gradient CTA to Accept & Join Team
      const acceptBtn = page.locator('button:has-text("Join Team"), button:has-text("Accept"), button:has-text("Enter Dashboard"), div.backdrop-blur-lg button').first();
      await acceptBtn.click();
      await page.waitForTimeout(2000); // 06.50s: Action Frame (Accepting Invitation & Authenticating Session)

      // 3. Await redirect and settle on authenticated Dashboard
      await page.waitForURL('**/dashboard**', { timeout: 30000 });
      await page.waitForTimeout(3000); // 11.50s: End Frame (Settled Staff Dashboard Landing View)

      return 13;
    }); // Public unauthenticated context
  }

  // =========================================================================
  // SS-D6-V024: Scoping Staff Access Across Specific Centres
  // =========================================================================
  if (shouldRun('SS-D6-V024')) {
    await recordSingleVideo('SS-D6-V024', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/staff/${staffChloe.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('text=Chloe Bennett', { timeout: 30000 });
      await page.waitForTimeout(2500); // 0.0s - 3.0s: Settled Starting State (Staff Profile with 1 Centre)

      // 1. Scroll to Centre Assignments section
      const centreHeader = page.locator('h3').filter({ hasText: 'Centre assignments' }).first();
      await centreHeader.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);

      // 2. Check Oakridge Riverside checkbox
      const riversideLabel = page.locator('label').filter({ hasText: 'Oakridge Riverside' }).first();
      await riversideLabel.click();
      await page.waitForTimeout(1800); // 07.00s: Action Frame (Multi-Site Checkbox Checked with Unsaved Bar)

      // 3. Save Changes
      const saveBtn = page.locator('button:has-text("Save changes")').first();
      await saveBtn.click();
      await page.waitForSelector('text=Unsaved changes', { state: 'hidden', timeout: 15000 });
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      await page.waitForTimeout(2500); // 11.50s: End Frame (Settled Staff Profile with 2 Centres Assigned)

      return 13;
    }, { authFile: AUTH_OWNER });
  }

  // =========================================================================
  // SS-D6-V025: Updating Staff Role & Privileges
  // =========================================================================
  if (shouldRun('SS-D6-V025')) {
    await recordSingleVideo('SS-D6-V025', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/staff/${staffLiam.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('text=Liam Harper', { timeout: 30000 });
      await page.waitForTimeout(2500); // 0.0s - 3.0s: Settled Starting State (Staff Profile as Tutor)

      // 1. Select Front Desk role option
      const roleCard = page.locator('button').filter({ hasText: 'Front Desk' }).first();
      await roleCard.click();
      await page.waitForTimeout(1800); // 07.00s: Action Frame (Front Desk Role Card Active & Unsaved Bar Visible)

      // 2. Save Changes
      const saveBtn = page.locator('button:has-text("Save changes")').first();
      await saveBtn.click();
      await page.waitForSelector('text=Unsaved changes', { state: 'hidden', timeout: 15000 });
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      await page.waitForTimeout(2500); // 11.50s: End Frame (Settled Staff Profile with Updated Role Badge)

      return 13;
    }, { authFile: AUTH_OWNER });
  }

  // =========================================================================
  // SS-D6-V026: Safely Deactivating a Staff Member
  // =========================================================================
  if (shouldRun('SS-D6-V026')) {
    await recordSingleVideo('SS-D6-V026', async (page) => {
      const targetStaff = staffAlex || staffLiam;
      await page.goto(`${BASE_URL}/dashboard/staff/${targetStaff.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('text=Remove', { timeout: 30000 });
      await page.waitForTimeout(2500); // 0.0s - 3.0s: Settled Starting State

      // 1. Scroll to Remove action and click
      const removeBtn = page.locator('button').filter({ hasText: /Remove/ }).first();
      await removeBtn.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      await removeBtn.click();

      // 2. Await Deactivation Warning Modal
      const confirmBtn = page.locator('button:has-text("Yes, remove access")').first();
      await confirmBtn.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(1800); // 07.00s: Action Frame (Deactivation Warning Dialog Open)

      // 3. Confirm Deactivation
      await confirmBtn.click();
      await page.waitForURL('**/dashboard/staff**', { timeout: 15000 });
      await page.waitForSelector('table, div.space-y-6', { timeout: 30000 });
      await page.waitForTimeout(2500); // 11.50s: End Frame (Settled Staff List with Member Deactivated)

      return 13;
    }, { authFile: AUTH_OWNER });
  }

  // =========================================================================
  // SS-D6-V027: Broadcasting an Email to Consented Parents
  // =========================================================================
  if (shouldRun('SS-D6-V027')) {
    await recordSingleVideo('SS-D6-V027', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/communications`, { waitUntil: 'networkidle' });
      await page.waitForSelector('text=recipients', { timeout: 30000 });
      await page.locator('input[placeholder*="Important Update"]').first().waitFor({ state: 'visible', timeout: 30000 });
      await page.waitForTimeout(2500); // 0.0s - 3.0s: Settled Starting State (Compose Tab)

      // 1. Fill Broadcast Subject
      const subjectInput = page.locator('input[placeholder*="Important Update"]').first();
      await subjectInput.click();
      await subjectInput.fill('Autumn Term 2026 Timetable & Key Dates');

      // 2. Fill Broadcast Message Body
      const messageInput = page.locator('textarea[placeholder*="Type your message"]').first();
      await messageInput.click();
      await messageInput.fill('Dear Parents,\n\nPlease find the autumn term club schedule and key dates in your parent portal.\n\nBest regards,\nOakridge Central Management Team');
      await page.waitForTimeout(2000); // 07.50s: Action Frame (Completed Broadcast Message Body & Recipient Summary)

      // 3. Send Broadcast
      const sendBtn = page.locator('button:has-text("Send Broadcast")').first();
      await sendBtn.waitFor({ state: 'visible', timeout: 10000 });
      await sendBtn.click();
      await page.waitForSelector('text=Successfully queued message', { timeout: 20000 });

      // 4. Switch to History tab to display settled audit log
      const historyTab = page.locator('button:has-text("History")').first();
      if (await historyTab.count() > 0) {
        await historyTab.click();
      }
      await page.waitForSelector('table', { timeout: 15000 });
      await page.waitForTimeout(2500); // 12.50s: End Frame (Settled Broadcast Audit History View)

      return 14;
    }, { authFile: AUTH_MANAGER });
  }

  // =========================================================================
  // SS-D6-V028: Moving a Family to the 30-Day Recovery Bin
  // =========================================================================
  if (shouldRun('SS-D6-V028')) {
    await recordSingleVideo('SS-D6-V028', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/parents/${parentWalker.id}`, { waitUntil: 'networkidle' });
      await page.waitForSelector('text=James Walker', { timeout: 30000 });
      await page.waitForTimeout(3000); // 0.0s - 3.5s: Settled Starting State (Parent Profile)

      // 1. Click Delete family action in header
      const deleteBtn = page.locator('button:has-text("Delete family")').first();
      await deleteBtn.click();
      const confirmBtn = page.locator('button:has-text("Move to bin")').first();
      await confirmBtn.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(2000); // 07.00s: Action Frame (30-Day Retention Notice Confirmation Modal)

      // 2. Confirm Move to Bin
      await confirmBtn.click();
      await page.waitForURL('**/dashboard/parents**', { timeout: 15000 });
      await page.waitForSelector('table, div.space-y-6', { timeout: 30000 });
      await page.waitForTimeout(2500); // 12.00s: End Frame (Settled Parents List with Family Removed)

      return 14;
    }, { authFile: AUTH_FRONT_DESK });
  }

  // =========================================================================
  // SS-D6-V029: Restoring an Archived Family from Bin
  // =========================================================================
  if (shouldRun('SS-D6-V029')) {
    await recordSingleVideo('SS-D6-V029', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/parents/bin`, { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Recovery Bin', { timeout: 30000 });
      await page.waitForSelector('text=Rachel Taylor', { timeout: 30000 });
      await page.waitForTimeout(2500); // 0.0s - 3.0s: Settled Starting State (Recovery Bin Listing)

      // 1. Locate Rachel Taylor row and click Restore
      const row = page.locator('tbody tr').filter({ hasText: 'Rachel Taylor' }).first();
      const restoreBtn = row.locator('button:has-text("Restore")').first();
      await restoreBtn.click();
      const confirmBtn = page.locator('button:has-text("Yes, restore")').first();
      await confirmBtn.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(2000); // 06.50s: Action Frame (Restore Confirmation Dialog Open)

      // 2. Confirm Restore
      await confirmBtn.click();
      await page.waitForSelector('text=Restore family?', { state: 'hidden', timeout: 15000 });
      await page.waitForSelector('tbody tr:has-text("Rachel Taylor")', { state: 'hidden', timeout: 15000 });
      await page.waitForTimeout(3000); // 12.00s: End Frame (Settled Recovery Bin after Restoration)

      return 14;
    }, { authFile: AUTH_FRONT_DESK });
  }

  // =========================================================================
  // SS-D6-V030: Irreversible Permanent GDPR Family Purge
  // =========================================================================
  if (shouldRun('SS-D6-V030')) {
    await recordSingleVideo('SS-D6-V030', async (page) => {
      await page.goto(`${BASE_URL}/dashboard/parents/bin`, { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Recovery Bin', { timeout: 30000 });
      await page.waitForSelector('tbody tr', { timeout: 30000 });
      await page.waitForTimeout(2500); // 0.0s - 3.0s: Settled Starting State (Bin Listing with Delete Forever Icon)

      // 1. Locate target soft-deleted row for Hannah Scott and click Delete Forever trash icon
      const scottRow = page.locator('tbody tr').filter({ hasText: 'Hannah Scott' }).first();
      const deleteForeverBtn = scottRow.locator('button[title="Delete forever"]').first();
      await deleteForeverBtn.click();
      const confirmBtn = page.locator('div.fixed button:has-text("Delete forever")').first();
      await confirmBtn.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(2000); // 07.00s: Action Frame (Irreversible GDPR Destruction Modal Open)

      // 2. Confirm Permanent Deletion
      await confirmBtn.click();
      await page.waitForSelector('text=Permanently delete?', { state: 'hidden', timeout: 15000 });
      await page.waitForSelector('tbody tr:has-text("Hannah Scott")', { state: 'hidden', timeout: 15000 });
      await page.waitForTimeout(3000); // 12.50s: End Frame (Settled Recovery Bin after Permanent Deletion)

      return 15;
    }, { authFile: AUTH_OWNER });
  }

  // Build review contact sheet after runs
  await generateVideoContactSheet();
}

main().catch((err) => {
  console.error('[FATAL] Script execution failed:', err);
  process.exit(1);
});
