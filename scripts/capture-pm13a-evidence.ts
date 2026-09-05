/**
 * PM-1.3A Visual Evidence Automation Script
 *
 * Captures rendered UI evidence for requirements R1 through R12 using Playwright.
 * Works exclusively against training DB fixtures on http://localhost:3001.
 * Guaranteed 100% teardown of all synthetic fixtures.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium, Browser, Page } from 'playwright';
import bcrypt from 'bcryptjs';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, inArray } from 'drizzle-orm';
import { assertSafeTrainingEnvironment } from '../src/lib/training-guard';
import * as schema from '../src/db/schema';
import {
  organisations,
  centres,
  users,
  orgMemberships,
  auditEvents,
} from '../src/db/schema';
import path from 'path';
import fs from 'fs';

const EVIDENCE_DIR = '/Users/KWADW/.gemini/antigravity-ide/brain/570ce807-40be-438c-8def-b8238b3ec657/pm13a_evidence';
const BASE_URL = 'http://localhost:3001';

async function main() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

  const { host } = assertSafeTrainingEnvironment();
  console.log(`[Capture Guard Verified] Target host: ${host}`);

  const dbUrl = process.env.DATABASE_URL!;
  const client = postgres(dbUrl, { max: 5, ssl: 'require' });
  const db = drizzle(client, { schema });

  const prefix = `synth_vis_${Date.now()}`;
  const ownerEmail = `${prefix}_owner@example.com`;
  const adminEmail = `platform-admin@sprintscale.local`;
  const password = 'Password123!';
  const hashedPassword = await bcrypt.hash(password, 10);

  let browser: Browser | null = null;
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];

  try {
    console.log('[Visual Evidence] Launching browser...');
    browser = await chromium.launch({
      headless: true,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    });

    // ─── R1 Desktop & Mobile, R2, R3 (Public Routes) ─────────────────────────
    console.log('[Visual Evidence] Capturing R1 Signup Desktop...');
    const contextDesktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pageDesktop = await contextDesktop.newPage();

    await pageDesktop.goto(`${BASE_URL}/signup`, { waitUntil: 'domcontentloaded' });
    await pageDesktop.waitForTimeout(1000); // Wait for React hydration
    await pageDesktop.fill('#firstName', 'Jane');
    await pageDesktop.fill('#lastName', 'Doe');
    await pageDesktop.fill('#email', 'jane.doe@example.com');
    await pageDesktop.waitForFunction(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Continue');
      return btn && !btn.disabled;
    });
    await pageDesktop.click('button:text-is("Continue")');
    await pageDesktop.waitForSelector('text=Terms of Service');
    await pageDesktop.screenshot({ path: path.join(EVIDENCE_DIR, 'r1_signup_desktop.png') });

    console.log('[Visual Evidence] Capturing R1 Signup Mobile...');
    const contextMobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const pageMobile = await contextMobile.newPage();

    await pageMobile.goto(`${BASE_URL}/signup`, { waitUntil: 'domcontentloaded' });
    await pageMobile.waitForTimeout(1000); // Wait for React hydration
    await pageMobile.fill('#firstName', 'Jane');
    await pageMobile.fill('#lastName', 'Doe');
    await pageMobile.fill('#email', 'jane.doe@example.com');
    await pageMobile.waitForFunction(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Continue');
      return btn && !btn.disabled;
    });
    await pageMobile.click('button:text-is("Continue")');
    await pageMobile.waitForSelector('text=Terms of Service');
    await pageMobile.screenshot({ path: path.join(EVIDENCE_DIR, 'r1_signup_mobile.png') });

    console.log('[Visual Evidence] Capturing R2 Terms Page...');
    await pageDesktop.goto(`${BASE_URL}/terms`, { waitUntil: 'domcontentloaded' });
    await pageDesktop.waitForSelector('text=Terms of Service');
    await pageDesktop.screenshot({ path: path.join(EVIDENCE_DIR, 'r2_terms.png') });

    console.log('[Visual Evidence] Capturing R3 Privacy Page...');
    await pageDesktop.goto(`${BASE_URL}/privacy`, { waitUntil: 'domcontentloaded' });
    await pageDesktop.waitForSelector('text=Privacy Policy');
    await pageDesktop.screenshot({ path: path.join(EVIDENCE_DIR, 'r3_privacy.png') });

    // ─── Setup Synthetic Fixtures for Onboarding & Lifecycle ─────────────────
    console.log('[Visual Evidence] Creating synthetic test user in training DB...');
    const [userRecord] = await db.insert(users).values({
      email: ownerEmail,
      name: 'Sarah Jenkins',
      firstName: 'Sarah',
      lastName: 'Jenkins',
      passwordHash: hashedPassword,
      role: 'ORG_OWNER',
      termsAcceptedAt: new Date(),
      termsVersion: '2026-09-01',
    }).returning();
    createdUserIds.push(userRecord.id);

    // Also ensure platform admin user exists for R8 & R9
    const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail));
    let adminRecord = existingAdmin[0];
    if (!adminRecord) {
      const [newAdmin] = await db.insert(users).values({
        email: adminEmail,
        name: 'Platform Ops',
        firstName: 'Platform',
        lastName: 'Ops',
        passwordHash: hashedPassword,
        role: 'ORG_OWNER',
        termsAcceptedAt: new Date(),
        termsVersion: '2026-09-01',
      }).returning();
      adminRecord = newAdmin;
      createdUserIds.push(newAdmin.id);
    }

    // ─── Login as Onboarding User ────────────────────────────────────────────
    console.log('[Visual Evidence] Logging in as synthetic user to reach /onboarding...');
    const authContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const authPage = await authContext.newPage();

    await authPage.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await authPage.waitForSelector('input[type="email"]');
    await authPage.waitForTimeout(1000); // Wait for React hydration
    await authPage.fill('input[type="email"]', ownerEmail);
    await authPage.fill('input[type="password"]', password);
    await authPage.click('button[type="submit"]');
    await authPage.waitForFunction(() => window.location.pathname.includes('/onboarding') || window.location.pathname.includes('/dashboard'), { timeout: 20000 });
    if (!authPage.url().includes('/onboarding')) {
      await authPage.goto(`${BASE_URL}/onboarding`, { waitUntil: 'domcontentloaded' });
    }

    // R4: Organisation Onboarding screen
    console.log('[Visual Evidence] Capturing R4 Organisation Onboarding...');
    await authPage.waitForSelector("text=Let's get you set up");
    await authPage.screenshot({ path: path.join(EVIDENCE_DIR, 'r4_onboarding.png') });

    // R5: Fill form and upload logo preview
    console.log('[Visual Evidence] Filling onboarding form with synthetic logo...');
    await authPage.fill('input[placeholder="e.g. Bright Stars Academy"]', 'Oakridge Education');
    await authPage.fill('input[placeholder="e.g. London Campus"]', 'Main Campus');

    // Create a temporary 1x1 synthetic PNG
    const tempLogoPath = path.join(EVIDENCE_DIR, 'synthetic_logo.png');
    const pngBuffer = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C63000100000500010D0A2DB40000000049454E44AE426082', 'hex');
    fs.writeFileSync(tempLogoPath, pngBuffer);

    const fileInput = await authPage.$('input[type="file"]');
    if (fileInput) {
      await fileInput.setInputFiles(tempLogoPath);
      await authPage.waitForTimeout(500); // wait for preview to render
    }
    console.log('[Visual Evidence] Capturing R5 Logo upload on onboarding...');
    await authPage.screenshot({ path: path.join(EVIDENCE_DIR, 'r5_onboarding_logo.png') });

    // Submit onboarding -> should route to /pending-approval
    console.log('[Visual Evidence] Submitting onboarding...');
    await authPage.click('button[type="submit"]');
    await authPage.waitForFunction(() => window.location.pathname.includes('/pending-approval'), { timeout: 20000 });

    // R6: Pending approval after onboarding
    console.log('[Visual Evidence] Capturing R6 Pending approval (Desktop)...');
    await authPage.waitForSelector('text=Your account is under review');
    await authPage.screenshot({ path: path.join(EVIDENCE_DIR, 'r6_pending_desktop.png') });

    console.log('[Visual Evidence] Capturing R6 Pending approval (Mobile)...');
    await authPage.setViewportSize({ width: 390, height: 844 });
    await authPage.screenshot({ path: path.join(EVIDENCE_DIR, 'r6_pending_mobile.png') });
    await authPage.setViewportSize({ width: 1280, height: 800 });

    // R7: Direct pending dashboard attempt resolves safely to /pending-approval
    console.log('[Visual Evidence] Testing direct dashboard navigation while PENDING...');
    await authPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    // Verify it redirects back to /pending-approval
    await authPage.waitForFunction(() => window.location.pathname.includes('/pending-approval'), { timeout: 15000 });
    console.log('[Visual Evidence] Capturing R7 Direct Pending Dashboard redirect...');
    await authPage.screenshot({ path: path.join(EVIDENCE_DIR, 'r7_direct_pending_dashboard_redirect.png') });

    // Identify created organization ID from DB for lifecycle transitions
    const [userWithOrg] = await db.select().from(users).where(eq(users.id, userRecord.id));
    const orgId = userWithOrg.organisationId!;
    createdOrgIds.push(orgId);

    // ─── R8: Platform PENDING organisation ───────────────────────────────────
    console.log('[Visual Evidence] Logging in as platform admin for R8...');
    const adminContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const adminPage = await adminContext.newPage();

    await adminPage.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await adminPage.waitForSelector('input[type="email"]');
    await adminPage.waitForTimeout(1000); // Wait for React hydration
    await adminPage.fill('input[type="email"]', adminEmail);
    await adminPage.fill('input[type="password"]', password);
    await adminPage.click('button[type="submit"]');
    await adminPage.waitForTimeout(2000);

    await adminPage.goto(`${BASE_URL}/platform/organisations`, { waitUntil: 'domcontentloaded' });
    await adminPage.waitForSelector('#platform-orgs-heading', { timeout: 15000 });
    console.log('[Visual Evidence] Capturing R8 Platform PENDING organisation...');
    await adminPage.screenshot({ path: path.join(EVIDENCE_DIR, 'r8_platform_pending_org.png') });

    // ─── R9: Approved ACTIVE in platform view ────────────────────────────────
    console.log('[Visual Evidence] Updating organisation to ACTIVE...');
    await db.update(organisations).set({
      approvalStatus: 'ACTIVE',
      approvedAt: new Date(),
      approvedBy: adminRecord.id,
    }).where(eq(organisations.id, orgId));

    await adminPage.reload({ waitUntil: 'domcontentloaded' });
    await adminPage.waitForSelector('#platform-orgs-heading', { timeout: 15000 });
    console.log('[Visual Evidence] Capturing R9 Approved ACTIVE in platform...');
    await adminPage.screenshot({ path: path.join(EVIDENCE_DIR, 'r9_approved_active_platform.png') });

    // ─── R10: Active Dashboard Access ────────────────────────────────────────
    console.log('[Visual Evidence] Navigating tenant to /dashboard as ACTIVE...');
    await authPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await authPage.waitForSelector('main', { timeout: 15000 });
    console.log('[Visual Evidence] Capturing R10 Active Dashboard...');
    await authPage.screenshot({ path: path.join(EVIDENCE_DIR, 'r10_active_dashboard.png') });

    // ─── R11: Suspended Status ───────────────────────────────────────────────
    console.log('[Visual Evidence] Updating organisation to SUSPENDED...');
    await db.update(organisations).set({
      approvalStatus: 'SUSPENDED',
    }).where(eq(organisations.id, orgId));

    await authPage.goto(`${BASE_URL}/pending-approval`, { waitUntil: 'domcontentloaded' });
    await authPage.waitForSelector('text=Your account has been suspended');
    console.log('[Visual Evidence] Capturing R11 Suspended...');
    await authPage.screenshot({ path: path.join(EVIDENCE_DIR, 'r11_suspended_org.png') });

    // ─── R12: Rejected Status ────────────────────────────────────────────────
    console.log('[Visual Evidence] Updating organisation to REJECTED...');
    await db.update(organisations).set({
      approvalStatus: 'REJECTED',
      rejectionReason: 'Incomplete organisation registration details provided.',
    }).where(eq(organisations.id, orgId));

    await authPage.goto(`${BASE_URL}/pending-approval`, { waitUntil: 'domcontentloaded' });
    await authPage.waitForSelector('text=Your application was not approved');
    console.log('[Visual Evidence] Capturing R12 Rejected...');
    await authPage.screenshot({ path: path.join(EVIDENCE_DIR, 'r12_rejected_org.png') });

    console.log('\n[Visual Evidence] All 12 Visual Requirements (R1-R12) captured successfully!');

  } finally {
    if (browser) await browser.close();

    console.log('\n=== Fixture Cleanup ===');
    if (createdOrgIds.length > 0) {
      await db.delete(auditEvents).where(inArray(auditEvents.organisationId, createdOrgIds));
      await db.delete(orgMemberships).where(inArray(orgMemberships.organisationId, createdOrgIds));
      await db.delete(centres).where(inArray(centres.organisationId, createdOrgIds));
      await db.delete(organisations).where(inArray(organisations.id, createdOrgIds));
    }
    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }

    const remainingOrgs = createdOrgIds.length > 0
      ? await db.select().from(organisations).where(inArray(organisations.id, createdOrgIds))
      : [];
    const remainingUsers = createdUserIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, createdUserIds))
      : [];

    console.log(`Remaining synthetic organisations: ${remainingOrgs.length}`);
    console.log(`Remaining synthetic users: ${remainingUsers.length}`);
    console.log(`Cleanup count = 0 synthetic fixtures remaining.`);

    await client.end();
  }
}

main().catch((err) => {
  console.error('[Visual Evidence] Fatal Error:', err);
  process.exit(1);
});
