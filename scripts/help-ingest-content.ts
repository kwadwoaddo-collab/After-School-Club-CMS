/**
 * SprintScale CMS — Milestone PM-1B Content Ingestion Tool
 * Deterministically copies only the 34 allowlisted user guides into src/content/help/
 * and normalizes visual asset references to clean public application URLs.
 */

import fs from 'fs';
import path from 'path';

export interface GuideAllowlistEntry {
  id: string;
  slug: string;
  title: string;
  category: string;
  audience: string;
  targetAudience: ('ALL_STAFF' | 'ORG_OWNER' | 'MANAGER' | 'FRONT_DESK' | 'TUTOR' | 'PARENT')[];
  recommendedStaffRoles: ('ORG_OWNER' | 'MANAGER' | 'FRONT_DESK' | 'TUTOR')[];
  sourceRelPath: string;
  destRelPath: string;
  order: number;
}

export const ALLOWLISTED_GUIDES: GuideAllowlistEntry[] = [
  // 1. Getting Started (Quick Starts & Role Guides)
  {
    id: 'qs-owner',
    slug: 'owner-first-30-minutes',
    title: 'Organisation Owner: First 30 Minutes',
    category: 'getting-started',
    audience: 'Organisation Owners',
    targetAudience: ["ORG_OWNER"],
    recommendedStaffRoles: ["ORG_OWNER"],
    sourceRelPath: 'quick-start/owner-first-30-minutes.md',
    destRelPath: 'getting-started/owner-first-30-minutes.md',
    order: 1,
  },
  {
    id: 'qs-manager',
    slug: 'manager-first-30-minutes',
    title: 'Centre Manager: First 30 Minutes',
    category: 'getting-started',
    audience: 'Centre Managers',
    targetAudience: ["MANAGER","ORG_OWNER"],
    recommendedStaffRoles: ["MANAGER","ORG_OWNER"],
    sourceRelPath: 'quick-start/manager-first-30-minutes.md',
    destRelPath: 'getting-started/manager-first-30-minutes.md',
    order: 2,
  },
  {
    id: 'qs-tutor',
    slug: 'tutor-first-day',
    title: 'Tutor / Club Leader: First Day Guide',
    category: 'getting-started',
    audience: 'Tutors and Club Leaders',
    targetAudience: ["TUTOR"],
    recommendedStaffRoles: ["TUTOR"],
    sourceRelPath: 'quick-start/tutor-first-day.md',
    destRelPath: 'getting-started/tutor-first-day.md',
    order: 3,
  },
  {
    id: 'qs-parent',
    slug: 'parent-getting-started',
    title: 'Parent Portal: Getting Started',
    category: 'getting-started',
    audience: 'Parents & Staff Reference',
    targetAudience: ["PARENT","FRONT_DESK","MANAGER"],
    recommendedStaffRoles: ["FRONT_DESK","MANAGER"],
    sourceRelPath: 'quick-start/parent-getting-started.md',
    destRelPath: 'getting-started/parent-getting-started.md',
    order: 4,
  },
  {
    id: 'rg-owner',
    slug: 'owner-guide',
    title: 'Role Guide: Organisation Owner',
    category: 'getting-started',
    audience: 'Organisation Owners',
    targetAudience: ["ORG_OWNER"],
    recommendedStaffRoles: ["ORG_OWNER"],
    sourceRelPath: 'role-guides/owner-guide.md',
    destRelPath: 'getting-started/owner-guide.md',
    order: 5,
  },
  {
    id: 'rg-manager',
    slug: 'manager-guide',
    title: 'Role Guide: Centre Manager',
    category: 'getting-started',
    audience: 'Centre Managers',
    targetAudience: ["MANAGER","ORG_OWNER"],
    recommendedStaffRoles: ["MANAGER","ORG_OWNER"],
    sourceRelPath: 'role-guides/manager-guide.md',
    destRelPath: 'getting-started/manager-guide.md',
    order: 6,
  },
  {
    id: 'rg-front-desk',
    slug: 'front-desk-guide',
    title: 'Role Guide: Front Desk Operations',
    category: 'getting-started',
    audience: 'Front Desk Staff',
    targetAudience: ["FRONT_DESK","MANAGER","ORG_OWNER"],
    recommendedStaffRoles: ["FRONT_DESK","MANAGER","ORG_OWNER"],
    sourceRelPath: 'role-guides/front-desk-guide.md',
    destRelPath: 'getting-started/front-desk-guide.md',
    order: 7,
  },
  {
    id: 'rg-tutor',
    slug: 'tutor-guide',
    title: 'Role Guide: Tutor & Session Delivery',
    category: 'getting-started',
    audience: 'Tutors and Activity Leaders',
    targetAudience: ["TUTOR"],
    recommendedStaffRoles: ["TUTOR"],
    sourceRelPath: 'role-guides/tutor-guide.md',
    destRelPath: 'getting-started/tutor-guide.md',
    order: 8,
  },
  {
    id: 'rg-parent',
    slug: 'parent-portal-guide',
    title: 'Parent Portal: Complete User Guide',
    category: 'getting-started',
    audience: 'Parents & Front Desk Staff',
    targetAudience: ["PARENT","FRONT_DESK","MANAGER"],
    recommendedStaffRoles: ["FRONT_DESK","MANAGER"],
    sourceRelPath: 'role-guides/parent-guide.md',
    destRelPath: 'getting-started/parent-portal-guide.md',
    order: 9,
  },

  // 2. Core Operations (Functional Manuals)
  {
    id: 'fm-attendance',
    slug: 'attendance-roll-call',
    title: 'Functional Manual: Attendance & Roll Call',
    category: 'core-operations',
    audience: 'Tutors, Managers, Front Desk',
    targetAudience: ["TUTOR","MANAGER","FRONT_DESK","ORG_OWNER"],
    recommendedStaffRoles: ["TUTOR","MANAGER","FRONT_DESK","ORG_OWNER"],
    sourceRelPath: 'functional-manuals/attendance.md',
    destRelPath: 'core-operations/attendance-roll-call.md',
    order: 10,
  },
  {
    id: 'fm-bookings',
    slug: 'bookings-scheduling',
    title: 'Functional Manual: Bookings & Scheduling',
    category: 'core-operations',
    audience: 'Managers, Front Desk, Owners',
    targetAudience: ["MANAGER","FRONT_DESK","ORG_OWNER"],
    recommendedStaffRoles: ["MANAGER","FRONT_DESK","ORG_OWNER"],
    sourceRelPath: 'functional-manuals/bookings.md',
    destRelPath: 'core-operations/bookings-scheduling.md',
    order: 11,
  },
  {
    id: 'fm-students',
    slug: 'children-students',
    title: 'Functional Manual: Children & Students Directory',
    category: 'core-operations',
    audience: 'All Staff Roles',
    targetAudience: ["MANAGER","FRONT_DESK","TUTOR","ORG_OWNER"],
    recommendedStaffRoles: ["MANAGER","FRONT_DESK","TUTOR","ORG_OWNER"],
    sourceRelPath: 'functional-manuals/children-students.md',
    destRelPath: 'core-operations/children-students.md',
    order: 12,
  },
  {
    id: 'fm-student-records',
    slug: 'student-records-notes',
    title: 'Functional Manual: Student Records, Medical & Session Notes',
    category: 'core-operations',
    audience: 'Tutors, Managers, Front Desk',
    targetAudience: ["TUTOR","MANAGER","FRONT_DESK","ORG_OWNER"],
    recommendedStaffRoles: ["TUTOR","MANAGER","FRONT_DESK","ORG_OWNER"],
    sourceRelPath: 'functional-manuals/student-records-notes.md',
    destRelPath: 'core-operations/student-records-notes.md',
    order: 13,
  },
  {
    id: 'fm-parents',
    slug: 'parents-family-records',
    title: 'Functional Manual: Parents & Family Records',
    category: 'core-operations',
    audience: 'Managers, Front Desk, Owners',
    targetAudience: ["MANAGER","FRONT_DESK","ORG_OWNER"],
    recommendedStaffRoles: ["MANAGER","FRONT_DESK","ORG_OWNER"],
    sourceRelPath: 'functional-manuals/parents.md',
    destRelPath: 'core-operations/parents-family-records.md',
    order: 14,
  },
  {
    id: 'fm-registrations',
    slug: 'registrations-intake',
    title: 'Functional Manual: Registrations & Intake Review',
    category: 'core-operations',
    audience: 'Managers, Front Desk, Owners',
    targetAudience: ["MANAGER","FRONT_DESK","ORG_OWNER"],
    recommendedStaffRoles: ["MANAGER","FRONT_DESK","ORG_OWNER"],
    sourceRelPath: 'functional-manuals/registrations.md',
    destRelPath: 'core-operations/registrations-intake.md',
    order: 15,
  },
  {
    id: 'fm-communications',
    slug: 'communications-notifications',
    title: 'Functional Manual: Communications & Notification Dispatches',
    category: 'core-operations',
    audience: 'Managers, Owners',
    targetAudience: ["MANAGER","ORG_OWNER"],
    recommendedStaffRoles: ["MANAGER","ORG_OWNER"],
    sourceRelPath: 'functional-manuals/communications-notifications.md',
    destRelPath: 'core-operations/communications-notifications.md',
    order: 16,
  },

  // 3. Safeguarding & Incidents
  {
    id: 'fm-incidents',
    slug: 'incidents-safeguarding',
    title: 'Functional Manual: Incidents & Safeguarding Protocol',
    category: 'safeguarding',
    audience: 'All Staff Roles',
    targetAudience: ["MANAGER","FRONT_DESK","TUTOR","ORG_OWNER"],
    recommendedStaffRoles: ["MANAGER","FRONT_DESK","TUTOR","ORG_OWNER"],
    sourceRelPath: 'functional-manuals/incidents-safeguarding.md',
    destRelPath: 'safeguarding/incidents-safeguarding.md',
    order: 17,
  },

  // 4. Finance & Payments
  {
    id: 'fm-finance-overview',
    slug: 'finance-overview',
    title: 'Functional Manual: Finance Overview & KPIs',
    category: 'finance',
    audience: 'Organisation Owners, Senior Managers',
    targetAudience: ["ORG_OWNER","MANAGER"],
    recommendedStaffRoles: ["ORG_OWNER","MANAGER"],
    sourceRelPath: 'functional-manuals/finance-overview.md',
    destRelPath: 'finance/finance-overview.md',
    order: 18,
  },
  {
    id: 'fm-invoices',
    slug: 'invoices-billing',
    title: 'Functional Manual: Invoices & Billing Management',
    category: 'finance',
    audience: 'Organisation Owners, Finance Staff',
    targetAudience: ["ORG_OWNER","MANAGER"],
    recommendedStaffRoles: ["ORG_OWNER","MANAGER"],
    sourceRelPath: 'functional-manuals/invoices.md',
    destRelPath: 'finance/invoices-billing.md',
    order: 19,
  },
  {
    id: 'fm-payments',
    slug: 'payments-reconciliation',
    title: 'Functional Manual: Payments & Reconciliation',
    category: 'finance',
    audience: 'Organisation Owners, Finance Staff',
    targetAudience: ["ORG_OWNER","MANAGER"],
    recommendedStaffRoles: ["ORG_OWNER","MANAGER"],
    sourceRelPath: 'functional-manuals/payments-reconciliation.md',
    destRelPath: 'finance/payments-reconciliation.md',
    order: 20,
  },
  {
    id: 'fm-agreed-fees',
    slug: 'agreed-fee-billing',
    title: 'Functional Manual: Agreed-Fee Family Billing Plans',
    category: 'finance',
    audience: 'Organisation Owners, Finance Staff',
    targetAudience: ["ORG_OWNER","MANAGER"],
    recommendedStaffRoles: ["ORG_OWNER","MANAGER"],
    sourceRelPath: 'functional-manuals/agreed-fee-billing.md',
    destRelPath: 'finance/agreed-fee-billing.md',
    order: 21,
  },

  // 5. Administration & Settings
  {
    id: 'fm-centres',
    slug: 'centres-multi-centre',
    title: 'Functional Manual: Multi-Centre Administration',
    category: 'administration',
    audience: 'Organisation Owners, Managers',
    targetAudience: ["ORG_OWNER","MANAGER"],
    recommendedStaffRoles: ["ORG_OWNER","MANAGER"],
    sourceRelPath: 'functional-manuals/centres-multi-centre.md',
    destRelPath: 'administration/centres-multi-centre.md',
    order: 22,
  },
  {
    id: 'fm-staff-permissions',
    slug: 'staff-access-permissions',
    title: 'Functional Manual: Staff Directory & Access Permissions',
    category: 'administration',
    audience: 'Organisation Owners, Managers',
    targetAudience: ["ORG_OWNER","MANAGER"],
    recommendedStaffRoles: ["ORG_OWNER","MANAGER"],
    sourceRelPath: 'functional-manuals/staff-access-permissions.md',
    destRelPath: 'administration/staff-access-permissions.md',
    order: 23,
  },
  {
    id: 'fm-academic-year',
    slug: 'academic-year-data-maintenance',
    title: 'Functional Manual: Academic-Year Rollover & Maintenance',
    category: 'administration',
    audience: 'Organisation Owners',
    targetAudience: ["ORG_OWNER"],
    recommendedStaffRoles: ["ORG_OWNER"],
    sourceRelPath: 'functional-manuals/academic-year-data-maintenance.md',
    destRelPath: 'administration/academic-year-data-maintenance.md',
    order: 24,
  },
  {
    id: 'fm-administration-settings',
    slug: 'administration-settings',
    title: 'Functional Manual: Organisation & Centre Settings',
    category: 'administration',
    audience: 'Organisation Owners',
    targetAudience: ["ORG_OWNER"],
    recommendedStaffRoles: ["ORG_OWNER"],
    sourceRelPath: 'functional-manuals/administration-settings.md',
    destRelPath: 'administration/administration-settings.md',
    order: 25,
  },

  // 6. Troubleshooting Handbooks
  {
    id: 'tb-family-booking',
    slug: 'family-booking-troubleshooting',
    title: 'Troubleshooting: Family & Booking Workflows',
    category: 'troubleshooting',
    audience: 'Managers, Front Desk, Owners',
    targetAudience: ["MANAGER","FRONT_DESK","ORG_OWNER"],
    recommendedStaffRoles: ["MANAGER","FRONT_DESK","ORG_OWNER"],
    sourceRelPath: 'troubleshooting/d2-family-booking-troubleshooting.md',
    destRelPath: 'troubleshooting/family-booking-troubleshooting.md',
    order: 26,
  },
  {
    id: 'tb-attendance-safeguarding',
    slug: 'attendance-safeguarding-troubleshooting',
    title: 'Troubleshooting: Attendance & Safeguarding Operations',
    category: 'troubleshooting',
    audience: 'Tutors, Managers, Front Desk',
    targetAudience: ["TUTOR","MANAGER","FRONT_DESK","ORG_OWNER"],
    recommendedStaffRoles: ["TUTOR","MANAGER","FRONT_DESK","ORG_OWNER"],
    sourceRelPath: 'troubleshooting/d3-attendance-safeguarding-troubleshooting.md',
    destRelPath: 'troubleshooting/attendance-safeguarding-troubleshooting.md',
    order: 27,
  },
  {
    id: 'tb-finance',
    slug: 'finance-troubleshooting',
    title: 'Troubleshooting: Invoices, Billing & Payments',
    category: 'troubleshooting',
    audience: 'Organisation Owners, Finance Staff',
    targetAudience: ["ORG_OWNER","MANAGER"],
    recommendedStaffRoles: ["ORG_OWNER","MANAGER"],
    sourceRelPath: 'troubleshooting/d4-finance-troubleshooting.md',
    destRelPath: 'troubleshooting/finance-troubleshooting.md',
    order: 28,
  },
  {
    id: 'tb-administration',
    slug: 'administration-troubleshooting',
    title: 'Troubleshooting: Multi-Centre & Team Administration',
    category: 'troubleshooting',
    audience: 'Organisation Owners, Managers',
    targetAudience: ["ORG_OWNER","MANAGER"],
    recommendedStaffRoles: ["ORG_OWNER","MANAGER"],
    sourceRelPath: 'troubleshooting/d5-administration-troubleshooting.md',
    destRelPath: 'troubleshooting/administration-troubleshooting.md',
    order: 29,
  },

  // 7. Master User Manual
  {
    id: 'mm-01-foundations',
    slug: 'master-system-foundations',
    title: 'Master User Manual: 01 System Foundations & Architecture',
    category: 'master-manual',
    audience: 'All Staff Roles',
    targetAudience: ["ORG_OWNER","MANAGER","FRONT_DESK","TUTOR"],
    recommendedStaffRoles: ["ORG_OWNER","MANAGER","FRONT_DESK","TUTOR"],
    sourceRelPath: 'master-manual/01-system-foundations.md',
    destRelPath: 'master-manual/01-system-foundations.md',
    order: 30,
  },
  {
    id: 'mm-02-family-booking',
    slug: 'master-family-to-booking',
    title: 'Master User Manual: 02 Family to Booking Journey',
    category: 'master-manual',
    audience: 'Managers, Front Desk, Owners',
    targetAudience: ["ORG_OWNER","MANAGER","FRONT_DESK"],
    recommendedStaffRoles: ["ORG_OWNER","MANAGER","FRONT_DESK"],
    sourceRelPath: 'master-manual/02-family-to-booking-journey.md',
    destRelPath: 'master-manual/02-family-to-booking-journey.md',
    order: 31,
  },
  {
    id: 'mm-03-attendance-safeguarding',
    slug: 'master-attendance-to-safeguarding',
    title: 'Master User Manual: 03 Attendance to Safeguarding Journey',
    category: 'master-manual',
    audience: 'Tutors, Managers, Front Desk',
    targetAudience: ["ORG_OWNER","MANAGER","FRONT_DESK","TUTOR"],
    recommendedStaffRoles: ["ORG_OWNER","MANAGER","FRONT_DESK","TUTOR"],
    sourceRelPath: 'master-manual/03-attendance-to-safeguarding-journey.md',
    destRelPath: 'master-manual/03-attendance-to-safeguarding-journey.md',
    order: 32,
  },
  {
    id: 'mm-04-finance-billing',
    slug: 'master-finance-billing-payments',
    title: 'Master User Manual: 04 Finance, Billing & Payments Journey',
    category: 'master-manual',
    audience: 'Organisation Owners, Finance Staff',
    targetAudience: ["ORG_OWNER","MANAGER"],
    recommendedStaffRoles: ["ORG_OWNER","MANAGER"],
    sourceRelPath: 'master-manual/04-finance-billing-payments-journey.md',
    destRelPath: 'master-manual/04-finance-billing-payments-journey.md',
    order: 33,
  },
  {
    id: 'mm-05-administration-operations',
    slug: 'master-administration-operations',
    title: 'Master User Manual: 05 Administration & Operations',
    category: 'master-manual',
    audience: 'Organisation Owners, Managers',
    targetAudience: ["ORG_OWNER","MANAGER"],
    recommendedStaffRoles: ["ORG_OWNER","MANAGER"],
    sourceRelPath: 'master-manual/05-administration-and-operations.md',
    destRelPath: 'master-manual/05-administration-and-operations.md',
    order: 34,
  },
];

