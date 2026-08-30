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
import { organisations, parents } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { generateMagicLinkToken, hashToken } from '../lib/magic-link';

const FFMPEG_BIN = '/Users/KWADW/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac';
const BASE_URL = 'http://localhost:3000';
const OUT_VIDEOS = path.resolve('project-notes/documentation-training/assets/videos');
const OUT_REVIEW = path.resolve('project-notes/documentation-training/assets/review');
const OUT_FRAMES = path.join(OUT_REVIEW, 'd6d-batch-4-frames');

const ALL_ASSET_IDS = [
  'SS-D6-V031', 'SS-D6-V032',
];

const TITLES: Record<string, string> = {
  'SS-D6-V031': 'Parent Magic Link Sign-In & Portal Tour',
  'SS-D6-V032': 'Exporting Complete Organisation GDPR Data',
};

const SEMANTIC_TIMESTAMPS: Record<string, { start: string; action: string; end: string }> = {
  'SS-D6-V031': { start: '02.50', action: '06.50', end: '11.50' }, // dur: ~14s
  'SS-D6-V032': { start: '02.50', action: '06.00', end: '10.00' }, // dur: ~12s
};

const AUTH_OWNER = '/tmp/auth-owner.json';

async function ensureDirs() {
  [OUT_VIDEOS, OUT_REVIEW, OUT_FRAMES].forEach((d) => {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  });
}

