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
import { organisations, parents, children, centres, bookings, bookingAttendees, users } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';

const FFMPEG_BIN = '/Users/KWADW/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac';
const BASE_URL = 'http://localhost:3000';
const OUT_VIDEOS = path.resolve('project-notes/documentation-training/assets/videos');
const OUT_REVIEW = path.resolve('project-notes/documentation-training/assets/review');
const OUT_FRAMES = path.join(OUT_REVIEW, 'd6e-batch-1-frames');

const ALL_ASSET_IDS = [
  'SS-D6-V033', 'SS-D6-V034', 'SS-D6-V035', 'SS-D6-V036', 'SS-D6-V037',
  'SS-D6-V038', 'SS-D6-V039', 'SS-D6-V040', 'SS-D6-V041', 'SS-D6-V042',
];

const TITLES: Record<string, string> = {
  'SS-D6-V033': 'Adding a New Parent Manually',
  'SS-D6-V034': 'Adding a Sibling to an Existing Family',
  'SS-D6-V035': 'Managing Authorised Pick-Up Collectors',
  'SS-D6-V036': 'Updating Pupil Medical & Allergy Profiles',
  'SS-D6-V037': 'Logging Student Homework & Progress Notes',
  'SS-D6-V038': 'Rescheduling an Existing Booking Slot',
  'SS-D6-V039': 'Cancelling a Booking Slot',
  'SS-D6-V040': 'Managing Recurring Booking Plans',
  'SS-D6-V041': 'Adjusting Attendance Arrival Timelogs',
  'SS-D6-V042': 'Exporting Daily Roll Call Attendance CSV',
};

const SEMANTIC_TIMESTAMPS: Record<string, { start: string; action: string; end: string }> = {
  'SS-D6-V033': { start: '02.50', action: '06.50', end: '11.00' },
  'SS-D6-V034': { start: '02.50', action: '06.50', end: '10.00' },
  'SS-D6-V035': { start: '02.50', action: '06.50', end: '11.00' },
  'SS-D6-V036': { start: '02.50', action: '06.00', end: '10.50' },
  'SS-D6-V037': { start: '03.00', action: '07.00', end: '11.50' },
  'SS-D6-V038': { start: '02.50', action: '06.00', end: '11.00' },
  'SS-D6-V039': { start: '02.50', action: '05.50', end: '11.00' },
  'SS-D6-V040': { start: '03.00', action: '07.00', end: '11.50' },
  'SS-D6-V041': { start: '03.00', action: '07.00', end: '11.50' },
  'SS-D6-V042': { start: '03.00', action: '06.50', end: '11.00' },
};

