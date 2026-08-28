import { chromium, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import * as dotenv from 'dotenv';
import postgres from 'postgres';
import { assertSafeTrainingEnvironment } from '@/lib/training-guard';

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

  const users = await sql`SELECT id, first_name, last_name, email, role FROM users WHERE organisation_id = ${org.id}`;
  const eleanorUser = users.find((u) => u.email === 'eleanor.vance@example.test') || users[0];

  const parents = await sql`SELECT id, first_name, last_name, email FROM parents WHERE organisation_id = ${org.id}`;
  const parentJenkins = parents.find((p) => p.email === 'sarah.jenkins@example.test') || parents[0];
  const parentPatel = parents.find((p) => p.email === 'david.patel@example.test') || parents[1];

  const children = await sql`SELECT id, first_name, last_name FROM children WHERE organisation_id = ${org.id}`;
  const childOliver = children.find((c) => c.first_name === 'Oliver') || children[0];

  const invoices = await sql`SELECT id, invoice_number, amount, status FROM invoices WHERE organisation_id = ${org.id} ORDER BY invoice_number ASC`;
  const inv3 = invoices.find((i) => i.invoice_number === 'INV-2026-003') || invoices[invoices.length - 1];

  console.log(`[DATA] Org: ${org.name} (${org.id})`);
  console.log(`[DATA] Centre Central: ${centreCentral.name} (${centreCentral.id})`);
  console.log(`[DATA] Eleanor User: ${eleanorUser.id}`);
  console.log(`[DATA] Parent Jenkins: ${parentJenkins.id}`);
  console.log(`[DATA] Parent Patel: ${parentPatel.id}`);
  console.log(`[DATA] Child Oliver: ${childOliver.id}`);
  console.log(`[DATA] Invoice 3: ${inv3?.id} (${inv3?.invoice_number})`);

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
  await loginUser(page, 'eleanor.vance@example.test');

  const annotationsMap: Record<string, Annotation[]> = {};

  // =========================================================================
  // SS-D6-S057: New Centre Venue Creation Modal / Form
  // =========================================================================
  console.log('[CAPTURE] SS-D6-S057: New Centre Venue Creation Modal...');
  {
    await page.goto(`${BASE_URL}/dashboard/centres/add`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#name', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(600);

    const s57Source = path.join(OUT_SOURCE, 'SS-D6-S057-source.png');
    const s57Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S057.png');
    await page.screenshot({ path: s57Source, fullPage: false });

    const boxName = await getElementBox(page, 'div:has(> #name)', 6);
    const boxAddress = await getElementBox(page, 'div:has(> #address)', 6);
    const boxSubmit = await getElementBox(page, 'button[type="submit"]', 6);

    annotationsMap['SS-D6-S057'] = [
      { ...boxName, badge: 1 },
      { ...boxAddress, badge: 2 },
      { ...boxSubmit, badge: 3 },
    ];
    await annotateImage(s57Source, s57Annotated, annotationsMap['SS-D6-S057']);
    console.log('[SUCCESS] SS-D6-S057 captured and annotated.');
  }

  // =========================================================================
  // SS-D6-S058: Staff Self-Demotion Blocked Guard
  // =========================================================================
  console.log('[CAPTURE] SS-D6-S058: Staff Self-Demotion Blocked Guard...');
  {
    await page.goto(`${BASE_URL}/dashboard/staff/${eleanorUser.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('text=You cannot change the role of the only Owner', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(600);

    const s58Source = path.join(OUT_SOURCE, 'SS-D6-S058-source.png');
    const s58Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S058.png');
    await page.screenshot({ path: s58Source, fullPage: false });

    const boxOwnerBtn = await getElementBox(page, 'button:has(span:has-text("Owner"))', 6);
    const boxDisabledManager = await getElementBox(page, 'button:has(span:has-text("Manager"))', 6);
    const boxGuardAlert = await getElementBox(page, 'div.bg-page.border:has-text("You cannot change the role")', 6);

    annotationsMap['SS-D6-S058'] = [
      { ...boxOwnerBtn, badge: 1 },
      { ...boxDisabledManager, badge: 2 },
      { ...boxGuardAlert, badge: 3 },
    ];
    await annotateImage(s58Source, s58Annotated, annotationsMap['SS-D6-S058']);
    console.log('[SUCCESS] SS-D6-S058 captured and annotated.');
  }

  // =========================================================================
  // SS-D6-S059: Broadcast History & Delivery Counters
  // =========================================================================
  console.log('[CAPTURE] SS-D6-S059: Broadcast History & Delivery Counters...');
  {
    await page.goto(`${BASE_URL}/dashboard/communications`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('button:has-text("History & Audit Log")', { state: 'visible', timeout: 30000 });
    await page.click('button:has-text("History & Audit Log")');
    // Wait for the broadcasts to load and appear in the table
    await page.waitForSelector('table tbody tr:has-text("Autumn Term")', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(600);

    const s59Source = path.join(OUT_SOURCE, 'SS-D6-S059-source.png');
    const s59Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S059.png');
    await page.screenshot({ path: s59Source, fullPage: false });

    const boxHistoryTab = await getElementBox(page, 'button:has-text("History & Audit Log")', 6);
    const boxFirstRow = await getElementBox(page, 'table tbody tr:first-of-type', 6);
    const boxCounters = await getElementBox(page, 'table tbody tr:first-of-type td:nth-child(3)', 6);

    annotationsMap['SS-D6-S059'] = [
      { ...boxHistoryTab, badge: 1 },
      { ...boxFirstRow, badge: 2 },
      { ...boxCounters, badge: 3 },
    ];
    await annotateImage(s59Source, s59Annotated, annotationsMap['SS-D6-S059']);
    console.log('[SUCCESS] SS-D6-S059 captured and annotated.');
  }

  // =========================================================================
  // SS-D6-S060: Recovery Bin Family Record Restore Modal
  // =========================================================================
  console.log('[CAPTURE] SS-D6-S060: Recovery Bin Family Record Restore Modal...');
  {
    await page.goto(`${BASE_URL}/dashboard/parents/bin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('button:has-text("Restore")', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(400);

    // Click Restore button to open confirmation modal
    await page.click('button:has-text("Restore")');
    await page.waitForSelector('h3:has-text("Restore family?")', { state: 'visible', timeout: 10000 });
    await page.waitForSelector('button:has-text("Yes, restore")', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(600);

    const s60Source = path.join(OUT_SOURCE, 'SS-D6-S060-source.png');
    const s60Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S060.png');
    await page.screenshot({ path: s60Source, fullPage: false });

    const boxModal = await getElementBox(page, 'div.max-w-sm:has(h3:has-text("Restore family?"))', 6);
    const boxDesc = await getElementBox(page, 'p:has-text("This will restore")', 4);
    const boxRestoreBtn = await getElementBox(page, 'button:has-text("Yes, restore")', 4);

    annotationsMap['SS-D6-S060'] = [
      { ...boxModal, badge: 1 },
      { ...boxDesc, badge: 2 },
      { ...boxRestoreBtn, badge: 3 },
    ];
    await annotateImage(s60Source, s60Annotated, annotationsMap['SS-D6-S060']);
    console.log('[SUCCESS] SS-D6-S060 captured and annotated.');

    // Dismiss modal cleanly
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(300);
  }

  // =========================================================================
  // SS-D6-S061: Soft-Delete Confirmation Dialog
  // =========================================================================
  console.log('[CAPTURE] SS-D6-S061: Soft-Delete Confirmation Dialog...');
  {
    await page.goto(`${BASE_URL}/dashboard/parents/${parentPatel.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('button:has-text("Delete family")', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(400);

    // Click Delete family to trigger confirmation modal (do not click confirm)
    await page.click('button:has-text("Delete family")');
    await page.waitForSelector('h3:has-text("Delete family?")', { state: 'visible', timeout: 10000 });
    await page.waitForSelector('button:has-text("Move to bin")', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(600);

    const s61Source = path.join(OUT_SOURCE, 'SS-D6-S061-source.png');
    const s61Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S061.png');
    await page.screenshot({ path: s61Source, fullPage: false });

    const boxModal = await getElementBox(page, 'div.bg-surface:has(h3:has-text("Delete family?"))', 6);
    const boxWarning = await getElementBox(page, 'p:has-text("This will move David Patel")', 4);
    const boxMoveBtn = await getElementBox(page, 'button:has-text("Move to bin")', 4);

    annotationsMap['SS-D6-S061'] = [
      { ...boxModal, badge: 1 },
      { ...boxWarning, badge: 2 },
      { ...boxMoveBtn, badge: 3 },
    ];
    await annotateImage(s61Source, s61Annotated, annotationsMap['SS-D6-S061']);
    console.log('[SUCCESS] SS-D6-S061 captured and annotated.');

    // Dismiss dialog cleanly
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(300);
  }

  // =========================================================================
  // SS-D6-S062: Owner Invoice Voiding Confirmation Modal
  // =========================================================================
  console.log('[CAPTURE] SS-D6-S062: Owner Invoice Voiding Confirmation Modal...');
  {
    await page.goto(`${BASE_URL}/dashboard/finance/invoices/${inv3.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('button:has-text("Void")', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(400);

    // Click Void button to trigger confirmation modal (do not click confirm)
    await page.click('button:has-text("Void")');
    await page.waitForSelector('h2:has-text("Void Invoice")', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(600);

    const s62Source = path.join(OUT_SOURCE, 'SS-D6-S062-source.png');
    const s62Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S062.png');
    await page.screenshot({ path: s62Source, fullPage: false });

    const boxModal = await getElementBox(page, 'div.bg-card.border:has(h2:has-text("Void Invoice"))', 6);
    const boxVoidWarning = await getElementBox(page, 'p:has-text("will be marked as VOID")', 4);
    const boxConfirmVoidBtn = await getElementBox(page, 'button.bg-amber-500:has-text("Void Invoice")', 4);

    annotationsMap['SS-D6-S062'] = [
      { ...boxModal, badge: 1 },
      { ...boxVoidWarning, badge: 2 },
      { ...boxConfirmVoidBtn, badge: 3 },
    ];
    await annotateImage(s62Source, s62Annotated, annotationsMap['SS-D6-S062']);
    console.log('[SUCCESS] SS-D6-S062 captured and annotated.');

    // Dismiss modal cleanly
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(300);
  }

  // =========================================================================
  // SS-D6-S063: Invoice Date & Notes Edit Dialog
  // =========================================================================
  console.log('[CAPTURE] SS-D6-S063: Invoice Date & Notes Edit Dialog...');
  {
    await page.goto(`${BASE_URL}/dashboard/finance/invoices/${inv3.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('button:has-text("Preview")', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(800);

    // Hover over group/date and click edit button
    await page.hover('.group\\/date');
    await page.click('button[title="Edit Issue Date"]');
    await page.waitForSelector('input[type="date"]', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(600);

    const s63Source = path.join(OUT_SOURCE, 'SS-D6-S063-source.png');
    const s63Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S063.png');
    await page.screenshot({ path: s63Source, fullPage: false });

    const boxDateInput = await getElementBox(page, 'div:has(> input[type="date"])', 6);
    const boxSaveBtn = await getElementBox(page, 'button:has(svg.lucide-check)', 4);
    const boxAmountHeader = await getElementBox(page, 'div.text-right:has-text("Total Amount")', 6);

    annotationsMap['SS-D6-S063'] = [
      { ...boxDateInput, badge: 1 },
      { ...boxSaveBtn, badge: 2 },
      { ...boxAmountHeader, badge: 3 },
    ];
    await annotateImage(s63Source, s63Annotated, annotationsMap['SS-D6-S063']);
    console.log('[SUCCESS] SS-D6-S063 captured and annotated.');
  }

  // =========================================================================
  // SS-D6-S064: Childcare Voucher Rejection / Failed Modal / Reconciliation Form
  // =========================================================================
  console.log('[CAPTURE] SS-D6-S064: Childcare Voucher Reconciliation Form...');
  {
    await page.goto(`${BASE_URL}/dashboard/finance/reconciliation`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('button:has-text("INV-2026-")', { state: 'visible', timeout: 30000 });

    // Select the pending invoice
    await page.click('button:has-text("INV-2026-")');
    await page.waitForSelector('button:has-text("Tax-Free Childcare")', { state: 'visible', timeout: 10000 });
    await page.waitForSelector('button:has-text("Reconcile Payment")', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(600);

    const s64Source = path.join(OUT_SOURCE, 'SS-D6-S064-source.png');
    const s64Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S064.png');
    await page.screenshot({ path: s64Source, fullPage: false });

    const boxSelectedInv = await getElementBox(page, 'button:has-text("INV-2026-")', 6);
    const boxPaymentMethods = await getElementBox(page, 'div.space-y-2:has(button:has-text("Tax-Free Childcare"))', 6);
    const boxReconcileBtn = await getElementBox(page, 'button:has-text("Reconcile Payment")', 6);

    annotationsMap['SS-D6-S064'] = [
      { ...boxSelectedInv, badge: 1 },
      { ...boxPaymentMethods, badge: 2 },
      { ...boxReconcileBtn, badge: 3 },
    ];
    await annotateImage(s64Source, s64Annotated, annotationsMap['SS-D6-S064']);
    console.log('[SUCCESS] SS-D6-S064 captured and annotated.');
  }

  // =========================================================================
  // SS-D6-S065: Multi-Child Family Sibling Linkage View
  // =========================================================================
  console.log('[CAPTURE] SS-D6-S065: Multi-Child Family Sibling Linkage View...');
  {
    await page.goto(`${BASE_URL}/dashboard/parents/${parentJenkins.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('p:has-text("Associated children")', { state: 'visible', timeout: 30000 });
    await page.waitForSelector('a[href*="/dashboard/students/"]:has-text("Oliver Jenkins")', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(600);

    const s65Source = path.join(OUT_SOURCE, 'SS-D6-S065-source.png');
    const s65Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S065.png');
    await page.screenshot({ path: s65Source, fullPage: false });

    const boxChildrenSection = await getElementBox(page, 'div:has(> p:has-text("Associated children"))', 6);
    const boxChild1 = await getElementBox(page, 'a[href*="/dashboard/students/"]:has-text("Oliver Jenkins")', 4);
    const boxChild2 = await getElementBox(page, 'a[href*="/dashboard/students/"]:has-text("Emma Jenkins")', 4);

    annotationsMap['SS-D6-S065'] = [
      { ...boxChildrenSection, badge: 1 },
      { ...boxChild1, badge: 2 },
      { ...boxChild2, badge: 3 },
    ];
    await annotateImage(s65Source, s65Annotated, annotationsMap['SS-D6-S065']);
    console.log('[SUCCESS] SS-D6-S065 captured and annotated.');
  }

  // =========================================================================
  // SS-D6-S066: Student Academic Scorecard & Progress
  // =========================================================================
  console.log('[CAPTURE] SS-D6-S066: Student Academic Scorecard & Progress...');
  {
    await page.goto(`${BASE_URL}/dashboard/students/${childOliver.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('p:has-text("Progress & notes")', { state: 'visible', timeout: 30000 });
    await page.waitForSelector('text=Oliver showed great enthusiasm', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(600);

    const s66Source = path.join(OUT_SOURCE, 'SS-D6-S066-source.png');
    const s66Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S066.png');
    await page.screenshot({ path: s66Source, fullPage: false });

    const boxProgressHeader = await getElementBox(page, 'p:has-text("Progress & notes")', 6);
    const boxFilterTabs = await getElementBox(page, 'div.flex.flex-wrap.gap-1\\.5:has(button:has-text("All"))', 6);
    const boxTimelineCard = await getElementBox(page, 'div.rounded-md.border:has-text("Oliver showed great enthusiasm")', 6);

    annotationsMap['SS-D6-S066'] = [
      { ...boxProgressHeader, badge: 1 },
      { ...boxFilterTabs, badge: 2 },
      { ...boxTimelineCard, badge: 3 },
    ];
    await annotateImage(s66Source, s66Annotated, annotationsMap['SS-D6-S066']);
    console.log('[SUCCESS] SS-D6-S066 captured and annotated.');
  }

  await staffCtx.close();

  // =========================================================================
  // Generate Batch 2 Review Contact Sheet
  // =========================================================================
  console.log('[REVIEW] Generating D6C Batch 2 Contact Sheet...');
  const assetIds = [
    'SS-D6-S057', 'SS-D6-S058', 'SS-D6-S059', 'SS-D6-S060', 'SS-D6-S061',
    'SS-D6-S062', 'SS-D6-S063', 'SS-D6-S064', 'SS-D6-S065', 'SS-D6-S066'
  ];

  const titles: Record<string, string> = {
    'SS-D6-S057': 'New Centre Venue Creation Modal',
    'SS-D6-S058': 'Staff Self-Demotion Blocked Guard',
    'SS-D6-S059': 'Broadcast History & Delivery Counters',
    'SS-D6-S060': 'Recovery Bin Family Record Restore Modal',
    'SS-D6-S061': 'Soft-Delete Confirmation Dialog',
    'SS-D6-S062': 'Owner Invoice Voiding Confirmation Modal',
    'SS-D6-S063': 'Invoice Date & Notes Edit Dialog',
    'SS-D6-S064': 'Childcare Voucher Rejection / Failed Modal',
    'SS-D6-S065': 'Multi-Child Family Sibling Linkage View',
    'SS-D6-S066': 'Student Academic Scorecard & Progress',
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
      <text x="30" y="45" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="bold" fill="#F8FAFC">SprintScale CMS — Milestone D6C Batch 2 Visual Review</text>
      <text x="30" y="68" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#94A3B8">Remaining Screenshots SS-D6-S057 → SS-D6-S066 | Oakridge Learning Trust | Verified Synthetic Data</text>
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

  const contactSheetPath = path.join(OUT_REVIEW, 'd6c-batch-2-contact-sheet.png');
  await sharp(Buffer.from(bannerSvg))
    .composite(composites)
    .png()
    .toFile(contactSheetPath);

  console.log(`[SUCCESS] D6C Batch 2 Contact sheet generated at: ${contactSheetPath}`);

  await browser.close();
}

main().catch((err) => {
  console.error('[FATAL CAPTURE ERROR]', err);
  process.exit(1);
});
