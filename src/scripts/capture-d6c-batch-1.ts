import { chromium, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import * as dotenv from 'dotenv';
import postgres from 'postgres';
import { assertSafeTrainingEnvironment } from '@/lib/training-guard';
import { signParentToken } from '@/lib/parent-auth';

dotenv.config({ path: '.env.local' });
dotenv.config();

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
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
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#admin-email', { state: 'visible', timeout: 60000 });
  await page.fill('#admin-email', email);
  await page.fill('#admin-password', 'Password123!');
  await page.click('form button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
  console.log(`[LOGIN] Logged in as ${email}! Current URL: ${page.url()}`);
  await page.waitForTimeout(600);
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

async function main() {
  // 1. Safety Guard Verification
  assertSafeTrainingEnvironment();
  await ensureDirs();

  const connectionString = process.env.DATABASE_URL!;
  const sql = postgres(connectionString, { ssl: 'require', max: 1 });

  // Query Oakridge records
  const [org] = await sql`SELECT id, name, slug FROM organisations WHERE slug = 'oakridge-learning'`;
  if (!org) throw new Error('Oakridge organisation not found. Please run training seed.');

  const centres = await sql`SELECT id, name, slug FROM centres WHERE organisation_id = ${org.id} ORDER BY name ASC`;
  const centreCentral = centres.find((c) => c.slug === 'central') || centres[0];

  const parents = await sql`SELECT id, first_name, last_name, email FROM parents WHERE organisation_id = ${org.id}`;
  const parentJenkins = parents.find((p) => p.email === 'sarah.jenkins@example.test') || parents[0];
  const parentPatel = parents.find((p) => p.email === 'david.patel@example.test') || parents[1];

  console.log(`[DATA] Org: ${org.name} (${org.id})`);
  console.log(`[DATA] Centre Central: ${centreCentral.name} (${centreCentral.id})`);
  console.log(`[DATA] Parent Sarah Jenkins: ${parentJenkins.id}`);
  console.log(`[DATA] Parent David Patel: ${parentPatel.id}`);

  await sql.end();

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const annotationsMap: Record<string, Annotation[]> = {};

  // =========================================================================
  // SS-D6-S047: Parent Portal Family Home View
  // =========================================================================
  console.log('[CAPTURE] SS-D6-S047: Parent Portal Family Home View...');
  {
    const jenkinsToken = await signParentToken(parentJenkins.id);
    const parentCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await parentCtx.addCookies([
      {
        name: 'parent_session',
        value: jenkinsToken,
        url: BASE_URL,
      },
    ]);

    const page = await parentCtx.newPage();
    await page.goto(`${BASE_URL}/portal`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector("h1:has-text(\"Sarah's Portal\")", { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(800);

    const s47Source = path.join(OUT_SOURCE, 'SS-D6-S047-source.png');
    const s47Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S047.png');
    await page.screenshot({ path: s47Source, fullPage: false });

    const boxQuickAction = await getElementBox(page, 'a[href="/portal/book"]', 6);
    const boxChildren = await getElementBox(page, 'section:has(h2:has-text("My Children"))', 8);
    const boxUpcoming = await getElementBox(page, 'section:has(h2:has-text("Upcoming Sessions"))', 8);

    annotationsMap['SS-D6-S047'] = [
      { ...boxQuickAction, badge: 1 },
      { ...boxChildren, badge: 2 },
      { ...boxUpcoming, badge: 3 },
    ];
    await annotateImage(s47Source, s47Annotated, annotationsMap['SS-D6-S047']);
    await parentCtx.close();
    console.log('[SUCCESS] SS-D6-S047 captured and annotated.');
  }

  // =========================================================================
  // SS-D6-S048: Parent Portal Booking Wizard
  // =========================================================================
  console.log('[CAPTURE] SS-D6-S048: Parent Portal Booking Wizard...');
  {
    const jenkinsToken = await signParentToken(parentJenkins.id);
    const parentCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await parentCtx.addCookies([
      {
        name: 'parent_session',
        value: jenkinsToken,
        url: BASE_URL,
      },
    ]);

    const page = await parentCtx.newPage();
    await page.goto(`${BASE_URL}/portal/book`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('h2:has-text("Who is this booking for?")', { state: 'visible', timeout: 30000 });

    // Select Oliver Jenkins
    const childBtn = page.locator('button:has-text("Oliver Jenkins")');
    if (await childBtn.isVisible()) {
      await childBtn.click();
      await page.waitForTimeout(400);
    }

    const s48Source = path.join(OUT_SOURCE, 'SS-D6-S048-source.png');
    const s48Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S048.png');
    await page.screenshot({ path: s48Source, fullPage: false });

    const boxChildOliver = await getElementBox(page, 'button:has-text("Oliver Jenkins")', 6);
    const boxChildEmma = await getElementBox(page, 'button:has-text("Emma Jenkins")', 6);
    const boxNextBtn = await getElementBox(page, 'button:has-text("Next")', 6);

    annotationsMap['SS-D6-S048'] = [
      { ...boxChildOliver, badge: 1 },
      { ...boxChildEmma, badge: 2 },
      { ...boxNextBtn, badge: 3 },
    ];
    await annotateImage(s48Source, s48Annotated, annotationsMap['SS-D6-S048']);
    await parentCtx.close();
    console.log('[SUCCESS] SS-D6-S048 captured and annotated.');
  }

  // =========================================================================
  // SS-D6-S049: Parent Portal Billing & Invoices List
  // =========================================================================
  console.log('[CAPTURE] SS-D6-S049: Parent Portal Billing & Invoices List...');
  {
    const patelToken = await signParentToken(parentPatel.id);
    const parentCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await parentCtx.addCookies([
      {
        name: 'parent_session',
        value: patelToken,
        url: BASE_URL,
      },
    ]);

    const page = await parentCtx.newPage();
    await page.goto(`${BASE_URL}/portal/billing`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('h1:has-text("Billing & Invoices")', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(800);

    const s49Source = path.join(OUT_SOURCE, 'SS-D6-S049-source.png');
    const s49Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S049.png');
    await page.screenshot({ path: s49Source, fullPage: false });

    const boxBalance = await getElementBox(page, 'section:has-text("Total Outstanding Balance")', 8);
    const boxInvoice = await getElementBox(page, '#outstanding-invoices .space-y-4 > div', 8);
    const boxVoucher = await getElementBox(page, 'form:has-text("Log Childcare Voucher Payment")', 6);

    annotationsMap['SS-D6-S049'] = [
      { ...boxBalance, badge: 1 },
      { ...boxInvoice, badge: 2 },
      { ...boxVoucher, badge: 3 },
    ];
    await annotateImage(s49Source, s49Annotated, annotationsMap['SS-D6-S049']);
    await parentCtx.close();
    console.log('[SUCCESS] SS-D6-S049 captured and annotated.');
  }

  // =========================================================================
  // SS-D6-S050: Passwordless Magic Link Login Prompt
  // =========================================================================
  console.log('[CAPTURE] SS-D6-S050: Passwordless Magic Link Login Prompt...');
  {
    const authCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await authCtx.newPage();
    await page.goto(`${BASE_URL}/portal/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#portal-login-email', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(600);

    const s50Source = path.join(OUT_SOURCE, 'SS-D6-S050-source.png');
    const s50Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S050.png');
    await page.screenshot({ path: s50Source, fullPage: false });

    const boxEmailInput = await getElementBox(page, 'div:has(> #portal-login-email)', 6);
    const boxSubmitBtn = await getElementBox(page, 'button[type="submit"]', 6);

    const cardEl = await page.waitForSelector('.max-w-md .p-8', { state: 'visible' });
    const cardBox = await cardEl.boundingBox();
    const fullHeaderBox = {
      x: Math.round(cardBox!.x + 10),
      y: Math.round(cardBox!.y + 10),
      width: Math.round(cardBox!.width - 20),
      height: 180,
    };

    annotationsMap['SS-D6-S050'] = [
      { ...fullHeaderBox, badge: 1 },
      { ...boxEmailInput, badge: 2 },
      { ...boxSubmitBtn, badge: 3 },
    ];
    await annotateImage(s50Source, s50Annotated, annotationsMap['SS-D6-S050']);
    await authCtx.close();
    console.log('[SUCCESS] SS-D6-S050 captured and annotated.');
  }

  // =========================================================================
  // SS-D6-S051: Passwordless Login Email Verification
  // =========================================================================
  console.log('[CAPTURE] SS-D6-S051: Passwordless Login Email Verification...');
  {
    const authCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await authCtx.newPage();
    await page.route('**/api/portal/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Check your email for the login link.' }),
      });
    });
    await page.goto(`${BASE_URL}/portal/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#portal-login-email', { state: 'visible', timeout: 30000 });
    await page.fill('#portal-login-email', 'sarah.jenkins@example.test');
    await page.click('button[type="submit"]');

    await page.waitForSelector('h3:has-text("Check your email!")', { state: 'visible', timeout: 20000 });
    await page.waitForTimeout(600);

    const s51Source = path.join(OUT_SOURCE, 'SS-D6-S051-source.png');
    const s51Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S051.png');
    await page.screenshot({ path: s51Source, fullPage: false });

    const boxConfirmCard = await getElementBox(page, 'div.bg-success\\/10', 8);
    const boxTargetEmail = await getElementBox(page, 'div.bg-success\\/10 p:first-of-type', 6);
    const boxResendAction = await getElementBox(page, 'button:has-text("Try another email")', 6);

    annotationsMap['SS-D6-S051'] = [
      { ...boxConfirmCard, badge: 1 },
      { ...boxTargetEmail, badge: 2 },
      { ...boxResendAction, badge: 3 },
    ];
    await annotateImage(s51Source, s51Annotated, annotationsMap['SS-D6-S051']);
    await authCtx.close();
    console.log('[SUCCESS] SS-D6-S051 captured and annotated.');
  }

  // =========================================================================
  // SS-D6-S052: Staff Cryptographic Invite Acceptance
  // =========================================================================
  console.log('[CAPTURE] SS-D6-S052: Staff Cryptographic Invite Acceptance...');
  {
    const inviteCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await inviteCtx.newPage();
    await page.goto(`${BASE_URL}/accept-invite?token=d6c-invite-token-synthetic-2026`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForSelector('h1:has-text("You\'re invited!")', { state: 'visible', timeout: 20000 });
    await page.waitForTimeout(800);

    const s52Source = path.join(OUT_SOURCE, 'SS-D6-S052-source.png');
    const s52Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S052.png');
    await page.screenshot({ path: s52Source, fullPage: false });

    const boxHeading = await getElementBox(page, 'h1:has-text("You\'re invited!")', 10);
    const boxEmailBadge = await getElementBox(page, 'div.rounded-full:has-text("sophie.reed@example.test")', 6);
    const boxAcceptBtn = await getElementBox(page, 'button:has-text("Enter Dashboard")', 6);

    annotationsMap['SS-D6-S052'] = [
      { ...boxHeading, badge: 1 },
      { ...boxEmailBadge, badge: 2 },
      { ...boxAcceptBtn, badge: 3 },
    ];
    await annotateImage(s52Source, s52Annotated, annotationsMap['SS-D6-S052']);
    await inviteCtx.close();
    console.log('[SUCCESS] SS-D6-S052 captured and annotated.');
  }

  // =========================================================================
  // STAFF SESSION (SS-D6-S053, S054, S055, S056)
  // =========================================================================
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

  const staffPage = await staffCtx.newPage();
  await loginUser(staffPage, 'eleanor.vance@example.test');

  // SS-D6-S053: Header Notification Bell & Alerts Dropdown
  console.log('[CAPTURE] SS-D6-S053: Header Notification Bell & Alerts Dropdown...');
  {
    await staffPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await staffPage.waitForSelector('button[aria-label="Notifications"]', { state: 'visible', timeout: 30000 });
    await staffPage.waitForTimeout(500);

    // Click Notification Bell
    await staffPage.click('button[aria-label="Notifications"]');
    await staffPage.waitForSelector('#notifications-menu', { state: 'visible', timeout: 10000 });
    await staffPage.waitForSelector('#notifications-menu button', { state: 'visible', timeout: 10000 });
    await staffPage.waitForTimeout(800);

    const s53Source = path.join(OUT_SOURCE, 'SS-D6-S053-source.png');
    const s53Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S053.png');
    await staffPage.screenshot({ path: s53Source, fullPage: false });

    const boxBell = await getElementBox(staffPage, 'button[aria-label="Notifications"]', 4);
    const boxDropdown = await getElementBox(staffPage, '#notifications-menu', 4);
    const boxNotifItem = await getElementBox(staffPage, '#notifications-menu button:first-of-type', 4);

    annotationsMap['SS-D6-S053'] = [
      { ...boxBell, badge: 1 },
      { ...boxDropdown, badge: 2 },
      { ...boxNotifItem, badge: 3 },
    ];
    await annotateImage(s53Source, s53Annotated, annotationsMap['SS-D6-S053']);
    console.log('[SUCCESS] SS-D6-S053 captured and annotated.');
  }

  // SS-D6-S054: Organisation Profile & Contact Details
  console.log('[CAPTURE] SS-D6-S054: Organisation Profile & Contact Details...');
  {
    await staffPage.goto(`${BASE_URL}/dashboard/settings?tab=general`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await staffPage.waitForSelector('h1:has-text("Workspace Settings")', { state: 'visible', timeout: 30000 });
    await staffPage.waitForSelector('button:has-text("General Info")', { state: 'visible', timeout: 30000 });
    await staffPage.waitForTimeout(800);

    const s54Source = path.join(OUT_SOURCE, 'SS-D6-S054-source.png');
    const s54Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S054.png');
    await staffPage.screenshot({ path: s54Source, fullPage: false });

    const boxTabGeneral = await getElementBox(staffPage, 'button:has-text("General Info")', 6);
    const boxOrgIdentity = await getElementBox(staffPage, 'div.grid.grid-cols-1.sm\\:grid-cols-2', 8);
    const boxOrgContact = await getElementBox(staffPage, 'div.grid.grid-cols-1.sm\\:grid-cols-3', 8);

    annotationsMap['SS-D6-S054'] = [
      { ...boxTabGeneral, badge: 1 },
      { ...boxOrgIdentity, badge: 2 },
      { ...boxOrgContact, badge: 3 },
    ];
    await annotateImage(s54Source, s54Annotated, annotationsMap['SS-D6-S054']);
    console.log('[SUCCESS] SS-D6-S054 captured and annotated.');
  }

  // SS-D6-S055: GDPR Subject Access JSON Export Button
  console.log('[CAPTURE] SS-D6-S055: GDPR Subject Access JSON Export Button...');
  {
    await staffPage.goto(`${BASE_URL}/dashboard/settings?tab=danger_zone`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await staffPage.waitForSelector('button:has-text("Danger Zone")', { state: 'visible', timeout: 30000 });
    await staffPage.click('button:has-text("Danger Zone")');
    await staffPage.waitForSelector('h3:has-text("GDPR Data Export")', { state: 'visible', timeout: 30000 });
    await staffPage.waitForSelector('button:has-text("Export Data")', { state: 'visible', timeout: 30000 });
    await staffPage.waitForTimeout(800);

    const s55Source = path.join(OUT_SOURCE, 'SS-D6-S055-source.png');
    const s55Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S055.png');
    await staffPage.screenshot({ path: s55Source, fullPage: false });

    const boxTabDanger = await getElementBox(staffPage, 'button:has-text("Danger Zone")', 6);
    const boxPrivacyText = await getElementBox(staffPage, 'div.bg-card.rounded-2xl:has(button:has-text("Export Data"))', 6);
    const boxExportBtn = await getElementBox(staffPage, 'button:has-text("Export Data")', 6);

    annotationsMap['SS-D6-S055'] = [
      { ...boxTabDanger, badge: 1 },
      { ...boxPrivacyText, badge: 2 },
      { ...boxExportBtn, badge: 3 },
    ];
    await annotateImage(s55Source, s55Annotated, annotationsMap['SS-D6-S055']);
    console.log('[SUCCESS] SS-D6-S055 captured and annotated.');
  }

  // SS-D6-S056: Venue Operating Times Configuration
  console.log('[CAPTURE] SS-D6-S056: Venue Operating Times Configuration...');
  {
    await staffPage.goto(`${BASE_URL}/dashboard/centres/${centreCentral.id}/settings`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await staffPage.waitForSelector('h1:has-text("Oakridge Central")', { state: 'visible', timeout: 30000 });

    // Click Sessions tab
    await staffPage.click('button:has-text("Sessions")');
    await staffPage.waitForSelector('h2:has-text("Session builder")', { state: 'visible', timeout: 15000 });
    await staffPage.waitForSelector('button:has-text("Add session")', { state: 'visible', timeout: 15000 });
    await staffPage.waitForTimeout(800);

    const s56Source = path.join(OUT_SOURCE, 'SS-D6-S056-source.png');
    const s56Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S056.png');
    await staffPage.screenshot({ path: s56Source, fullPage: false });

    const boxTabSessions = await getElementBox(staffPage, 'button:has-text("Sessions")', 6);
    const boxSlotsList = await getElementBox(staffPage, 'div.space-y-3:has(div.bg-page)', 8);
    const boxAddSlotBtn = await getElementBox(staffPage, 'button:has-text("Add session")', 6);

    annotationsMap['SS-D6-S056'] = [
      { ...boxTabSessions, badge: 1 },
      { ...boxSlotsList, badge: 2 },
      { ...boxAddSlotBtn, badge: 3 },
    ];
    await annotateImage(s56Source, s56Annotated, annotationsMap['SS-D6-S056']);
    console.log('[SUCCESS] SS-D6-S056 captured and annotated.');
  }

  await staffCtx.close();

  // =========================================================================
  // Generate Batch 1 Review Contact Sheet
  // =========================================================================
  console.log('[REVIEW] Generating D6C Batch 1 Contact Sheet...');
  const assetIds = [
    'SS-D6-S047', 'SS-D6-S048', 'SS-D6-S049', 'SS-D6-S050', 'SS-D6-S051',
    'SS-D6-S052', 'SS-D6-S053', 'SS-D6-S054', 'SS-D6-S055', 'SS-D6-S056'
  ];

  const titles: Record<string, string> = {
    'SS-D6-S047': 'Parent Portal Family Home View',
    'SS-D6-S048': 'Parent Portal Booking Wizard',
    'SS-D6-S049': 'Parent Portal Billing & Invoices List',
    'SS-D6-S050': 'Passwordless Magic Link Login Prompt',
    'SS-D6-S051': 'Passwordless Login Email Verification',
    'SS-D6-S052': 'Staff Cryptographic Invite Acceptance',
    'SS-D6-S053': 'Header Notification Bell & Alerts Dropdown',
    'SS-D6-S054': 'Organisation Profile & Contact Details',
    'SS-D6-S055': 'GDPR Subject Access JSON Export Button',
    'SS-D6-S056': 'Venue Operating Times Configuration',
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
      <text x="30" y="45" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="bold" fill="#F8FAFC">SprintScale CMS — Milestone D6C Batch 1 Visual Review</text>
      <text x="30" y="68" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#94A3B8">Remaining Screenshots SS-D6-S047 → SS-D6-S056 | Oakridge Learning Trust | Verified Synthetic Data</text>
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

  const contactSheetPath = path.join(OUT_REVIEW, 'd6c-batch-1-contact-sheet.png');
  await sharp(Buffer.from(bannerSvg))
    .composite(composites)
    .png()
    .toFile(contactSheetPath);

  console.log(`[SUCCESS] D6C Batch 1 Contact sheet generated at: ${contactSheetPath}`);

  await browser.close();
}

main().catch((err) => {
  console.error('[FATAL CAPTURE ERROR]', err);
  process.exit(1);
});