async function prepareAuthSession(force = true) {
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
  console.log('[REVIEW] Generating D6D Batch 4 Video Contact Sheet from extracted frames...');
  const thumbW = 420;
  const thumbH = 262;
  const paddingX = 24;
  const paddingY = 24;
  const headerH = 100;
  const rowLabelH = 32;
  const rowH = rowLabelH + thumbH + 16;

  const totalW = paddingX * 2 + 3 * thumbW + 2 * 20;
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
      const left = paddingX + c * (thumbW + 20);
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
      <text x="30" y="45" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="bold" fill="#F8FAFC">SprintScale CMS — Milestone D6D Batch 4 Video Review Storyboard</text>
      <text x="30" y="68" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#94A3B8">Essential Videos SS-D6-V031 → SS-D6-V032 | 3-Phase Instructional Storyboard (Start • Key Action • End State)</text>
  `;

  for (let i = 0; i < ALL_ASSET_IDS.length; i++) {
    const id = ALL_ASSET_IDS[i];
    const title = (TITLES[id] || id).replace(/&/g, '&amp;');
    const rowTop = headerH + paddingY + i * rowH;

    bannerSvg += `
      <text x="${paddingX}" y="${rowTop + 20}" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="bold" fill="#38BDF8">${id}: ${title}</text>
      <text x="${paddingX}" y="${rowTop + rowLabelH + thumbH + 12}" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#64748B">Phase 1: Starting State</text>
      <text x="${paddingX + thumbW + 20}" y="${rowTop + rowLabelH + thumbH + 12}" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#64748B">Phase 2: Core Action / Interaction</text>
      <text x="${paddingX + 2 * (thumbW + 20)}" y="${rowTop + rowLabelH + thumbH + 12}" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#64748B">Phase 3: Completed Outcome</text>
    `;
  }

  bannerSvg += `</svg>`;
  composites.unshift({ input: Buffer.from(bannerSvg), left: 0, top: 0 });

  const contactSheetPath = path.join(OUT_REVIEW, 'd6d-batch-4-video-contact-sheet.png');
  await sharp({
    create: {
      width: totalW,
      height: totalH,
      channels: 4,
      background: { r: 11, g: 15, b: 25, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(contactSheetPath);

  console.log(`[SUCCESS] D6D Batch 4 Video Contact Sheet generated at: ${contactSheetPath}`);
}

async function recordSingleVideo(
  assetId: string,
  workflow: (page: Page) => Promise<number>,
  options: {
    authFile?: string;
  } = {}
) {
  console.log(`\n======================================================`);
  console.log(`[RECORDING] Starting ${assetId}: ${TITLES[assetId]}...`);
  console.log(`======================================================`);

  const tmpDir = fs.mkdtempSync('/tmp/playwright-record-');
  const vp = { width: 1440, height: 900 };

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

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
  const page = await context.newPage();

  try {
    await workflow(page);
  } catch (err) {
    console.error(`[ERROR] Workflow failed for ${assetId}:`, err);
    throw err;
  }

  await page.close();
  await context.close();
  await browser.close();

  const recordedFiles = fs.readdirSync(tmpDir).filter((f) => f.endsWith('.webm') || f.endsWith('.mp4'));
  if (recordedFiles.length === 0) {
    throw new Error(`[FATAL] No video captured for ${assetId}`);
  }

  const rawVideoPath = path.join(tmpDir, recordedFiles[0]);
  const canonicalMp4 = path.join(OUT_VIDEOS, `${assetId}.mp4`);

  if (fs.existsSync(canonicalMp4)) {
    try { fs.unlinkSync(canonicalMp4); } catch {}
  }

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

  console.log('[DATA] Retrieving organisation & parent fixtures...');
  const org = await db.query.organisations.findFirst({
    where: eq(organisations.slug, 'oakridge-learning'),
  });
  if (!org) throw new Error('Organisation oakridge-learning not found. Run seed script first.');

  const parentSarah = await db.query.parents.findFirst({
    where: and(eq(parents.organisationId, org.id), eq(parents.email, 'sarah.jenkins@example.test')),
  });
  if (!parentSarah) throw new Error('Parent Sarah Jenkins not found.');

  await prepareAuthSession(true);

  // =========================================================================
  // SS-D6-V031: Parent Magic Link Sign-In & Portal Tour
  // =========================================================================
  if (shouldRun('SS-D6-V031')) {
    await recordSingleVideo('SS-D6-V031', async (page) => {
      // 0. Set up valid magic link token in the training database
      const rawToken = generateMagicLinkToken();
      const hashedToken = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

      await db.update(parents)
        .set({ magicLinkToken: hashedToken, magicLinkExpiresAt: expiresAt })
        .where(eq(parents.id, parentSarah.id));

      await page.route('**/api/portal/login', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Check your email for the login link.',
            debugLink: `${BASE_URL}/portal/verify?token=${rawToken}`,
          }),
        });
      });

      // 0.0s - 2.5s: Settled Starting State (Parent Portal Login Page)
      await page.goto(`${BASE_URL}/portal/login`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#portal-login-email', { state: 'visible', timeout: 30000 });
      await page.waitForTimeout(2500);

      // 1. Fill email
      const emailInput = page.locator('#portal-login-email').first();
      await emailInput.click();
      await emailInput.fill('sarah.jenkins@example.test');
      await page.waitForTimeout(1000);

      // 2. Click Send Magic Link
      const sendBtn = page.locator('button:has-text("Send Magic Link")').first();
      await sendBtn.click();
      await page.waitForSelector('h3:has-text("Check your email!")', { timeout: 15000 });
      await page.waitForSelector('a[href*="/portal/verify"]', { timeout: 15000 });
      await page.waitForTimeout(2000); // ~06.50s: Action Frame (Magic Link Sent & Dev Link Available)

      // 3. Click verification link to authenticate
      const verifyLink = page.locator('a[href*="/portal/verify"]').first();
      await verifyLink.click();
      await page.waitForURL('**/portal**', { timeout: 30000 });
      await page.waitForSelector('h1:has-text("Portal")', { timeout: 30000 });
      await page.waitForTimeout(1500);

      // 4. Brief Portal Tour
      await page.mouse.wheel(0, 200);
      await page.waitForTimeout(2500); // ~11.50s: End Frame (Settled Parent Portal Dashboard)

      return 14;
    });
  }

  // =========================================================================
  // SS-D6-V032: Exporting Complete Organisation GDPR Data
  // =========================================================================
  if (shouldRun('SS-D6-V032')) {
    await recordSingleVideo('SS-D6-V032', async (page) => {
      // 0.0s - 2.5s: Settled Starting State (Danger Zone Tab)
      await page.goto(`${BASE_URL}/dashboard/settings?tab=danger_zone`, { waitUntil: 'networkidle' });
      await page.waitForSelector('text=Danger Zone', { timeout: 30000 });
      await page.waitForSelector('text=GDPR Data Export', { timeout: 30000 });
      await page.waitForTimeout(2500);

      // 1. Scroll into view of Privacy & Compliance
      await page.mouse.wheel(0, 150);
      await page.waitForTimeout(1000);

      // 2. Click Export Data
      const exportBtn = page.locator('button:has-text("Export Data")').first();
      await exportBtn.waitFor({ state: 'visible', timeout: 10000 });
      await exportBtn.click();
      await page.waitForTimeout(1500); // ~06.00s: Action Frame (Exporting State & Trigger)

      // 3. Wait for success toast
      await page.waitForSelector('text=Export ready', { timeout: 20000 });
      await page.waitForTimeout(2500); // ~10.00s: End Frame (Settled Export Download Completed with Toast)

      return 12;
    }, { authFile: AUTH_OWNER });
  }

  // Build review contact sheet after runs
  await generateVideoContactSheet();
}

main().catch((err) => {
  console.error('[FATAL] Script execution failed:', err);
  process.exit(1);
});