const AUTH_OWNER = '/tmp/auth-owner.json';
const AUTH_MANAGER = '/tmp/auth-manager.json';
const AUTH_FRONT_DESK = '/tmp/auth-front-desk.json';
const AUTH_TUTOR = '/tmp/auth-tutor.json';

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
  console.log('[REVIEW] Generating D6E Batch 1 Video Contact Sheet from extracted frames...');
  const thumbW = 420;
  const thumbH = 262;
  const paddingX = 24;
  const paddingY = 24;
  const headerH = 100;
  const rowLabelH = 32;
  const gapX = 16;
  const gapY = 20;

  const cols = 3;
  const rows = ALL_ASSET_IDS.length; // 10 rows

  const totalW = paddingX * 2 + cols * thumbW + (cols - 1) * gapX;
  const totalH = headerH + rows * (thumbH + rowLabelH + gapY) + paddingY;

  const svgHeader = `
    <svg width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#0b0f17"/>
      <text x="${paddingX}" y="42" fill="#f8fafc" font-size="22" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="700">SprintScale CMS — Milestone D6E Batch 1 Video Review Storyboard</text>
      <text x="${paddingX}" y="68" fill="#94a3b8" font-size="13" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="400">Remaining Videos SS-D6-V033 → SS-D6-V042 | 3-Phase Instructional Storyboard (Start • Key Action • End State)</text>
    </svg>
  `;

  const compositeInputs: sharp.OverlayOptions[] = [
    { input: Buffer.from(svgHeader), top: 0, left: 0 },
  ];

  for (let r = 0; r < rows; r++) {
    const assetId = ALL_ASSET_IDS[r];
    const rawTitle = TITLES[assetId] || assetId;
    const title = rawTitle.replace(/&/g, '&amp;');
    const rowY = headerH + r * (thumbH + rowLabelH + gapY);

    const rowLabelSvg = `
      <svg width="${totalW - paddingX * 2}" height="${rowLabelH}" xmlns="http://www.w3.org/2000/svg">
        <text x="0" y="20" fill="#38bdf8" font-size="15" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600">${assetId}: ${title}</text>
      </svg>
    `;
    compositeInputs.push({
      input: Buffer.from(rowLabelSvg),
      top: rowY,
      left: paddingX,
    });

    const phases = ['start', 'action', 'end'];
    for (let c = 0; c < 3; c++) {
      const phase = phases[c];
      const framePath = path.join(OUT_FRAMES, `${assetId}-${phase}.png`);
      const colX = paddingX + c * (thumbW + gapX);
      const imgY = rowY + rowLabelH;

      if (fs.existsSync(framePath)) {
        const thumbBuf = await sharp(framePath)
          .resize(thumbW, thumbH, { fit: 'cover' })
          .toBuffer();
        compositeInputs.push({ input: thumbBuf, top: imgY, left: colX });
      } else {
        const missingSvg = `
          <svg width="${thumbW}" height="${thumbH}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#1e293b"/>
            <text x="50%" y="50%" fill="#ef4444" font-size="14" font-family="sans-serif" font-weight="600" text-anchor="middle" dominant-baseline="middle">FRAME MISSING (${phase})</text>
          </svg>
        `;
        compositeInputs.push({ input: Buffer.from(missingSvg), top: imgY, left: colX });
      }

      const phaseLabels = ['Phase 1: Starting State', 'Phase 2: Core Action / Interaction', 'Phase 3: Completed Outcome'];
      const phaseSubLabelSvg = `
        <svg width="${thumbW}" height="18" xmlns="http://www.w3.org/2000/svg">
          <text x="4" y="13" fill="#64748b" font-size="11" font-family="sans-serif">${phaseLabels[c]}</text>
        </svg>
      `;
      compositeInputs.push({
        input: Buffer.from(phaseSubLabelSvg),
        top: imgY + thumbH + 2,
        left: colX,
      });
    }
  }

  const outSheet = path.join(OUT_REVIEW, 'd6e-batch-1-video-contact-sheet.png');
  await sharp({
    create: {
      width: totalW,
      height: totalH,
      channels: 4,
      background: '#0b0f17',
    },
  })
    .composite(compositeInputs)
    .png()
    .toFile(outSheet);

  console.log(`[SUCCESS] D6E Batch 1 Video Contact Sheet generated at: ${outSheet}`);
}

