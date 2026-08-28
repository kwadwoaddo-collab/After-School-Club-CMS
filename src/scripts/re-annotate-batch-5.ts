import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

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

async function main() {
  const annotationsMap: Record<string, Annotation[]> = {
    // -------------------------------------------------------------
    // SS-D6-S041: Staff Invitation Modal & Role Selection
    // ① Role selector options card (Manager, Front Desk, Tutor)
    // ② Staff identity inputs (Email, First Name, Last Name)
    // ③ Centre-level assignment explanation card
    // -------------------------------------------------------------
    'SS-D6-S041': [
      { x: 504, y: 640, width: 672, height: 250, badge: 1 },
      { x: 504, y: 350, width: 672, height: 275, badge: 2 },
      { x: 504, y: 224, width: 672, height: 104, badge: 3 },
    ],

    // -------------------------------------------------------------
    // SS-D6-S042: Staff Centre Membership Assignment
    // ① Staff Profile Header Card
    // ② Role selection grid
    // ③ Centre assignment checkboxes
    // -------------------------------------------------------------
    'SS-D6-S042': [
      { x: 388, y: 148, width: 896, height: 132, badge: 1 },
      { x: 388, y: 300, width: 896, height: 550, badge: 2 },
      { x: 388, y: 865, width: 896, height: 160, badge: 3 },
    ],

    // -------------------------------------------------------------
    // SS-D6-S043: Staff Deactivation Warning Modal
    // ① Deactivation modal frame
    // ② Warning explanation body text
    // ③ 'Yes, remove access' destructive action button
    // -------------------------------------------------------------
    'SS-D6-S043': [
      { x: 528, y: 356, width: 384, height: 288, badge: 1 },
      { x: 550, y: 480, width: 340, height: 75, badge: 2 },
      { x: 726, y: 574, width: 162, height: 44, badge: 3 },
    ],

    // -------------------------------------------------------------
    // SS-D6-S044: Parent Email Broadcast Composer
    // ① Compose message card (Subject + Body)
    // ② Recipient Picker audience selector
    // ③ 'Send Broadcast' primary action button
    // -------------------------------------------------------------
    'SS-D6-S044': [
      { x: 272, y: 280, width: 746, height: 476, badge: 1 },
      { x: 1045, y: 280, width: 360, height: 280, badge: 2 },
      { x: 792, y: 676, width: 204, height: 56, badge: 3 },
    ],

    // -------------------------------------------------------------
    // SS-D6-S045: Recovery Bin Soft-Deleted Families List
    // ① Table column headers (Family, Children, Deleted On, Expires In, Actions)
    // ② Rachel Taylor soft-deleted record row
    // ③ Expiry countdown badge & Restore/Delete action buttons
    // -------------------------------------------------------------
    'SS-D6-S045': [
      { x: 266, y: 96, width: 1140, height: 48, badge: 1 },
      { x: 266, y: 144, width: 1140, height: 60, badge: 2 },
      { x: 960, y: 144, width: 446, height: 60, badge: 3 },
    ],

    // -------------------------------------------------------------
    // SS-D6-S046: Permanent GDPR Purge Owner-Only Warning
    // ① Permanent delete confirmation modal
    // ② GDPR irreversible purge warning text
    // ③ 'Delete forever' destructive action button
    // -------------------------------------------------------------
    'SS-D6-S046': [
      { x: 640, y: 96, width: 395, height: 108, badge: 1 },
      { x: 665, y: 135, width: 350, height: 55, badge: 2 },
      { x: 885, y: 148, width: 135, height: 42, badge: 3 },
    ],
  };

  for (const [id, callouts] of Object.entries(annotationsMap)) {
    const sPath = path.join(OUT_SOURCE, `${id}-source.png`);
    const aPath = path.join(OUT_ANNOTATED, `${id}.png`);
    if (fs.existsSync(sPath)) {
      console.log(`[ANNOTATE] Re-annotating ${id}...`);
      await annotateImage(sPath, aPath, callouts);
    }
  }

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
}

main().catch(console.error);