const SOURCE_BASE_DIR = path.resolve('project-notes/documentation-training');
const DEST_BASE_DIR = path.resolve('src/content/help');

export function ingestHelpContent() {
  console.log('=== SPRINT SCALE CMS — PM-1B CONTENT INGESTION ===\n');

  let copiedCount = 0;
  for (const entry of ALLOWLISTED_GUIDES) {
    const srcPath = path.join(SOURCE_BASE_DIR, entry.sourceRelPath);
    const destPath = path.join(DEST_BASE_DIR, entry.destRelPath);

    if (!fs.existsSync(srcPath)) {
      throw new Error(`Allowlisted source document missing: ${srcPath}`);
    }

    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    let content = fs.readFileSync(srcPath, 'utf-8');

    // Normalize screenshot paths to /training/assets/screenshots/annotated/SS-D6-Sxxx.png
    content = content.replace(
      /(?:\.\.\/)?assets\/screenshots\/annotated\/(SS-D6-S\d{3}\.png)/g,
      '/training/assets/screenshots/annotated/$1'
    );

    // Normalize video paths to /training/assets/videos/SS-D6-Vxxx.mp4
    content = content.replace(
      /(?:\.\.\/)?assets\/videos\/(SS-D6-V\d{3}\.mp4)/g,
      '/training/assets/videos/$1'
    );

    fs.writeFileSync(destPath, content, 'utf-8');
    copiedCount++;
  }

  console.log(`Ingested ${copiedCount} allowlisted user guides into ${DEST_BASE_DIR}.`);
}

// Run if called directly
ingestHelpContent();