async function captureV033(recordingsDir: string) {
  console.log('\n--- [CAPTURE] SS-D6-V033: Adding a New Parent Manually ---');
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

  // 1. START state: Settled on /dashboard/students/add
  await page.goto(`${BASE_URL}/dashboard/students/add`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#firstName', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(2500);

  // 2. ACTION: Fill in student + new parent details and submit
  await page.fill('#firstName', 'Emily');
  await page.fill('#lastName', 'Watson');
  await page.fill('#dateOfBirth', '2018-04-12');
  await page.selectOption('#schoolYear', 'Y3');

  const centreSelect = page.locator('#centreId');
  if (await centreSelect.count() > 0) {
    const opts = await centreSelect.locator('option').all();
    if (opts.length > 1) {
      const val = await opts[1].getAttribute('value');
      if (val) await centreSelect.selectOption(val);
    }
  }

  await page.fill('#parentFirstName', 'James');
  await page.fill('#parentLastName', 'Watson');
  await page.fill('#parentEmail', 'james.watson@example.test');
  await page.fill('#parentPhone', '07700900888');
  await page.waitForTimeout(1000);

  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // 3. END state: Navigate to /dashboard/parents and show James Watson
  await page.goto(`${BASE_URL}/dashboard/parents?search=Watson`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('table', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(3000);

  await page.close();
  await context.close();
  await browser.close();
}

async function captureV034(recordingsDir: string) {
  console.log('\n--- [CAPTURE] SS-D6-V034: Adding a Sibling to an Existing Family ---');
  const org = await db.query.organisations.findFirst({ where: eq(organisations.slug, 'oakridge-learning') });
  const parent = await db.query.parents.findFirst({
    where: and(eq(parents.email, 'sarah.jenkins@example.test'), eq(parents.organisationId, org!.id)),
  });

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

  // 1. START state: Settled on /dashboard/students/add
  await page.goto(`${BASE_URL}/dashboard/students/add`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#firstName', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(2500);

  // 2. ACTION: Add Sibling for existing parent Sarah Jenkins
  await page.fill('#firstName', 'Leo');
  await page.fill('#lastName', 'Jenkins');
  await page.fill('#dateOfBirth', '2021-02-18');
  await page.selectOption('#schoolYear', 'Reception');

  const centreSelect = page.locator('#centreId');
  if (await centreSelect.count() > 0) {
    const opts = await centreSelect.locator('option').all();
    if (opts.length > 1) {
      const val = await opts[1].getAttribute('value');
      if (val) await centreSelect.selectOption(val);
    }
  }

  await page.fill('#parentFirstName', 'Sarah');
  await page.fill('#parentLastName', 'Jenkins');
  await page.fill('#parentEmail', 'sarah.jenkins@example.test');
  await page.fill('#parentPhone', '07700900111');
  await page.waitForTimeout(1000);

  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // 3. END state: Open Sarah Jenkins family profile showing linked siblings
  await page.goto(`${BASE_URL}/dashboard/parents/${parent!.id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1, h2', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(3000);

  await page.close();
  await context.close();
  await browser.close();
}

async function captureV035(recordingsDir: string) {
  console.log('\n--- [CAPTURE] SS-D6-V035: Managing Authorised Pick-Up Collectors ---');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: recordingsDir, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  // 1. START state: Registration form / collector section
  await page.goto(`${BASE_URL}/register/oakridge-learning`, { waitUntil: 'domcontentloaded' });

  const centreBtn = page.locator('button:has-text("Oakridge Central"), button:has-text("Central")').first();
  await centreBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  if (await centreBtn.isVisible()) {
    await centreBtn.click();
    await page.waitForTimeout(500);
  }

  const proceedBtn = page.locator('button:has-text("Proceed to Registration")').first();
  await proceedBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  if (await proceedBtn.isVisible()) {
    await proceedBtn.click();
    await page.waitForTimeout(500);
  }

  await page.waitForSelector('#p-fn-0', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(2000);

  // Parent Details
  await page.fill('#p-fn-0', 'Sarah');
  await page.fill('#p-ln-0', 'Jenkins');
  await page.selectOption('#p-rel-0', 'mother');
  await page.fill('#p-ph-0', '07700 900111');
  await page.fill('#p-em-0', 'sarah.jenkins@example.test');
  await page.fill('#p-a1-0', '10 Elm Road');
  await page.fill('#p-city-0', 'London');
  await page.fill('#p-pc-0', 'SE1 2AA');

  // Emergency Contact
  await page.fill('#ec-name', 'David Jenkins');
  await page.fill('#ec-rel', 'Father');
  await page.fill('#ec-phone', '07700 900222');
  await page.waitForTimeout(500);

  // Scroll down to Authorised Collectors
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(800);

  // 2. ACTION: Click Add Authorised Collector and fill details
  const addCollectorBtn = page.locator('button:has-text("Add Authorised Collector")').first();
  if (await addCollectorBtn.count() > 0) {
    await addCollectorBtn.click();
    await page.waitForTimeout(500);
    await page.fill('#ac-name-0', 'Arthur Jenkins');
    await page.fill('#ac-rel-0', 'Grandfather');
    await page.fill('#ac-ph-0', '07700 900123');
  }
  await page.waitForTimeout(2000);

  // 3. END state: Settled on configured collectors
  await page.waitForTimeout(3000);

  await page.close();
  await context.close();
  await browser.close();
}

async function captureV036(recordingsDir: string) {
  console.log('\n--- [CAPTURE] SS-D6-V036: Updating Pupil Medical & Allergy Profiles ---');
  const org = await db.query.organisations.findFirst({ where: eq(organisations.slug, 'oakridge-learning') });
  const child = await db.query.children.findFirst({
    where: and(eq(children.firstName, 'Oliver'), eq(children.lastName, 'Jenkins'), eq(children.organisationId, org!.id)),
  });

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

  // 1. START state: Settled Student Profile
  await page.goto(`${BASE_URL}/dashboard/students/${child!.id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1, h2', { timeout: 10000 });
  await page.waitForTimeout(2500);

  // 2. ACTION: Edit medical / allergy notes
  const editBtn = page.locator('button:has-text("Edit")').first();
  if (await editBtn.count() > 0) {
    await editBtn.click();
    await page.waitForTimeout(1000);
    const notesInput = page.locator('textarea[placeholder*="Allergies"]').first();
    if (await notesInput.count() > 0) {
      await notesInput.fill('Severe peanut allergy (EpiPen in Main Office). Mild seasonal asthma - emergency inhaler in school bag.');
    }
    await page.waitForTimeout(1000);
    const saveBtn = page.locator('button:has-text("Save")').first();
    if (await saveBtn.count() > 0) {
      await saveBtn.click();
    }
  }
  await page.waitForTimeout(2000);

  // 3. END state: Settled on updated profile with medical notes
  await page.waitForTimeout(3000);

  await page.close();
  await context.close();
  await browser.close();
}

async function captureV037(recordingsDir: string) {
  console.log('\n--- [CAPTURE] SS-D6-V037: Logging Student Homework & Progress Notes ---');
  const org = await db.query.organisations.findFirst({ where: eq(organisations.slug, 'oakridge-learning') });
  const child = await db.query.children.findFirst({
    where: and(eq(children.firstName, 'Oliver'), eq(children.lastName, 'Jenkins'), eq(children.organisationId, org!.id)),
  });

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

  // 1. START state: Student profile as Front Desk
  await page.goto(`${BASE_URL}/dashboard/students/${child!.id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1, h2', { timeout: 10000 });
  await page.waitForTimeout(3500);

  // 2. ACTION: Add Progress Note
  const expandBtn = page.locator('button:has-text("Add Progress Note")').first();
  if (await expandBtn.count() > 0) {
    await expandBtn.click();
    await page.waitForTimeout(800);
  }

  const progressChip = page.locator('button:has-text("Progress")').first();
  if (await progressChip.count() > 0) {
    await progressChip.click();
    await page.waitForTimeout(500);
  }

  const subjectSelect = page.locator('select').first();
  if (await subjectSelect.count() > 0) {
    await subjectSelect.selectOption('Homework Help');
    await page.waitForTimeout(500);
  }

  const ratingChip = page.locator('button:has-text("Good")').first();
  if (await ratingChip.count() > 0) {
    await ratingChip.click();
    await page.waitForTimeout(500);
  }

  const noteContent = page.locator('textarea').first();
  if (await noteContent.count() > 0) {
    await noteContent.fill('Completed Year 3 fractions worksheet with high accuracy. Solid grasp of equivalent denominators.');
  }

  const postBtn = page.locator('button:has-text("Save Note")').first();
  if (await postBtn.count() > 0) {
    await postBtn.click();
  }
  await page.waitForTimeout(2000);

  // 3. END state: Progress Timeline showing the newly posted note
  await page.waitForTimeout(4000);

  await page.close();
  await context.close();
  await browser.close();
}

async function captureV038(recordingsDir: string) {
  console.log('\n--- [CAPTURE] SS-D6-V038: Rescheduling an Existing Booking Slot ---');
  const org = await db.query.organisations.findFirst({ where: eq(organisations.slug, 'oakridge-learning') });
  const orgCentres = await db.query.centres.findMany({ where: eq(centres.organisationId, org!.id) });
  const centreIds = orgCentres.map(c => c.id);
  const booking = await db.query.bookings.findFirst({
    where: and(inArray(bookings.centreId, centreIds), eq(bookings.status, 'confirmed')),
  });

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

  // 1. START state: Booking Detail page
  await page.goto(`${BASE_URL}/dashboard/bookings/${booking!.id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1', { timeout: 10000 });
  await page.waitForTimeout(2500);

  // 2. ACTION: Open reschedule page and fill date/time
  await page.goto(`${BASE_URL}/dashboard/bookings/${booking!.id}/reschedule`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="date"]', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Future weekday date
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 4);
  if (targetDate.getDay() === 0) targetDate.setDate(targetDate.getDate() + 1);
  if (targetDate.getDay() === 6) targetDate.setDate(targetDate.getDate() + 2);
  const dateStr = targetDate.toISOString().split('T')[0];

  await page.fill('input[type="date"]', dateStr);
  await page.waitForTimeout(800);
  await page.fill('input[type="time"]', '16:00');
  await page.waitForTimeout(800);

  const confirmRescheduleBtn = page.locator('button[type="submit"]:has-text("Reschedule Booking")').first();
  if (await confirmRescheduleBtn.isEnabled()) {
    await confirmRescheduleBtn.click();
    await page.waitForTimeout(1500);
  }
  await page.waitForTimeout(1500);

  // 3. END state: Settle on updated Booking Detail
  await page.goto(`${BASE_URL}/dashboard/bookings/${booking!.id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1', { timeout: 10000 });
  await page.waitForTimeout(3000);

  await page.close();
  await context.close();
  await browser.close();
}

async function captureV039(recordingsDir: string) {
  console.log('\n--- [CAPTURE] SS-D6-V039: Cancelling a Booking Slot ---');
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

  // 1. START state: Bookings directory
  await page.goto(`${BASE_URL}/dashboard/bookings`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('table', { timeout: 10000 });
  await page.waitForTimeout(2500);

  // 2. ACTION: Open actions menu on first booking row and click Cancel Booking
  const menuBtn = page.locator('button[aria-label="Booking actions"]').first();
  if (await menuBtn.count() > 0) {
    await menuBtn.click();
    await page.waitForTimeout(800);
    const cancelOption = page.locator('button:has-text("Cancel Booking")').first();
    if (await cancelOption.count() > 0) {
      await cancelOption.click();
      await page.waitForTimeout(800);
      const confirmBtn = page.locator('button:has-text("Yes, Cancel")').first();
      if (await confirmBtn.count() > 0) {
        await confirmBtn.click();
      }
    }
  }
  await page.waitForTimeout(2000);

  // 3. END state: Settle on cancelled status filter/badge
  await page.goto(`${BASE_URL}/dashboard/bookings?status=cancelled`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('table', { timeout: 10000 });
  await page.waitForTimeout(3000);

  await page.close();
  await context.close();
  await browser.close();
}

async function captureV040(recordingsDir: string) {
  console.log('\n--- [CAPTURE] SS-D6-V040: Managing Recurring Booking Plans ---');
  const org = await db.query.organisations.findFirst({ where: eq(organisations.slug, 'oakridge-learning') });
  const orgCentres = await db.query.centres.findMany({ where: eq(centres.organisationId, org!.id) });
  const centre = orgCentres[0];

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

  // 1. START state: Bookings Directory
  await page.goto(`${BASE_URL}/dashboard/bookings`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('table', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(3500);

  // 2. ACTION: Navigate to /dashboard/bookings/new and view booking options
  await page.goto(`${BASE_URL}/dashboard/bookings/new?centreId=${centre.id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  // 3. END state: Overview of bookings roster on /dashboard/bookings
  await page.goto(`${BASE_URL}/dashboard/bookings`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('table', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(4000);

  await page.close();
  await context.close();
  await browser.close();
}

async function captureV041(recordingsDir: string) {
  console.log('\n--- [CAPTURE] SS-D6-V041: Adjusting Attendance Arrival Timelogs ---');
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

  // 1. START state: Settled on /dashboard/attendance
  await page.goto(`${BASE_URL}/dashboard/attendance`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  // 2. ACTION: Adjust arrival timelog on attendee card
  const checkInBtn = page.locator('button:has-text("Check In")').first();
  if (await checkInBtn.count() > 0) {
    await checkInBtn.click();
    await page.waitForTimeout(1000);
  }

  const timeInput = page.locator('input[type="time"]').first();
  if (await timeInput.count() > 0) {
    await timeInput.fill('15:40');
    await page.waitForTimeout(500);
    await timeInput.blur();
  }
  await page.waitForTimeout(2000);

  // 3. END state: Settled attendance register showing adjusted timelog
  await page.waitForTimeout(4000);

  await page.close();
  await context.close();
  await browser.close();
}

async function captureV042(recordingsDir: string) {
  console.log('\n--- [CAPTURE] SS-D6-V042: Exporting Daily Roll Call Attendance CSV ---');
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

  // 1. START state: Settled on /dashboard/attendance
  await page.goto(`${BASE_URL}/dashboard/attendance`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  // 2. ACTION: Hover / Click Export CSV button
  const exportBtn = page.locator('a:has-text("Export CSV")').first();
  if (await exportBtn.count() > 0) {
    await exportBtn.hover();
    await page.waitForTimeout(800);
    await exportBtn.click();
    await page.waitForTimeout(1000);
  }
  await page.waitForTimeout(2500);

  // 3. END state: Settled attendance register with export action complete
  await page.waitForTimeout(4000);

  await page.close();
  await context.close();
  await browser.close();
}

function processRecordedVideo(recordingsDir: string, assetId: string) {
  const files = fs.readdirSync(recordingsDir).filter(f => f.endsWith('.webm') || f.endsWith('.mp4'));
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

async function runProduction() {
  await assertSafeTrainingEnvironment();
  await ensureDirs();

  const args = process.argv.slice(2);
  const isContactSheetOnly = args.includes('contact-sheet');
  const assetFilterArg = args.find(a => a.startsWith('--assets='));
  const targetAssetIds = assetFilterArg
    ? assetFilterArg.replace('--assets=', '').split(',')
    : ALL_ASSET_IDS;

  if (isContactSheetOnly) {
    await generateVideoContactSheet();
    return;
  }

  console.log('=== SprintScale CMS — Milestone D6E Batch 1 Video Production ===');
  console.log('Target assets:', targetAssetIds.join(', '));

  // Prepare auth states
  await prepareAuthSession('eleanor.vance@example.test', 'Password123!', AUTH_OWNER);
  await prepareAuthSession('marcus.sterling@example.test', 'Password123!', AUTH_MANAGER);
  await prepareAuthSession('chloe.bennett@example.test', 'Password123!', AUTH_FRONT_DESK);
  await prepareAuthSession('liam.harper@example.test', 'Password123!', AUTH_TUTOR);

  const captureFuncs: Record<string, (dir: string) => Promise<void>> = {
    'SS-D6-V033': captureV033,
    'SS-D6-V034': captureV034,
    'SS-D6-V035': captureV035,
    'SS-D6-V036': captureV036,
    'SS-D6-V037': captureV037,
    'SS-D6-V038': captureV038,
    'SS-D6-V039': captureV039,
    'SS-D6-V040': captureV040,
    'SS-D6-V041': captureV041,
    'SS-D6-V042': captureV042,
  };

  for (const assetId of targetAssetIds) {
    const fn = captureFuncs[assetId];
    if (!fn) {
      console.warn(`[WARN] No capture handler found for ${assetId}`);
      continue;
    }
    const tempDir = `/tmp/rec-${assetId}`;
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    await fn(tempDir);
    processRecordedVideo(tempDir, assetId);
    fs.rmSync(tempDir, { recursive: true, force: true });

    const mp4Path = path.join(OUT_VIDEOS, `${assetId}.mp4`);
    extractRepresentativeFrames(assetId, mp4Path);
  }

  await generateVideoContactSheet();
  console.log('\n=== [SUCCESS] Milestone D6E Batch 1 Production Complete ===');
}

runProduction().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
