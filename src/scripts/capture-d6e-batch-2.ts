import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { chromium } from 'playwright';
import sharp from 'sharp';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

import { assertSafeTrainingEnvironment } from '../lib/training-guard';
import { db } from '../db';
import { organisations, parents, children, centres, bookings, bookingAttendees, users, invoices, registrations, notifications } from '../db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { signParentToken } from '../lib/parent-auth';

const FFMPEG_BIN = '/Users/KWADW/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac';
const BASE_URL = 'http://localhost:3000';
const OUT_VIDEOS = path.resolve('project-notes/documentation-training/assets/videos');
const OUT_REVIEW = path.resolve('project-notes/documentation-training/assets/review');
const OUT_FRAMES = path.join(OUT_REVIEW, 'd6e-batch-2-frames');

const ALL_ASSET_IDS = [
  'SS-D6-V043', 'SS-D6-V044', 'SS-D6-V045', 'SS-D6-V046', 'SS-D6-V047',
  'SS-D6-V048', 'SS-D6-V049', 'SS-D6-V050', 'SS-D6-V051', 'SS-D6-V052',
];

const TITLES: Record<string, string> = {
  'SS-D6-V043': 'Exporting Finance & Invoicing CSV',
  'SS-D6-V044': 'Editing Invoice Issue Date & Notes',
  'SS-D6-V045': 'Handling Failed Childcare Voucher Payment',
  'SS-D6-V046': 'Configuring Venue Operating Times',
  'SS-D6-V047': 'Reviewing In-App Header Notifications',
  'SS-D6-V048': 'Tracking Parent Email Broadcast Delivery',
  'SS-D6-V049': 'Declining an Incomplete Registration',
  'SS-D6-V050': 'Parent Updating Medical Info on Portal',
  'SS-D6-V051': 'Handling Zero-Centre Staff Assignment',
  'SS-D6-V052': 'Understanding System Rate Limit Throttling',
};

const SEMANTIC_TIMESTAMPS: Record<string, { start: string; action: string; end: string }> = {
  'SS-D6-V043': { start: '03.00', action: '06.00', end: '15.00' },
  'SS-D6-V044': { start: '03.00', action: '07.00', end: '12.00' },
  'SS-D6-V045': { start: '03.00', action: '08.50', end: '13.00' },
  'SS-D6-V046': { start: '02.50', action: '06.50', end: '10.50' },
  'SS-D6-V047': { start: '02.50', action: '06.00', end: '13.00' },
  'SS-D6-V048': { start: '02.50', action: '06.00', end: '13.00' },
  'SS-D6-V049': { start: '02.50', action: '05.50', end: '10.00' },
  'SS-D6-V050': { start: '02.50', action: '06.50', end: '10.50' },
  'SS-D6-V051': { start: '02.50', action: '06.50', end: '10.50' },
  'SS-D6-V052': { start: '02.50', action: '05.00', end: '08.00' },
};

const AUTH_OWNER = '/tmp/auth-owner.json';
const AUTH_MANAGER = '/tmp/auth-manager.json';
const AUTH_FRONT_DESK = '/tmp/auth-front-desk.json';
const AUTH_PARENT = '/tmp/auth-parent.json';

async function ensureDirs() {
  [OUT_VIDEOS, OUT_REVIEW, OUT_FRAMES].forEach((d) => {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  });
}

async function prepareAuthSession(email: string, pass: string, storagePath: string, force = false) {
  if (!force && fs.existsSync(storagePath) && fs.statSync(storagePath).size > 100) {
    console.log(`[AUTH] Reusing existing session for ${email} from ${storagePath}`);
    return;
  }
  if (fs.existsSync(storagePath)) {
    try { fs.unlinkSync(storagePath); } catch {}
  }
  console.log(`[AUTH] Authenticating fresh session as ${email}...`);
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#admin-email', { state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.fill('#admin-email', email);
  await page.fill('#admin-password', pass);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
  await context.storageState({ path: storagePath });
  await browser.close();
  console.log(`[AUTH] Saved fresh session for ${email} to ${storagePath}`);
}

