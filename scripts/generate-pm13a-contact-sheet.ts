import sharp, { type OverlayOptions } from 'sharp';
import path from 'path';
import fs from 'fs';

interface PanelConfig {
  id: string;
  label: string;
  filename: string;
}

const EVIDENCE_DIR = '/Users/KWADW/.gemini/antigravity-ide/brain/570ce807-40be-438c-8def-b8238b3ec657/pm13a_evidence';
const OUTPUT_FILE = path.join(EVIDENCE_DIR, 'pm13a_contact_sheet.png');

const PANELS: PanelConfig[] = [
  { id: 'R1', label: 'R1: Signup Desktop (1280x800)', filename: 'r1_signup_desktop.png' },
  { id: 'R1M', label: 'R1M: Signup Mobile (390x844)', filename: 'r1_signup_mobile.png' },
  { id: 'R2', label: 'R2: Terms of Service (/terms)', filename: 'r2_terms.png' },
  { id: 'R3', label: 'R3: Privacy Policy (/privacy)', filename: 'r3_privacy.png' },
  { id: 'R4', label: 'R4: Organisation Onboarding (/onboarding)', filename: 'r4_onboarding.png' },
  { id: 'R5', label: 'R5: Scoped Logo Upload State', filename: 'r5_onboarding_logo.png' },
  { id: 'R6', label: 'R6: Platform Approvals (/platform/organisations)', filename: 'r6_platform_approvals.png' },
  { id: 'R7', label: 'R7: Pending Approval Gate (/pending-approval)', filename: 'r7_pending_approval.png' },
  { id: 'R8', label: 'R8: Post-Approval Dashboard (/dashboard)', filename: 'r8_post_approval_dashboard.png' },
  { id: 'R9', label: 'R9: Custom Brand Center-Portal (/centre-portal/norbert-centre)', filename: 'r9_custom_brand_portal.png' },
  { id: 'R10', label: 'R10: Dynamic Favicon & Title Verification', filename: 'r10_favicon_title.png' },
  { id: 'R11', label: 'R11: Public Parent Registration Form (/register/norbert-centre)', filename: 'r11_public_registration.png' },
  { id: 'R12', label: 'R12: Public Center Booking Form (/book/norbert-after-school/norbert-centre)', filename: 'r12_public_booking.png' },
];

async function buildContactSheet() {
  const COLS = 3;
  const ROWS = 5; // 13 panels fits in 3x5
  const PANEL_WIDTH = 640;
  const HEADER_HEIGHT = 44;
  const IMAGE_HEIGHT = 540;
  const PANEL_HEIGHT = HEADER_HEIGHT + IMAGE_HEIGHT;
  const PADDING = 24;

  const CANVAS_WIDTH = COLS * PANEL_WIDTH + (COLS + 1) * PADDING;
  const HEADER_BANNER_HEIGHT = 100;
  const CANVAS_HEIGHT = HEADER_BANNER_HEIGHT + ROWS * PANEL_HEIGHT + (ROWS + 1) * PADDING;

  console.log(`[Contact Sheet] Canvas dimensions: ${CANVAS_WIDTH} x ${CANVAS_HEIGHT}`);

  const composites: OverlayOptions[] = [];

  // 1. Header Banner SVG
  const headerSvg = `
    <svg width="${CANVAS_WIDTH}" height="${HEADER_BANNER_HEIGHT}">
      <rect width="${CANVAS_WIDTH}" height="${HEADER_BANNER_HEIGHT}" fill="#0b0f19" />
      <text x="32" y="44" fill="#ffffff" font-size="28" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-weight="bold">
        PM-1.3A / PM-1.3A.C Visual Evidence Contact Sheet
      </text>
      <text x="32" y="76" fill="#94a3b8" font-size="16" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif">
        SaaS Onboarding Remediation &amp; Security Boundary Certification · Requirements R1 through R12
      </text>
    </svg>
  `;
  composites.push({
    input: Buffer.from(headerSvg),
    top: 0,
    left: 0,
  });

  // 2. Render each panel
  for (let idx = 0; idx < PANELS.length; idx++) {
    const panel = PANELS[idx];
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);

    const left = PADDING + col * (PANEL_WIDTH + PADDING);
    const top = HEADER_BANNER_HEIGHT + PADDING + row * (PANEL_HEIGHT + PADDING);

    const filePath = path.join(EVIDENCE_DIR, panel.filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing evidence screenshot: ${filePath}`);
    }

    // Panel Header SVG
    const panelHeaderSvg = `
      <svg width="${PANEL_WIDTH}" height="${HEADER_HEIGHT}">
        <rect width="${PANEL_WIDTH}" height="${HEADER_HEIGHT}" fill="#1e293b" rx="6" ry="6" />
        <circle cx="20" cy="${HEADER_HEIGHT / 2}" r="6" fill="#6366f1" />
        <text x="36" y="${HEADER_HEIGHT / 2 + 5}" fill="#f8fafc" font-size="15" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-weight="bold">
          ${panel.label}
        </text>
      </svg>
    `;
    composites.push({
      input: Buffer.from(panelHeaderSvg),
      top,
      left,
    });

    // Resize image to fit nicely within (PANEL_WIDTH, IMAGE_HEIGHT) with dark background padding
    const resizedImageBuffer = await sharp(filePath)
      .resize(PANEL_WIDTH, IMAGE_HEIGHT, {
        fit: 'contain',
        background: { r: 15, g: 23, b: 42, alpha: 1 }, // #0f172a
      })
      .toBuffer();

    composites.push({
      input: resizedImageBuffer,
      top: top + HEADER_HEIGHT,
      left,
    });
  }

  // Create base dark canvas
  console.log('[Contact Sheet] Assembling composite image...');
  await sharp({
    create: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      channels: 4,
      background: { r: 11, g: 15, b: 25, alpha: 1 }, // #0b0f19
    },
  })
    .composite(composites)
    .png({ quality: 90, compressionLevel: 8 })
    .toFile(OUTPUT_FILE);

  const stats = fs.statSync(OUTPUT_FILE);
  console.log(`[Contact Sheet] Successfully generated contact sheet PNG:`);
  console.log(`  Path: ${OUTPUT_FILE}`);
  console.log(`  Size: ${(stats.size / 1024).toFixed(1)} KB`);
}

buildContactSheet().catch((err) => {
  console.error('[Contact Sheet Error]', err);
  process.exit(1);
});
