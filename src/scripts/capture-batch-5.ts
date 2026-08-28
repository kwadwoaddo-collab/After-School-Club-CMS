import { chromium, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const OUT_SOURCE = path.resolve('project-notes/documentation-training/assets/screenshots/source');
const OUT_ANNOTATED = path.resolve('project-notes/documentation-training/assets/screenshots/annotated');
const OUT_REVIEW = path.resolve('project-notes/documentation-training/assets/review');

// Oakridge Central Centre ID
const OAKRIDGE_CENTRE_ID = '435439fe-fab5-444f-a897-df568fce0254';

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
  await page.evaluate(() => {
    const btn = document.querySelector('form button[type="submit"]') as HTMLButtonElement;
    if (btn) btn.click();
  });
  await page.waitForURL('**/dashboard**', { timeout: 30000 }).catch(() => {});
  console.log(`[LOGIN] Logged in as ${email}! Current URL: ${page.url()}`);
  await page.waitForTimeout(500);
}

async function main() {
  await ensureDirs();

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await ctx.addCookies([
    {
      name: 'selected_centre_id',
      value: OAKRIDGE_CENTRE_ID,
      url: BASE_URL,
    },
  ]);

  const page = await ctx.newPage();
  const annotationsMap: Record<string, Annotation[]> = {};

  // Login as Eleanor Vance (ORG_OWNER)
  await loginUser(page, 'eleanor.vance@example.test');

  // -------------------------------------------------------------
  // SS-D6-S041: Staff Invitation Modal & Role Selection
  // -------------------------------------------------------------
  console.log('[CAPTURE] SS-D6-S041: Staff Invitation Modal & Role Selection...');
  await page.goto(`${BASE_URL}/dashboard/staff/invite`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('text=Invite staff member', { timeout: 60000 });
  await page.fill('#invite-email', 'sophia.williams@example.test');
  await page.fill('#invite-first-name', 'Sophia');
  await page.fill('#invite-last-name', 'Williams');
  await page.evaluate(() => {
    const radio = document.querySelector('input[value="FRONT_DESK"]') as HTMLInputElement;
    if (radio) radio.click();
    const sel = document.querySelector('#invite-centre') as HTMLSelectElement;
    if (sel && sel.options.length > 1) {
      sel.selectedIndex = 1;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await page.waitForTimeout(600);

  const s41Source = path.join(OUT_SOURCE, 'SS-D6-S041-source.png');
  const s41Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S041.png');
  await page.screenshot({ path: s41Source });

  const s41_roleCard = await page.evaluate(() => {
    const el = document.querySelector('input[name="role"]')?.closest('div.space-y-2')?.parentElement;
    if (!el) return { x: 441, y: 588, width: 630, height: 232 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 3, y: r.y - 3, width: r.width + 6, height: r.height + 6 };
  });

  const s41_fields = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div.grid.grid-cols-2')).find(d => d.querySelector('#invite-first-name'))?.parentElement;
    if (!el) return { x: 441, y: 310, width: 630, height: 180 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 3, y: r.y - 3, width: r.width + 6, height: r.height + 6 };
  });

  const s41_centre = await page.evaluate(() => {
    const el = document.querySelector('#invite-centre')?.closest('div:not(.grid)');
    if (!el) return { x: 441, y: 495, width: 630, height: 85 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 3, y: r.y - 3, width: r.width + 6, height: r.height + 6 };
  });

  annotationsMap['SS-D6-S041'] = [
    { x: s41_roleCard.x, y: s41_roleCard.y, width: s41_roleCard.width, height: s41_roleCard.height, badge: 1 },
    { x: s41_fields.x, y: s41_fields.y, width: s41_fields.width, height: s41_fields.height, badge: 2 },
    { x: s41_centre.x, y: s41_centre.y, width: s41_centre.width, height: s41_centre.height, badge: 3 },
  ];
  await annotateImage(s41Source, s41Annotated, annotationsMap['SS-D6-S041']);

  // -------------------------------------------------------------
  // SS-D6-S042: Staff Centre Membership Assignment
  // -------------------------------------------------------------
  console.log('[CAPTURE] SS-D6-S042: Staff Centre Membership Assignment...');
  await page.goto(`${BASE_URL}/dashboard/staff/ecf50d88-d974-4fc3-9401-b9de17d115c4`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('text=Chloe Bennett', { timeout: 60000 });
  await page.waitForTimeout(600);

  const s42Source = path.join(OUT_SOURCE, 'SS-D6-S042-source.png');
  const s42Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S042.png');
  await page.screenshot({ path: s42Source });

  const s42_header = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div.border')).find(d => d.textContent?.includes('Chloe Bennett') && d.textContent?.includes('Centres'));
    if (!el) return { x: 308, y: 128, width: 896, height: 125 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 3, y: r.y - 3, width: r.width + 6, height: r.height + 6 };
  });

  const s42_role = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div.border')).find(d => d.textContent?.includes('Staff role') && d.textContent?.includes('Front Desk'));
    if (!el) return { x: 308, y: 275, width: 896, height: 490 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 3, y: r.y - 3, width: r.width + 6, height: r.height + 6 };
  });

  const s42_centres = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div.border')).find(d => d.textContent?.includes('Centre assignments') && d.textContent?.includes('Oakridge Central'));
    if (!el) return { x: 308, y: 782, width: 896, height: 222 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 3, y: r.y - 3, width: r.width + 6, height: r.height + 6 };
  });

  annotationsMap['SS-D6-S042'] = [
    { x: s42_header.x, y: s42_header.y, width: s42_header.width, height: s42_header.height, badge: 1 },
    { x: s42_role.x, y: s42_role.y, width: s42_role.width, height: s42_role.height, badge: 2 },
    { x: s42_centres.x, y: s42_centres.y, width: s42_centres.width, height: s42_centres.height, badge: 3 },
  ];
  await annotateImage(s42Source, s42Annotated, annotationsMap['SS-D6-S042']);

  // -------------------------------------------------------------
  // SS-D6-S043: Staff Deactivation Warning Modal
  // -------------------------------------------------------------
  console.log('[CAPTURE] SS-D6-S043: Staff Deactivation Warning Modal...');
  await page.goto(`${BASE_URL}/dashboard/staff/fc6b3e53-a8f9-403a-86ef-be562f6ebb9f`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('text=Liam Harper', { timeout: 60000 });
  await page.waitForTimeout(1500);

  const removeBtn = page.locator('button', { hasText: 'Remove' });
  await removeBtn.waitFor({ state: 'visible', timeout: 10000 });
  await removeBtn.click();
  await page.waitForSelector('div.fixed.z-50', { state: 'visible', timeout: 10000 });
  await page.waitForTimeout(600);

  const s43Source = path.join(OUT_SOURCE, 'SS-D6-S043-source.png');
  const s43Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S043.png');
  await page.screenshot({ path: s43Source });

  const s43_modal = await page.evaluate(() => {
    const el = document.querySelector('div.fixed.z-50 div.bg-surface');
    if (!el) return { x: 528, y: 320, width: 384, height: 260 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 3, y: r.y - 3, width: r.width + 6, height: r.height + 6 };
  });

  const s43_text = await page.evaluate(() => {
    const el = document.querySelector('div.fixed.z-50 p.text-small-body');
    if (!el) return { x: 552, y: 410, width: 336, height: 75 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 3, y: r.y - 3, width: r.width + 6, height: r.height + 6 };
  });

  const s43_btn = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div.fixed.z-50 button')).find(b => b.textContent?.includes('Yes, remove access'));
    if (!el) return { x: 700, y: 505, width: 188, height: 42 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 14, y: r.y - 6, width: r.width + 28, height: r.height + 12 };
  });

  annotationsMap['SS-D6-S043'] = [
    { x: s43_modal.x, y: s43_modal.y, width: s43_modal.width, height: s43_modal.height, badge: 1 },
    { x: s43_text.x, y: s43_text.y, width: s43_text.width, height: s43_text.height, badge: 2 },
    { x: s43_btn.x, y: s43_btn.y, width: s43_btn.width, height: s43_btn.height, badge: 3 },
  ];
  await annotateImage(s43Source, s43Annotated, annotationsMap['SS-D6-S043']);

  // -------------------------------------------------------------
  // SS-D6-S044: Parent Email Broadcast Composer
  // -------------------------------------------------------------
  console.log('[CAPTURE] SS-D6-S044: Parent Email Broadcast Composer...');
  await page.goto(`${BASE_URL}/dashboard/communications`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('text=Broadcast Messaging', { timeout: 60000 });
  await page.fill('input[placeholder*="Important Update"]', 'Important Notice: Autumn Term Club Timetable & Booking Window');
  await page.fill('textarea[placeholder*="Type your message"]', 'Dear Parents,\n\nPlease note that booking for the upcoming Autumn term club sessions will open on Monday at 09:00. Please ensure all emergency contact details and dietary notes are up to date.\n\nBest regards,\nOakridge Central Management Team');
  await page.waitForTimeout(600);

  const s44Source = path.join(OUT_SOURCE, 'SS-D6-S044-source.png');
  const s44Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S044.png');
  await page.screenshot({ path: s44Source });

  const s44_compose = await page.evaluate(() => {
    const el = document.querySelector('div.lg\\:col-span-2.bg-card');
    if (!el) return { x: 272, y: 258, width: 750, height: 501 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 3, y: r.y - 3, width: r.width + 6, height: r.height + 6 };
  });

  const s44_audience = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div.bg-card')).find(d => d.textContent?.includes('Recipient Picker'));
    if (!el) return { x: 1045, y: 258, width: 363, height: 277 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 3, y: r.y - 3, width: r.width + 6, height: r.height + 6 };
  });

  const s44_send = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Send Broadcast'));
    if (!el) return { x: 840, y: 695, width: 155, height: 48 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 14, y: r.y - 6, width: r.width + 28, height: r.height + 12 };
  });

  annotationsMap['SS-D6-S044'] = [
    { x: s44_compose.x, y: s44_compose.y, width: s44_compose.width, height: s44_compose.height, badge: 1 },
    { x: s44_audience.x, y: s44_audience.y, width: s44_audience.width, height: s44_audience.height, badge: 2 },
    { x: s44_send.x, y: s44_send.y, width: s44_send.width, height: s44_send.height, badge: 3 },
  ];
  await annotateImage(s44Source, s44Annotated, annotationsMap['SS-D6-S044']);

  // -------------------------------------------------------------
  // SS-D6-S045: Recovery Bin Soft-Deleted Families List
  // -------------------------------------------------------------
  console.log('[CAPTURE] SS-D6-S045: Recovery Bin Soft-Deleted Families List...');
  await page.goto(`${BASE_URL}/dashboard/parents/bin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('text=Recovery Bin', { timeout: 60000 });
  await page.waitForSelector('text=Rachel Taylor', { timeout: 60000 });
  await page.waitForTimeout(600);

  const s45Source = path.join(OUT_SOURCE, 'SS-D6-S045-source.png');
  const s45Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S045.png');
  await page.screenshot({ path: s45Source });

  const s45_header = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('h1')).find(h => h.textContent?.includes('Recovery Bin'))?.parentElement || document.querySelector('h1')?.parentElement;
    if (!el) return { x: 272, y: 24, width: 350, height: 50 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 3, y: r.y - 3, width: r.width + 6, height: r.height + 6 };
  });

  const s45_row = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('tbody tr')).find(tr => tr.textContent?.includes('Rachel Taylor'));
    if (!el) return { x: 273, y: 135, width: 1134, height: 60 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 3, y: r.y - 3, width: r.width + 6, height: r.height + 6 };
  });

  const s45_actions = await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('tbody tr')).find(tr => tr.textContent?.includes('Rachel Taylor'));
    const el = row?.querySelector('td:last-child');
    if (!el) return { x: 1250, y: 140, width: 150, height: 45 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 3, y: r.y - 3, width: r.width + 6, height: r.height + 6 };
  });

  annotationsMap['SS-D6-S045'] = [
    { x: s45_header.x, y: s45_header.y, width: s45_header.width, height: s45_header.height, badge: 1 },
    { x: s45_row.x, y: s45_row.y, width: s45_row.width, height: s45_row.height, badge: 2 },
    { x: s45_actions.x, y: s45_actions.y, width: s45_actions.width, height: s45_actions.height, badge: 3 },
  ];
  await annotateImage(s45Source, s45Annotated, annotationsMap['SS-D6-S045']);

  // -------------------------------------------------------------
  // SS-D6-S046: Permanent GDPR Purge Owner-Only Warning
  // -------------------------------------------------------------
  console.log('[CAPTURE] SS-D6-S046: Permanent GDPR Purge Owner-Only Warning...');
  await page.waitForTimeout(1000);
  const deleteForeverBtn = page.locator('button[title="Delete forever"]').first();
  await deleteForeverBtn.waitFor({ state: 'visible', timeout: 10000 });
  await deleteForeverBtn.click();
  await page.waitForSelector('div.fixed.z-50', { state: 'visible', timeout: 10000 });
  await page.waitForTimeout(600);

  const s46Source = path.join(OUT_SOURCE, 'SS-D6-S046-source.png');
  const s46Annotated = path.join(OUT_ANNOTATED, 'SS-D6-S046.png');
  await page.screenshot({ path: s46Source });

  const s46_modal = await page.evaluate(() => {
    const el = document.querySelector('div.fixed.z-50 div.bg-surface');
    if (!el) return { x: 528, y: 320, width: 384, height: 260 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 3, y: r.y - 3, width: r.width + 6, height: r.height + 6 };
  });

  const s46_text = await page.evaluate(() => {
    const el = document.querySelector('div.fixed.z-50 p.text-small-body');
    if (!el) return { x: 552, y: 410, width: 336, height: 75 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 3, y: r.y - 3, width: r.width + 6, height: r.height + 6 };
  });

  const s46_btn = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div.fixed.z-50 button')).find(b => b.textContent?.includes('Delete forever'));
    if (!el) return { x: 700, y: 505, width: 188, height: 42 };
    const r = el.getBoundingClientRect();
    return { x: r.x - 14, y: r.y - 6, width: r.width + 28, height: r.height + 12 };
  });

  annotationsMap['SS-D6-S046'] = [
    { x: s46_modal.x, y: s46_modal.y, width: s46_modal.width, height: s46_modal.height, badge: 1 },
    { x: s46_text.x, y: s46_text.y, width: s46_text.width, height: s46_text.height, badge: 2 },
    { x: s46_btn.x, y: s46_btn.y, width: s46_btn.width, height: s46_btn.height, badge: 3 },
  ];
  await annotateImage(s46Source, s46Annotated, annotationsMap['SS-D6-S046']);

  // -------------------------------------------------------------
  // Generate Batch 5 Contact Sheet
  // -------------------------------------------------------------
  console.log('[REVIEW] Generating Batch 5 Contact Sheet...');
  const assetIds = [
    'SS-D6-S041', 'SS-D6-S042', 'SS-D6-S043',
    'SS-D6-S044', 'SS-D6-S045', 'SS-D6-S046'
  ];

  const titles: Record<string, string> = {
    'SS-D6-S041': 'Staff Invitation Modal & Role Selection',
    'SS-D6-S042': 'Staff Centre Membership Assignment',
    'SS-D6-S043': 'Staff Deactivation Warning Modal',
    'SS-D6-S044': 'Parent Email Broadcast Composer',
    'SS-D6-S045': 'Recovery Bin Soft-Deleted Families List',
    'SS-D6-S046': 'Permanent GDPR Purge Owner-Only Warning',
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
      <text x="30" y="45" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="bold" fill="#F8FAFC">SprintScale CMS — Milestone D6B Batch 5 Visual Review</text>
      <text x="30" y="68" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#94A3B8">Final Essential Screenshots SS-D6-S041 → SS-D6-S046 | Oakridge Learning Trust | Verified Synthetic Data</text>
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

  const contactSheetPath = path.join(OUT_REVIEW, 'd6b-batch-5-contact-sheet.png');
  await sharp(Buffer.from(bannerSvg))
    .composite(composites)
    .png()
    .toFile(contactSheetPath);

  console.log(`[SUCCESS] Batch 5 Contact sheet generated at: ${contactSheetPath}`);

  await browser.close();
}

main().catch(console.error);