async function prepareParentSession(parentEmail: string, storagePath: string, force = false) {
  if (!force && fs.existsSync(storagePath) && fs.statSync(storagePath).size > 100) {
    console.log(`[AUTH] Reusing existing parent session for ${parentEmail} from ${storagePath}`);
    return;
  }
  const parent = await db.query.parents.findFirst({
    where: eq(parents.email, parentEmail),
  });
  if (!parent) {
    throw new Error(`Parent with email ${parentEmail} not found`);
  }
  const token = await signParentToken(parent.id);
  const storageState = {
    cookies: [
      {
        name: 'parent_session',
        value: token,
        domain: 'localhost',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax' as const,
      },
    ],
    origins: [],
  };
  fs.writeFileSync(storagePath, JSON.stringify(storageState, null, 2));
  console.log(`[AUTH] Saved signed parent session for ${parentEmail} to ${storagePath}`);
}

function processRecordedVideo(recordingsDir: string, assetId: string) {
  const files = fs.readdirSync(recordingsDir).filter((f) => f.endsWith('.webm') || f.endsWith('.mp4'));
  if (files.length === 0) throw new Error(`No recording found for ${assetId}`);

  const rawVideo = path.join(recordingsDir, files[0]);
  const canonicalMp4 = path.join(OUT_VIDEOS, `${assetId}.mp4`);

  if (fs.existsSync(canonicalMp4)) {
    try { fs.unlinkSync(canonicalMp4); } catch {}
  }

  console.log(`[VIDEO] Saving canonical video: ${canonicalMp4}`);
  fs.copyFileSync(rawVideo, canonicalMp4);

  const stats = fs.statSync(canonicalMp4);
  console.log(`[VIDEO] Successfully generated: ${canonicalMp4} (${stats.size} bytes)`);
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
  console.log('[REVIEW] Generating D6E Batch 2 Video Contact Sheet from extracted frames...');
  const thumbW = 420;
  const thumbH = 262;
  const paddingX = 24;
  const paddingY = 24;
  const headerH = 100;
  const rowLabelH = 32;
  const gapX = 16;
  const gapY = 20;

  const totalW = paddingX * 2 + thumbW * 3 + gapX * 2; // 1336
  const totalH = headerH + paddingY + ALL_ASSET_IDS.length * (rowLabelH + thumbH + gapY) + paddingY;

  const composites: sharp.OverlayOptions[] = [];

  // Header SVG
  const headerSvg = `
    <svg width="${totalW}" height="${headerH}">
      <rect width="100%" height="100%" fill="#0a0d14"/>
      <text x="24" y="42" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="bold">SprintScale CMS — Milestone D6E Batch 2 Video Review Storyboard</text>
      <text x="24" y="70" fill="#00d4b8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="600">Final Videos SS-D6-V043 &amp;rarr; SS-D6-V052 | 3-Phase Instructional Storyboard (Start &amp;bull; Key Action &amp;bull; End State)</text>
    </svg>
  `;
  composites.push({ input: Buffer.from(headerSvg), top: 0, left: 0 });

  let currentY = headerH + paddingY;

  for (const assetId of ALL_ASSET_IDS) {
    const rawTitle = TITLES[assetId] || assetId;
    const escapedTitle = rawTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const labelSvg = `
      <svg width="${totalW}" height="${rowLabelH}">
        <text x="24" y="20" fill="#38bdf8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="bold">${assetId}: ${escapedTitle}</text>
      </svg>
    `;
    composites.push({ input: Buffer.from(labelSvg), top: currentY, left: 0 });
    currentY += rowLabelH;

    const phases = [
      { name: 'start', label: 'Phase 1: Starting State' },
      { name: 'action', label: 'Phase 2: Core Action / Interaction' },
      { name: 'end', label: 'Phase 3: Completed Outcome' },
    ];

    for (let i = 0; i < phases.length; i++) {
      const p = phases[i];
      const framePath = path.join(OUT_FRAMES, `${assetId}-${p.name}.png`);
      const left = paddingX + i * (thumbW + gapX);

      if (fs.existsSync(framePath)) {
        try {
          const resized = await sharp(framePath)
            .resize(thumbW, thumbH, { fit: 'cover' })
            .toBuffer();
          composites.push({ input: resized, top: currentY, left });
        } catch (e) {
          console.warn(`Could not read frame ${framePath}`, e);
        }
      }

      const phaseLabelSvg = `
        <svg width="${thumbW}" height="20">
          <text x="4" y="14" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="500">${p.label}</text>
        </svg>
      `;
      composites.push({ input: Buffer.from(phaseLabelSvg), top: currentY + thumbH + 4, left });
    }

    currentY += thumbH + gapY;
  }

  const outSheetPath = path.join(OUT_REVIEW, 'd6e-batch-2-video-contact-sheet.png');
  await sharp({
    create: {
      width: totalW,
      height: totalH,
      channels: 4,
      background: { r: 10, g: 13, b: 20, alpha: 1 },
    },
  })
    .composite(composites)
    .png()
    .toFile(outSheetPath);

  console.log(`[SUCCESS] D6E Batch 2 Video Contact Sheet generated at: ${outSheetPath}`);
}

