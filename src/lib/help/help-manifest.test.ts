/**
 * SprintScale CMS — PM-1B.R1 Help Manifest & Role Model Forensic Tests
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { userRoleEnum } from '@/db/schema';
import { HELP_CATEGORIES, HELP_GUIDES, HELP_VIDEOS } from './help-manifest';
import { HELP_LEARNING_PATHS } from './help-learning-paths-manifest';
import { CMS_STAFF_ROLES, HELP_AUDIENCES } from './types';
import {
  getAllCategories,
  getAllGuides,
  getAllVideos,
  getCategoryById,
  getGuideBySlug,
  getGuidesByCategory,
  getGuidesByRole,
  getGuidesByAudience,
  getVideoById,
  getVideosByGuideSlug,
  searchHelp,
} from './get-help-content';

describe('PM-1B.R1 Help Manifest & Foundation Validation', () => {
  describe('Staff Role vs Audience Model Forensic Integrity', () => {
    it('should derive CMS_STAFF_ROLES exactly from the canonical userRoleEnum', () => {
      const canonicalRoles = userRoleEnum.enumValues;
      expect(CMS_STAFF_ROLES).toEqual(canonicalRoles);
      expect(CMS_STAFF_ROLES).toEqual(['ORG_OWNER', 'MANAGER', 'FRONT_DESK', 'TUTOR']);
    });

    it('should NOT treat PARENT as an authenticated CMS staff role', () => {
      expect((CMS_STAFF_ROLES as readonly string[]).includes('PARENT')).toBe(false);
      expect((userRoleEnum.enumValues as readonly string[]).includes('PARENT')).toBe(false);
    });

    it('should classify PARENT strictly as an audience persona in HELP_AUDIENCES', () => {
      expect(HELP_AUDIENCES).toContain('PARENT');
    });

    it('should ensure no guide has PARENT in recommendedStaffRoles', () => {
      for (const guide of HELP_GUIDES) {
        expect((guide.recommendedStaffRoles as string[]).includes('PARENT')).toBe(false);
        for (const role of guide.recommendedStaffRoles) {
          expect(CMS_STAFF_ROLES).toContain(role);
        }
      }
    });

    it('should return empty array when getGuidesByRole is queried with PARENT or invalid role', () => {
      const parentResult = getGuidesByRole('PARENT');
      expect(parentResult).toEqual([]);

      const invalidResult = getGuidesByRole('SUPERUSER');
      expect(invalidResult).toEqual([]);
    });

    it('should allow querying parent guides via getGuidesByAudience', () => {
      const parentAudienceGuides = getGuidesByAudience('PARENT');
      expect(parentAudienceGuides.length).toBeGreaterThan(0);
      expect(parentAudienceGuides.some(g => g.slug === 'parent-portal-guide')).toBe(true);
      expect(parentAudienceGuides.some(g => g.slug === 'parent-getting-started')).toBe(true);
    });
  });

  describe('Category Integrity', () => {
    it('should have 7 distinct categories', () => {
      expect(HELP_CATEGORIES.length).toBe(7);
      const categoryIds = HELP_CATEGORIES.map(c => c.id);
      const uniqueIds = new Set(categoryIds);
      expect(uniqueIds.size).toBe(7);
    });

    it('should retrieve category by id', () => {
      const cat = getCategoryById('core-operations');
      expect(cat).toBeDefined();
      expect(cat?.name).toBe('Core Operations');
    });
  });

  describe('Guide Manifest Integrity', () => {
    it('should contain exactly 34 approved user guides', () => {
      expect(HELP_GUIDES.length).toBe(34);
    });

    it('should have unique IDs and slugs across all 34 guides', () => {
      const ids = new Set<string>();
      const slugs = new Set<string>();

      for (const guide of HELP_GUIDES) {
        expect(ids.has(guide.id)).toBe(false);
        expect(slugs.has(guide.slug)).toBe(false);
        ids.add(guide.id);
        slugs.add(guide.slug);
      }
    });

    it('should ensure all 34 guide content files physically exist in src/content/help/', () => {
      const baseDir = path.resolve(process.cwd(), 'src/content/help');
      for (const guide of HELP_GUIDES) {
        const fullPath = path.join(baseDir, guide.contentPath);
        expect(fs.existsSync(fullPath)).toBe(true);
      }
    });

    it('should ensure all guide categories are valid', () => {
      const validCategories = new Set(HELP_CATEGORIES.map(c => c.id));
      for (const guide of HELP_GUIDES) {
        expect(validCategories.has(guide.category)).toBe(true);
      }
    });
  });

  describe('Video Manifest & Public Asset Integrity', () => {
    it('should contain exactly 52 certified micro-videos', () => {
      expect(HELP_VIDEOS.length).toBe(52);
    });

    it('should have unique video IDs from SS-D6-V001 to SS-D6-V052', () => {
      const videoIds = new Set<string>();
      for (const video of HELP_VIDEOS) {
        expect(videoIds.has(video.id)).toBe(false);
        videoIds.add(video.id);
      }
      expect(videoIds.size).toBe(52);
    });

    it('should ensure all 52 video files physically exist in public/training/assets/videos/', () => {
      const videoDir = path.resolve(process.cwd(), 'public/training/assets/videos');
      for (const video of HELP_VIDEOS) {
        const fullPath = path.join(videoDir, `${video.id}.mp4`);
        expect(fs.existsSync(fullPath)).toBe(true);
      }
    });

    it('should ensure all video target guide slugs exist in the guide manifest', () => {
      const guideSlugs = new Set(HELP_GUIDES.map(g => g.slug));
      for (const video of HELP_VIDEOS) {
        expect(guideSlugs.has(video.targetGuideSlug)).toBe(true);
      }
    });
  });

  describe('Screenshot Asset Integrity', () => {
    it('should ensure all referenced screenshots physically exist in public/training/assets/screenshots/annotated/', () => {
      const screenshotDir = path.resolve(process.cwd(), 'public/training/assets/screenshots/annotated');
      const allReferencedScreenshots = new Set<string>();
      for (const guide of HELP_GUIDES) {
        for (const s of guide.screenshots) {
          allReferencedScreenshots.add(s);
        }
      }

      for (const sId of allReferencedScreenshots) {
        const fullPath = path.join(screenshotDir, `${sId}.png`);
        expect(fs.existsSync(fullPath)).toBe(true);
      }
    });
  });

  describe('Security & Default-Deny Access Boundary', () => {
    it('should return null when querying an unmanifested or arbitrary slug', () => {
      const result = getGuideBySlug('unknown-arbitrary-guide');
      expect(result).toBeNull();
    });

    it('should reject path traversal attempts and return null', () => {
      const result1 = getGuideBySlug('../../../package.json');
      const result2 = getGuideBySlug('../../project-notes/documentation-training/README.md');
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('should prevent arbitrary unmanifested Markdown files from becoming exposed', () => {
      // e.g. An internal audit file in project-notes
      const result = getGuideBySlug('d0-production-documentation-audit');
      expect(result).toBeNull();
    });

    it('should successfully load content for allowlisted guides', () => {
      const result = getGuideBySlug('attendance-roll-call');
      expect(result).not.toBeNull();
      expect(result?.meta.title).toBe('Functional Manual: Attendance & Roll Call');
      expect(result?.content).toContain('# SprintScale CMS');
    });
  });

  describe('Role Filtering & Search Capabilities', () => {
    it('should filter guides by authenticated staff role', () => {
      const tutorGuides = getGuidesByRole('TUTOR');
      expect(tutorGuides.length).toBeGreaterThan(0);
      expect(tutorGuides.some(g => g.slug === 'tutor-first-day')).toBe(true);
      expect(tutorGuides.some(g => g.slug === 'attendance-roll-call')).toBe(true);

      const frontDeskGuides = getGuidesByRole('FRONT_DESK');
      expect(frontDeskGuides.length).toBeGreaterThan(0);
      // Front desk is recommended to reference parent guide for parent support
      expect(frontDeskGuides.some(g => g.slug === 'parent-portal-guide')).toBe(true);
    });

    it('should search guides and videos by query keyword', () => {
      const searchRes = searchHelp('attendance');
      expect(searchRes.guides.length).toBeGreaterThan(0);
      expect(searchRes.videos.length).toBeGreaterThan(0);
      expect(searchRes.guides.some(g => g.slug === 'attendance-roll-call')).toBe(true);
    });

    it('should return empty arrays for blank search queries', () => {
      const searchRes = searchHelp('   ');
      expect(searchRes.guides).toEqual([]);
      expect(searchRes.videos).toEqual([]);
    });

    it('should retrieve videos by guide slug', () => {
      const videos = getVideosByGuideSlug('attendance-roll-call');
      expect(videos.length).toBeGreaterThan(0);
      expect(videos.some(v => v.id === 'SS-D6-V006')).toBe(true);
    });
  });

  describe('Manager Access Expansion — Help & Training Alignment', () => {
    const MANAGER_PERMITTED_OPERATIONAL_SLUGS = [
      'finance-overview',
      'invoices-billing',
      'payments-reconciliation',
      'agreed-fee-billing',
      'centres-multi-centre',
      'staff-access-permissions',
      'administration-settings',
    ];

    it('should include MANAGER in targetAudience and recommendedStaffRoles for operational finance and administration guides', () => {
      for (const slug of MANAGER_PERMITTED_OPERATIONAL_SLUGS) {
        const guide = HELP_GUIDES.find(g => g.slug === slug);
        expect(guide, `Guide ${slug} should exist in HELP_GUIDES`).toBeDefined();
        expect(guide?.targetAudience).toContain('MANAGER');
        expect(guide?.recommendedStaffRoles).toContain('MANAGER');
      }
    });

    it('should configure lp-centre-manager learning path with finance and staffing sections', () => {
      const managerPath = HELP_LEARNING_PATHS.find(lp => lp.id === 'lp-centre-manager');
      expect(managerPath).toBeDefined();

      const sectionIds = managerPath?.sections.map(s => s.id) ?? [];
      expect(sectionIds).toContain('manager-finance-invoicing');
      expect(sectionIds).toContain('manager-staffing-teams');
      expect(sectionIds).toContain('manager-continuous-handbook');

      // Finance section items
      const financeSection = managerPath?.sections.find(s => s.id === 'manager-finance-invoicing');
      const financeSlugs = financeSection?.items.map(i => i.slug) ?? [];
      expect(financeSlugs).toContain('finance-overview');
      expect(financeSlugs).toContain('invoices-billing');
      expect(financeSlugs).toContain('payments-reconciliation');
      expect(financeSlugs).toContain('recording-an-offline-cash-payment');
      expect(financeSlugs).toContain('reconciling-childcare-vouchers-and-tfc');

      // Staffing section items
      const staffingSection = managerPath?.sections.find(s => s.id === 'manager-staffing-teams');
      const staffingSlugs = staffingSection?.items.map(i => i.slug) ?? [];
      expect(staffingSlugs).toContain('centres-multi-centre');
      expect(staffingSlugs).toContain('staff-access-permissions');
      expect(staffingSlugs).toContain('inviting-a-new-staff-member-via-email');
      expect(staffingSlugs).toContain('scoping-staff-access-across-specific-centres');
    });

    it('should verify guide content files no longer contain obsolete Owner-only claims for operational features', () => {
      const baseDir = path.resolve(process.cwd(), 'src/content/help');

      // 1. manager-guide.md must not say Finance or Staffing requires Owner authority
      const mgrGuide = fs.readFileSync(path.join(baseDir, 'getting-started/manager-guide.md'), 'utf-8');
      expect(mgrGuide).not.toContain('Finance & Invoicing: Creating family billing configs, issuing monthly invoices, and recording payments.');
      expect(mgrGuide).not.toContain('Staff Roles & Invites: Inviting new staff members or modifying staff permissions.');
      expect(mgrGuide).not.toContain('Centre Banking Setup: Modifying centre bank account details.');
      expect(mgrGuide).toContain('Finance & Invoicing (Assigned Centres)');
      expect(mgrGuide).toContain('Staff Management (Assigned Centres)');

      // 2. finance-overview.md must show Manager access for Finance Dashboard
      const finOverview = fs.readFileSync(path.join(baseDir, 'finance/finance-overview.md'), 'utf-8');
      expect(finOverview).not.toContain('Global Finance Dashboard (`/dashboard/finance`)** | ✅ Full Access | ❌ Blocked');
      expect(finOverview).toContain('| **Finance Dashboard (`/dashboard/finance`)** | ✅ All Centres | ✅ Assigned Centres |');

      // 3. staff-access-permissions.md must reflect Manager permissions
      const staffPerms = fs.readFileSync(path.join(baseDir, 'administration/staff-access-permissions.md'), 'utf-8');
      expect(staffPerms).not.toContain('| **Global Finance & Invoices (`/dashboard/finance`)** | ✅ Full Access | ❌ Blocked |');
      expect(staffPerms).not.toContain('| **Invite Staff (`/dashboard/staff/invite`)** | ✅ **Owner Only** | ❌ Blocked |');
      expect(staffPerms).toContain('| **Finance Dashboard (`/dashboard/finance`)** | ✅ All Centres | ✅ Assigned Centres |');
      expect(staffPerms).toContain('| **Invite Staff (`/dashboard/staff/invite`)** | ✅ All Roles & Centres | ✅ Assigned Centres (Mgr/FD/Tutor) |');

      // 4. centres-multi-centre.md must not state bank details or staff assignment are Owner-only
      const centresDoc = fs.readFileSync(path.join(baseDir, 'administration/centres-multi-centre.md'), 'utf-8');
      expect(centresDoc).not.toContain('only Organisation Owners can update bank details');
      expect(centresDoc).not.toContain('| **Edit Centre Bank & Billing Details** | ✅ **Owner Only** | ❌ Blocked |');
      expect(centresDoc).not.toContain('| **Assign Staff to Centre** | ✅ Full Access | ❌ Blocked |');
      expect(centresDoc).toContain('| **Edit Centre Bank & Billing Details** | ✅ All Centres | ✅ Assigned Centres |');
      expect(centresDoc).toContain('| **Assign Staff to Centre** | ✅ All Centres | ✅ Assigned Centres |');
      expect(centresDoc).toContain('Organisation Owners and Centre Managers (for their authorised centre venues) can configure operating bank details');

      // 5. administration-settings.md must reflect Manager access to operational settings
      const adminSettings = fs.readFileSync(path.join(baseDir, 'administration/administration-settings.md'), 'utf-8');
      expect(adminSettings).not.toContain('Cannot access global organisation settings; restricted to assigned Centre Settings');
      expect(adminSettings).toContain('OPERATIONAL SETTINGS');

      // 6. master-manual 01-system-foundations.md must reflect Manager access to Finance, Staff, Settings
      const foundationsDoc = fs.readFileSync(path.join(baseDir, 'master-manual/01-system-foundations.md'), 'utf-8');
      expect(foundationsDoc).not.toContain('| **Finance, Invoices & Bank Reconciliation**| Full Access | No Access |');
      expect(foundationsDoc).not.toContain('| **Invite Staff & Assign Roles** | Full Access | No Access |');
      expect(foundationsDoc).toContain('| **Finance, Invoices & Bank Reconciliation**| Full Access | Assigned Centre(s) |');
      expect(foundationsDoc).toContain('| **Invite Staff & Assign Roles** | Full Access | Assigned Centre(s) |');
      expect(foundationsDoc).toContain('| **Organisation Settings & Branding** | Full Access | Operational Settings |');
    });

    it('should assert factual precision for GDPR export vs permanent deletion and invoice void vs delete', () => {
      const baseDir = path.resolve(process.cwd(), 'src/content/help');

      // 1. Full GDPR Export vs Routine Operational CSV Exports
      const adminSettings = fs.readFileSync(path.join(baseDir, 'administration/administration-settings.md'), 'utf-8');
      expect(adminSettings).toContain('Full Organisation GDPR Export vs. Routine Operational Exports');
      expect(adminSettings).toContain('exportOrganisationData');
      expect(adminSettings).toContain('hardDeleteParent');

      // 2. Invoice Void (status transition) vs Delete (hard delete, zero payments)
      const finOverview = fs.readFileSync(path.join(baseDir, 'finance/finance-overview.md'), 'utf-8');
      expect(finOverview).toContain('| **Void an Issued Invoice (`voidInvoice`)** | ✅ **Owner Only** |');
      expect(finOverview).toContain('| **Delete an Invoice (`deleteInvoice`, Zero Payments)** | ✅ **Owner Only** |');
      expect(finOverview).toContain('status = \'void\'');
      expect(finOverview).toContain('invoice.payments.length === 0');

      const invBilling = fs.readFileSync(path.join(baseDir, 'finance/invoices-billing.md'), 'utf-8');
      expect(invBilling).toContain('### Procedure 4: Voiding an Invoice (Status Transition)');
      expect(invBilling).toContain('### Procedure 5: Deleting an Invoice (Hard Deletion with Zero-Payment Protection)');
      expect(invBilling).toContain('Please delete associated payments before deleting the invoice.');

      // 3. Permanent GDPR Purge in Recovery Bin is Owner-only
      const ownerGuide = fs.readFileSync(path.join(baseDir, 'getting-started/owner-guide.md'), 'utf-8');
      expect(ownerGuide).toContain('Permanent GDPR Purge vs. Soft Deletion');
      expect(ownerGuide).toContain('hardDeleteParent');

      // 4. Staff access permissions matrix specifies both void and delete
      const staffPerms = fs.readFileSync(path.join(baseDir, 'administration/staff-access-permissions.md'), 'utf-8');
      expect(staffPerms).toContain('| **Void Invoice (`voidInvoice`)** | ✅ **Owner Only** |');
      expect(staffPerms).toContain('| **Delete Invoice (`deleteInvoice`, Zero Payments)** | ✅ **Owner Only** |');
      expect(staffPerms).toContain('| **Operational Reports & CSV Exports** | ✅ Full Access | ✅ Assigned Centres |');
      expect(staffPerms).toContain('| **Full GDPR Organisation Export (JSON)** | ✅ **Owner Only** |');
      expect(staffPerms).toContain('| **Permanent GDPR Purge (`hardDeleteParent`)** | ✅ **Owner Only** |');
    });
  });
});
