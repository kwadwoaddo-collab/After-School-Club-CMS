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

const ALL_ASSET_IDS = ['SS-D6-S077', 'SS-D6-S078'];

const TITLES: Record<string, string> = {
  'SS-D6-S077': 'Attendance Daily Register & Roll Call Overview',
  'SS-D6-S078': 'External Integration Statuses Card',
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
  console.log('[REVIEW] Generating D6C Batch 4 Contact Sheet from existing annotated PNGs...');
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
      <text x="30" y="45" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="bold" fill="#F8FAFC">SprintScale CMS — Milestone D6C Batch 4 Visual Review</text>
      <text x="30" y="68" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#94A3B8">Final Screenshots SS-D6-S077 → SS-D6-S078 | Oakridge Learning Trust | Verified Synthetic Data</text>
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

  const contactSheetPath = path.join(OUT_REVIEW, 'd6c-batch-4-contact-sheet.png');
  await sharp(Buffer.from(bannerSvg))
    .composite(composites)
    .png()
    .toFile(contactSheetPath);

  console.log(`[SUCCESS] D6C Batch 4 Contact sheet generated at: ${contactSheetPath}`);
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

  const bookings = await sql`SELECT id, status, start_at FROM bookings WHERE centre_id = ${centreCentral.id} ORDER BY created_at DESC`;
  const booking1 = bookings[0];
  const seedDateStr = booking1?.start_at ? new Date(booking1.start_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

  console.log(`[DATA] Org: ${org.name} (${org.id})`);
  console.log(`[DATA] Centre Central: ${centreCentral.name} (${centreCentral.id})`);
  console.log(`[DATA] Eleanor User: ${eleanorUser.id}`);
  console.log(`[DATA] Target Assets Filter: ${targetAssets ? targetAssets.join(', ') : 'ALL'}`);

  await sql.end();

  const shouldRun = (id: string) => !targetAssets || targetAssets.includes(id);

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
  // SS-D6-S077: Attendance Daily Register & Roll Call Overview
  // =========================================================================
  if (shouldRun('SS-D6-S077')) {
    console.log('[CAPTURE] SS-D6-S077: Attendance Daily Register & Roll Call Overview...');
    await page.goto(`${BASE_URL}/dashboard/attendance?date=${seedDateStr}&centre=${centreCentral.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('text=Jenkins', { timeout: 30000 });
    await page.waitForTimeout(1000);

    const s77Source = path.join(OUT_SOURCE, 'SS-D6-S077-source.png');
    const s77Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S077.png');
    await page.screenshot({ path: s77Source, fullPage: false });

    const boxSessionActions = await safeBox(page, 'div.flex.items-center.gap-3:has(p:has-text("Session —"))', { x: 270, y: 520, width: 1130, height: 60 });
    const boxDateNav = await safeBox(page, 'div.px-4.py-2.rounded-md.bg-surface', { x: 310, y: 100, width: 220, height: 44 });
    const boxStatsRow = await safeBox(page, 'div.grid.grid-cols-2.sm\\:grid-cols-5', { x: 270, y: 160, width: 1130, height: 100 });

    annotationsMap['SS-D6-S077'] = [
      { ...boxSessionActions, badge: 1 },
      { ...boxDateNav, badge: 2 },
      { ...boxStatsRow, badge: 3 },
    ];
    await annotateImage(s77Source, s77Annotated, annotationsMap['SS-D6-S077']);
    console.log('[SUCCESS] SS-D6-S077 captured and annotated.');
  }

  // =========================================================================
  // SS-D6-S078: External Integration Statuses Card
  // =========================================================================
  if (shouldRun('SS-D6-S078')) {
    console.log('[CAPTURE] SS-D6-S078: External Integration Statuses Card...');
    await page.goto(`${BASE_URL}/dashboard/settings/wonde`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('h1:has-text("Wonde MIS Integration")', { state: 'visible', timeout: 30000 });
    await page.waitForSelector('h3:has-text("Integration Status")', { state: 'visible', timeout: 15000 });
    await page.waitForTimeout(600);

    const s78Source = path.join(OUT_SOURCE, 'SS-D6-S078-source.png');
    const s78Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S078.png');
    await page.screenshot({ path: s78Source, fullPage: false });

    const boxStatusCard = await getElementBox(page, 'div.bg-card:has(h3:has-text("Integration Status"))', 6);
    const boxSyncCard = await getElementBox(page, 'div.bg-card:has(h2:has-text("Manual Sync"))', 6);
    const boxApiCard = await getElementBox(page, 'div.bg-card:has(h2:has-text("API Configuration"))', 6);

    annotationsMap['SS-D6-S078'] = [
      { ...boxStatusCard, badge: 1 },
      { ...boxSyncCard, badge: 2 },
      { ...boxApiCard, badge: 3 },
    ];
    await annotateImage(s78Source, s78Annotated, annotationsMap['SS-D6-S078']);
    console.log('[SUCCESS] SS-D6-S078 captured and annotated.');
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