// -------------------------------------------------------------
// V043: Exporting Finance & Invoicing CSV
// -------------------------------------------------------------
async function captureV043() {
  console.log('\n--- Capturing SS-D6-V043: Exporting Finance & Invoicing CSV ---');
  const recordingsDir = path.join(OUT_VIDEOS, 'raw_v043');
  if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext({
    storageState: AUTH_OWNER,
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: recordingsDir, size: { width: 1440, height: 900 } },
    acceptDownloads: true,
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/dashboard/finance`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1:has-text("Finance Ledger")', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(3500); // 0.0s - 3.5s: Settled Starting State

    const exportBtn = page.locator('a[title="Download finance CSV for current month"]').first();
    await exportBtn.waitFor({ state: 'visible', timeout: 10000 });

    // Hover over button
    await exportBtn.hover();
    await page.waitForTimeout(1500);

    // Click Export CSV and capture download event
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await exportBtn.click();
    const download = await downloadPromise;
    const downloadPath = '/tmp/' + download.suggestedFilename();
    await download.saveAs(downloadPath);
    console.log(`[V043] Captured CSV Download to: ${downloadPath} (${fs.statSync(downloadPath).size} bytes)`);

    await page.waitForTimeout(4000); // Settled end state post-download
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  const rawFiles = fs.readdirSync(recordingsDir).filter((f) => f.endsWith('.webm') || f.endsWith('.mp4'));
  if (rawFiles.length > 0) {
    processRecordedVideo(recordingsDir, 'SS-D6-V043');
    try { fs.rmSync(recordingsDir, { recursive: true, force: true }); } catch {}
    const finalMp4 = path.join(OUT_VIDEOS, 'SS-D6-V043.mp4');
    extractRepresentativeFrames('SS-D6-V043', finalMp4);
  }
}

// -------------------------------------------------------------
// V044: Editing Invoice Issue Date & Notes
// -------------------------------------------------------------
async function captureV044() {
  console.log('\n--- Capturing SS-D6-V044: Editing Invoice Issue Date & Notes ---');
  const org = await db.query.organisations.findFirst({ where: eq(organisations.slug, 'oakridge-learning') });
  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.organisationId, org!.id),
    orderBy: [desc(invoices.invoiceDate)],
  });
  if (!invoice) throw new Error('No invoice found for V044');

  // Reset notes to clean state before recording
  await db.update(invoices).set({ notes: null }).where(eq(invoices.id, invoice.id));

  const recordingsDir = path.join(OUT_VIDEOS, 'raw_v044');
  if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext({
    storageState: AUTH_OWNER,
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: recordingsDir, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/dashboard/finance/invoices/${invoice.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Payment Reconciliation Ledger', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(3000); // 0.0s - 3.0s: Settled Starting State

    // 1. Edit Issue Date
    const editDateBtn = page.locator('button[title="Edit Issue Date"]').first();
    if (await editDateBtn.count() > 0) {
      await editDateBtn.click({ force: true });
      await page.waitForTimeout(1000);

      const dateInput = page.locator('input[type="date"]').first();
      await dateInput.fill('2026-09-02');
      await page.waitForTimeout(500);

      const saveDateBtn = page.locator('button:has(svg.lucide-check)').first();
      await saveDateBtn.click();
      await page.waitForTimeout(1500);
    }

    // 2. Click Edit Note
    const editNoteBtn = page.locator('button:has-text("Edit Note")').first();
    await editNoteBtn.waitFor({ state: 'visible', timeout: 10000 });
    await editNoteBtn.click();
    await page.waitForTimeout(1000);

    const textarea = page.locator('textarea[placeholder*="Add custom notes"]').first();
    await textarea.waitFor({ state: 'visible', timeout: 10000 });
    await textarea.fill('Tuition fee includes all weekly club activities and organic snack provision.');
    await page.waitForTimeout(1500);

    // Click Save
    const saveBtn = page.locator('button:has-text("Save")').first();
    await saveBtn.click();
    await page.waitForTimeout(3500); // Settled end state with saved notes
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  const rawFiles = fs.readdirSync(recordingsDir).filter((f) => f.endsWith('.webm') || f.endsWith('.mp4'));
  if (rawFiles.length > 0) {
    processRecordedVideo(recordingsDir, 'SS-D6-V044');
    try { fs.rmSync(recordingsDir, { recursive: true, force: true }); } catch {}
    const finalMp4 = path.join(OUT_VIDEOS, 'SS-D6-V044.mp4');
    extractRepresentativeFrames('SS-D6-V044', finalMp4);
  }
}

// -------------------------------------------------------------
// V045: Handling Failed Childcare Voucher Payment
// -------------------------------------------------------------
async function captureV045() {
  console.log('\n--- Capturing SS-D6-V045: Handling Failed Childcare Voucher Payment ---');
  const recordingsDir = path.join(OUT_VIDEOS, 'raw_v045');
  if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext({
    storageState: AUTH_FRONT_DESK,
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: recordingsDir, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/dashboard/finance/reconciliation`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h2:has-text("Pending Invoices")', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(3500); // 0.0s - 3.5s: Settled Starting State

    // Select the first pending invoice button
    const firstInvoice = page.locator('button:has(div:has-text("INV-"))').first();
    await firstInvoice.waitFor({ state: 'visible', timeout: 10000 });
    await firstInvoice.click();
    await page.waitForTimeout(1500);

    // Select Tax-Free Childcare method
    const tfcBtn = page.locator('button:has-text("Tax-Free Childcare")').first();
    await tfcBtn.click();
    await page.waitForTimeout(500);

    // Fill invalid / duplicate amount and reference
    const amountInput = page.locator('input[type="number"]').first();
    await amountInput.fill('140.00');
    await page.waitForTimeout(500);

    const refInput = page.locator('input[placeholder*="JSMIT12345TFC"]').first();
    await refInput.fill('DUPLICATE-REF-ALREADY-USED');
    await page.waitForTimeout(1000);

    // Click Reconcile Payment to trigger validation / error feedback
    const reconcileBtn = page.locator('button:has-text("Reconcile Payment")').first();
    await reconcileBtn.click();
    await page.waitForTimeout(4000); // Settled feedback state
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  const rawFiles = fs.readdirSync(recordingsDir).filter((f) => f.endsWith('.webm') || f.endsWith('.mp4'));
  if (rawFiles.length > 0) {
    processRecordedVideo(recordingsDir, 'SS-D6-V045');
    try { fs.rmSync(recordingsDir, { recursive: true, force: true }); } catch {}
    const finalMp4 = path.join(OUT_VIDEOS, 'SS-D6-V045.mp4');
    extractRepresentativeFrames('SS-D6-V045', finalMp4);
  }
}

// -------------------------------------------------------------
// V046: Configuring Venue Operating Times
// -------------------------------------------------------------
async function captureV046() {
  console.log('\n--- Capturing SS-D6-V046: Configuring Venue Operating Times ---');
  const org = await db.query.organisations.findFirst({ where: eq(organisations.slug, 'oakridge-learning') });
  const centre = await db.query.centres.findFirst({ where: eq(centres.organisationId, org!.id) });
  if (!centre) throw new Error('No centre found for V046');

  const recordingsDir = path.join(OUT_VIDEOS, 'raw_v046');
  if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext({
    storageState: AUTH_MANAGER,
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: recordingsDir, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/dashboard/centres/${centre.id}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1:has-text("Oakridge")', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(3000); // 0.0s - 3.0s: Settled Starting State

    // Switch to Sessions tab
    const sessionsTab = page.locator('button:has-text("Sessions")').first();
    await sessionsTab.click();
    await page.waitForTimeout(1500);

    // Edit After School session operating end time (e.g. 18:00 -> 18:30)
    const endTimeInputs = page.locator('input[type="time"]');
    const inputCount = await endTimeInputs.count();
    if (inputCount >= 4) {
      // Index 3 is the second slot's end time (After School)
      const afterSchoolEnd = endTimeInputs.nth(3);
      await afterSchoolEnd.fill('18:30');
      await page.waitForTimeout(1000);
    } else if (inputCount >= 2) {
      const firstEnd = endTimeInputs.nth(1);
      await firstEnd.fill('18:30');
      await page.waitForTimeout(1000);
    }

    const saveBtn = page.locator('button[type="submit"]:has-text("Save changes")').first();
    await saveBtn.waitFor({ state: 'visible', timeout: 10000 });
    await saveBtn.click();
    await page.waitForTimeout(3500); // Settled end state
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  const rawFiles = fs.readdirSync(recordingsDir).filter((f) => f.endsWith('.webm') || f.endsWith('.mp4'));
  if (rawFiles.length > 0) {
    processRecordedVideo(recordingsDir, 'SS-D6-V046');
    try { fs.rmSync(recordingsDir, { recursive: true, force: true }); } catch {}
    const finalMp4 = path.join(OUT_VIDEOS, 'SS-D6-V046.mp4');
    extractRepresentativeFrames('SS-D6-V046', finalMp4);
  }
}

// -------------------------------------------------------------
// V047: Reviewing In-App Header Notifications
// -------------------------------------------------------------
async function captureV047() {
  console.log('\n--- Capturing SS-D6-V047: Reviewing In-App Header Notifications ---');
  // Seed unread notification if none exists
  const org = await db.query.organisations.findFirst({ where: eq(organisations.slug, 'oakridge-learning') });
  const user = await db.query.users.findFirst({ where: eq(users.email, 'chloe.bennett@example.test') });
  if (user) {
    await db.insert(notifications).values({
      organisationId: org!.id,
      userId: user.id,
      type: 'system',
      title: 'New Registration Submitted',
      message: 'Sarah Jenkins registered Oliver Jenkins for Autumn Term.',
      isRead: false,
    });
  }

  const recordingsDir = path.join(OUT_VIDEOS, 'raw_v047');
  if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext({
    storageState: AUTH_FRONT_DESK,
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: recordingsDir, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForSelector('button[aria-label="Notifications"]', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(3000); // 0.0s - 3.0s: Settled Starting State

    // Click Notification Bell
    const bellBtn = page.locator('button[aria-label="Notifications"]').first();
    await bellBtn.click();
    await page.waitForTimeout(2000);

    // Click Mark all as read
    const markReadBtn = page.locator('button:has-text("Mark all as read")').first();
    if (await markReadBtn.count() > 0) {
      await markReadBtn.click();
      await page.waitForTimeout(2000);
    }
    await page.waitForTimeout(2000); // Settled end state
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  const rawFiles = fs.readdirSync(recordingsDir).filter((f) => f.endsWith('.webm') || f.endsWith('.mp4'));
  if (rawFiles.length > 0) {
    processRecordedVideo(recordingsDir, 'SS-D6-V047');
    try { fs.rmSync(recordingsDir, { recursive: true, force: true }); } catch {}
    const finalMp4 = path.join(OUT_VIDEOS, 'SS-D6-V047.mp4');
    extractRepresentativeFrames('SS-D6-V047', finalMp4);
  }
}

// -------------------------------------------------------------
// V048: Tracking Parent Email Broadcast Delivery
// -------------------------------------------------------------
async function captureV048() {
  console.log('\n--- Capturing SS-D6-V048: Tracking Parent Email Broadcast Delivery ---');
  const recordingsDir = path.join(OUT_VIDEOS, 'raw_v048');
  if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext({
    storageState: AUTH_MANAGER,
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: recordingsDir, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/dashboard/communications`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1:has-text("Broadcast Messaging")', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(3000); // 0.0s - 3.0s: Settled Starting State

    // Switch to History tab
    const historyTab = page.locator('button:has-text("History & Audit Log")').first();
    await historyTab.click();
    await page.waitForTimeout(2000);

    // Click the first broadcast row to open slide-out detail drawer
    const row = page.locator('tbody tr[class*="cursor-pointer"]').first();
    if (await row.count() > 0) {
      await row.click();
      await page.waitForTimeout(2000);
      await page.waitForSelector('h2:has-text("Broadcast Details")', { state: 'visible', timeout: 10000 });
    }
    await page.waitForTimeout(3000); // Settled end state with drawer open
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  const rawFiles = fs.readdirSync(recordingsDir).filter((f) => f.endsWith('.webm') || f.endsWith('.mp4'));
  if (rawFiles.length > 0) {
    processRecordedVideo(recordingsDir, 'SS-D6-V048');
    try { fs.rmSync(recordingsDir, { recursive: true, force: true }); } catch {}
    const finalMp4 = path.join(OUT_VIDEOS, 'SS-D6-V048.mp4');
    extractRepresentativeFrames('SS-D6-V048', finalMp4);
  }
}

// -------------------------------------------------------------
// V049: Declining an Incomplete Registration
// -------------------------------------------------------------
async function captureV049() {
  console.log('\n--- Capturing SS-D6-V049: Declining an Incomplete Registration ---');
  const org = await db.query.organisations.findFirst({ where: eq(organisations.slug, 'oakridge-learning') });
  const reg = await db.query.registrations.findFirst({
    where: eq(registrations.organisationId, org!.id),
  });
  if (!reg) throw new Error('No registration found for V049');

  // Reset status to awaiting_confirmation
  await db.update(registrations).set({ status: 'awaiting_confirmation' }).where(eq(registrations.id, reg.id));

  const recordingsDir = path.join(OUT_VIDEOS, 'raw_v049');
  if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext({
    storageState: AUTH_MANAGER,
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: recordingsDir, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/dashboard/registrations/${reg.id}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('button:has-text("Update Status ▾")', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(3000); // 0.0s - 3.0s: Settled Starting State

    // Click Update Status dropdown
    const updateBtn = page.locator('button:has-text("Update Status ▾")').first();
    await updateBtn.click();
    await page.waitForTimeout(1000);

    // Select Not Interested
    const notInterestedBtn = page.locator('button[role="option"]:has-text("Not Interested")').first();
    await notInterestedBtn.click();
    await page.waitForTimeout(3500); // Settled updated state
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  const rawFiles = fs.readdirSync(recordingsDir).filter((f) => f.endsWith('.webm') || f.endsWith('.mp4'));
  if (rawFiles.length > 0) {
    processRecordedVideo(recordingsDir, 'SS-D6-V049');
    try { fs.rmSync(recordingsDir, { recursive: true, force: true }); } catch {}
    const finalMp4 = path.join(OUT_VIDEOS, 'SS-D6-V049.mp4');
    extractRepresentativeFrames('SS-D6-V049', finalMp4);
  }
}

// -------------------------------------------------------------
// V050: Parent Updating Medical Info on Portal
// -------------------------------------------------------------
async function captureV050() {
  console.log('\n--- Capturing SS-D6-V050: Parent Updating Medical Info on Portal ---');
  const org = await db.query.organisations.findFirst({ where: eq(organisations.slug, 'oakridge-learning') });
  const parent = await db.query.parents.findFirst({
    where: and(eq(parents.organisationId, org!.id), eq(parents.email, 'sarah.jenkins@example.test')),
  });
  const child = await db.query.children.findFirst({
    where: and(eq(children.parentId, parent!.id), eq(children.firstName, 'Oliver')),
  });
  if (!child) throw new Error('Child Oliver Jenkins not found for V050');

  const recordingsDir = path.join(OUT_VIDEOS, 'raw_v050');
  if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext({
    storageState: AUTH_PARENT,
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: recordingsDir, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/portal/children/${child.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h2:has-text("Medical & Dietary Needs")', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(3000); // 0.0s - 3.0s: Settled Starting State

    // Scroll to Add Medical Note form
    const textarea = page.locator('textarea[placeholder*="Allergic to peanuts"]').first();
    await textarea.scrollIntoViewIfNeeded();
    await textarea.fill('Mild seasonal grass pollen sensitivity in spring. No daily medication required.');
    await page.waitForTimeout(1500);

    const addBtn = page.locator('button[type="submit"]:has-text("Add Note")').first();
    await addBtn.click();
    await page.waitForTimeout(3500); // Settled updated state
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  const rawFiles = fs.readdirSync(recordingsDir).filter((f) => f.endsWith('.webm') || f.endsWith('.mp4'));
  if (rawFiles.length > 0) {
    processRecordedVideo(recordingsDir, 'SS-D6-V050');
    try { fs.rmSync(recordingsDir, { recursive: true, force: true }); } catch {}
    const finalMp4 = path.join(OUT_VIDEOS, 'SS-D6-V050.mp4');
    extractRepresentativeFrames('SS-D6-V050', finalMp4);
  }
}

// -------------------------------------------------------------
// V051: Handling Zero-Centre Staff Assignment
// -------------------------------------------------------------
async function captureV051() {
  console.log('\n--- Capturing SS-D6-V051: Handling Zero-Centre Staff Assignment ---');
  const org = await db.query.organisations.findFirst({ where: eq(organisations.slug, 'oakridge-learning') });
  const tutor = await db.query.users.findFirst({
    where: and(eq(users.organisationId, org!.id), eq(users.email, 'liam.harper@example.test')),
  });
  if (!tutor) throw new Error('Tutor Liam Harper not found for V051');

  const recordingsDir = path.join(OUT_VIDEOS, 'raw_v051');
  if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext({
    storageState: AUTH_OWNER,
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: recordingsDir, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/dashboard/staff/${tutor.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('text=Centre assignments', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(3000); // 0.0s - 3.0s: Settled Starting State

    // Click Clear all
    const clearAllBtn = page.locator('button:has-text("Clear all")').first();
    await clearAllBtn.click();
    await page.waitForTimeout(1500);

    // Verify warning banner appeared
    await page.waitForSelector('text=won\'t be able to access any bookings', { state: 'visible', timeout: 10000 });

    // Click Save changes
    const saveBtn = page.locator('button:has-text("Save changes")').first();
    await saveBtn.click();
    await page.waitForTimeout(3500); // Settled saved state
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  const rawFiles = fs.readdirSync(recordingsDir).filter((f) => f.endsWith('.webm') || f.endsWith('.mp4'));
  if (rawFiles.length > 0) {
    processRecordedVideo(recordingsDir, 'SS-D6-V051');
    try { fs.rmSync(recordingsDir, { recursive: true, force: true }); } catch {}
    const finalMp4 = path.join(OUT_VIDEOS, 'SS-D6-V051.mp4');
    extractRepresentativeFrames('SS-D6-V051', finalMp4);
  }
}

// -------------------------------------------------------------
// V052: Understanding System Rate Limit Throttling
// -------------------------------------------------------------
async function captureV052() {
  console.log('\n--- Capturing SS-D6-V052: Understanding System Rate Limit Throttling ---');
  const recordingsDir = path.join(OUT_VIDEOS, 'raw_v052');
  if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: recordingsDir, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  try {
    // Intercept /api/portal/login to return standard 429 rate limit payload
    await page.route('**/api/portal/login', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Too many login attempts. Please try again later.' }),
      });
    });

    await page.goto(`${BASE_URL}/portal/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#portal-login-email', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(3000); // 0.0s - 3.0s: Settled Starting State

    // Enter email
    const emailInput = page.locator('#portal-login-email').first();
    await emailInput.fill('parent@example.test');
    await page.waitForTimeout(1000);

    // Click Send Magic Link
    const sendBtn = page.locator('button[type="submit"]:has-text("Send Magic Link")').first();
    await sendBtn.click();
    await page.waitForTimeout(1000);

    // Observe error banner
    await page.waitForSelector('text=Too many login attempts', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(3500); // Settled feedback state
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  const rawFiles = fs.readdirSync(recordingsDir).filter((f) => f.endsWith('.webm') || f.endsWith('.mp4'));
  if (rawFiles.length > 0) {
    processRecordedVideo(recordingsDir, 'SS-D6-V052');
    try { fs.rmSync(recordingsDir, { recursive: true, force: true }); } catch {}
    const finalMp4 = path.join(OUT_VIDEOS, 'SS-D6-V052.mp4');
    extractRepresentativeFrames('SS-D6-V052', finalMp4);
  }
}

async function runProduction() {
  assertSafeTrainingEnvironment();
  await ensureDirs();

  const args = process.argv.slice(2);
  const isContactSheetOnly = args.includes('contact-sheet');
  const assetFilterArg = args.find((a) => a.startsWith('--assets='));
  const targetAssetIds = assetFilterArg
    ? assetFilterArg.replace('--assets=', '').split(',')
    : ALL_ASSET_IDS;

  if (isContactSheetOnly) {
    for (const id of ALL_ASSET_IDS) {
      const mp4Path = path.join(OUT_VIDEOS, `${id}.mp4`);
      if (fs.existsSync(mp4Path)) {
        extractRepresentativeFrames(id, mp4Path);
      }
    }
    await generateVideoContactSheet();
    return;
  }

  console.log('=== SprintScale CMS — Milestone D6E Batch 2 Video Production ===');
  console.log('Target assets:', targetAssetIds.join(', '));

  // Prepare auth states
  await prepareAuthSession('eleanor.vance@example.test', 'Password123!', AUTH_OWNER);
  await prepareAuthSession('marcus.sterling@example.test', 'Password123!', AUTH_MANAGER);
  await prepareAuthSession('chloe.bennett@example.test', 'Password123!', AUTH_FRONT_DESK);
  await prepareParentSession('sarah.jenkins@example.test', AUTH_PARENT);

  const captureMap: Record<string, () => Promise<void>> = {
    'SS-D6-V043': captureV043,
    'SS-D6-V044': captureV044,
    'SS-D6-V045': captureV045,
    'SS-D6-V046': captureV046,
    'SS-D6-V047': captureV047,
    'SS-D6-V048': captureV048,
    'SS-D6-V049': captureV049,
    'SS-D6-V050': captureV050,
    'SS-D6-V051': captureV051,
    'SS-D6-V052': captureV052,
  };

  for (const assetId of targetAssetIds) {
    const fn = captureMap[assetId];
    if (fn) {
      await fn();
    } else {
      console.warn(`[WARN] No capture function defined for ${assetId}`);
    }
  }

  await generateVideoContactSheet();
  console.log('\n=== [SUCCESS] Milestone D6E Batch 2 Production Complete ===');
}

runProduction().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
