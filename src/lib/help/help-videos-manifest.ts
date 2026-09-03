/**
 * SprintScale CMS — Certified Training Videos Manifest (Phase D6 / Milestone PM-1E)
 * Canonical registry of all 52 certified micro-video walkthroughs.
 * Source assets: project-notes/documentation-training/assets/videos/
 * Public copies: public/training/assets/videos/
 * SHA-256 Checksum verified: 52/52 PASS
 */
import { HelpVideoMetadata } from './types';

export const HELP_VIDEOS: HelpVideoMetadata[] = [
  {
    "id": "SS-D6-V001",
    "slug": "registering-a-multi-child-family-via-public-portal",
    "title": "Registering a Multi-Child Family via Public Portal",
    "description": "Full end-to-end multi-child public registration submission",
    "category": "getting-started",
    "videoUrl": "/training/assets/videos/SS-D6-V001.mp4",
    "durationSeconds": 60,
    "durationLabel": "60s",
    "targetGuideSlug": "registrations-intake",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER",
      "FRONT_DESK",
      "TUTOR"
    ],
    "audienceLabel": "Parent",
    "relatedGuideSlugs": [
      "master-family-to-booking",
      "registrations-intake"
    ],
    "order": 1
  },
  {
    "id": "SS-D6-V002",
    "slug": "reviewing-and-approving-a-public-registration",
    "title": "Reviewing & Approving a Public Registration",
    "description": "Triage, matching, and approval of inbound parent registration",
    "category": "core-operations",
    "videoUrl": "/training/assets/videos/SS-D6-V002.mp4",
    "durationSeconds": 60,
    "durationLabel": "60s",
    "targetGuideSlug": "registrations-intake",
    "recommendedStaffRoles": [
      "MANAGER"
    ],
    "audienceLabel": "Manager",
    "relatedGuideSlugs": [
      "manager-first-30-minutes",
      "manager-guide",
      "master-family-to-booking",
      "registrations-intake"
    ],
    "order": 1
  },
  {
    "id": "SS-D6-V003",
    "slug": "creating-an-ad-hoc-single-session-booking",
    "title": "Creating an Ad-Hoc Single Session Booking",
    "description": "Booking a single session for an enrolled student",
    "category": "core-operations",
    "videoUrl": "/training/assets/videos/SS-D6-V003.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "bookings-scheduling",
    "recommendedStaffRoles": [
      "FRONT_DESK"
    ],
    "audienceLabel": "Front Desk",
    "relatedGuideSlugs": [
      "bookings-scheduling",
      "front-desk-guide"
    ],
    "order": 2
  },
  {
    "id": "SS-D6-V004",
    "slug": "setting-up-a-recurring-term-booking-plan",
    "title": "Setting up a Recurring Term Booking Plan",
    "description": "Configuring multi-week recurring schedule for enrolled pupil",
    "category": "core-operations",
    "videoUrl": "/training/assets/videos/SS-D6-V004.mp4",
    "durationSeconds": 60,
    "durationLabel": "60s",
    "targetGuideSlug": "bookings-scheduling",
    "recommendedStaffRoles": [
      "MANAGER"
    ],
    "audienceLabel": "Manager",
    "relatedGuideSlugs": [
      "bookings-scheduling"
    ],
    "order": 3
  },
  {
    "id": "SS-D6-V005",
    "slug": "booking-a-session-via-parent-portal",
    "title": "Booking a Session via Parent Portal",
    "description": "Parent self-service session booking workflow",
    "category": "getting-started",
    "videoUrl": "/training/assets/videos/SS-D6-V005.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "parent-portal-guide",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER",
      "FRONT_DESK",
      "TUTOR"
    ],
    "audienceLabel": "Parent",
    "relatedGuideSlugs": [
      "parent-getting-started",
      "parent-portal-guide"
    ],
    "order": 2
  },
  {
    "id": "SS-D6-V006",
    "slug": "marking-morning-and-afternoon-class-register",
    "title": "Marking Morning and Afternoon Class Register",
    "description": "Live attendance roll call check-in and check-out",
    "category": "core-operations",
    "videoUrl": "/training/assets/videos/SS-D6-V006.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "attendance-roll-call",
    "recommendedStaffRoles": [
      "TUTOR"
    ],
    "audienceLabel": "Tutor",
    "relatedGuideSlugs": [
      "attendance-roll-call",
      "manager-first-30-minutes",
      "master-attendance-to-safeguarding",
      "tutor-first-day",
      "tutor-guide"
    ],
    "order": 4
  },
  {
    "id": "SS-D6-V007",
    "slug": "operating-the-tablet-kiosk-sign-in-and-pick-up",
    "title": "Operating the Tablet Kiosk Sign-In & Pick-Up",
    "description": "Self-service sign-in and pick-up kiosk operation",
    "category": "core-operations",
    "videoUrl": "/training/assets/videos/SS-D6-V007.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "attendance-roll-call",
    "recommendedStaffRoles": [
      "FRONT_DESK"
    ],
    "audienceLabel": "Front Desk",
    "relatedGuideSlugs": [
      "attendance-roll-call",
      "front-desk-guide"
    ],
    "order": 5
  },
  {
    "id": "SS-D6-V008",
    "slug": "fast-walk-in-registration-from-daily-attendance",
    "title": "Fast Walk-In Registration from Daily Attendance",
    "description": "Fast-track walk-in child registration directly from roll call",
    "category": "core-operations",
    "videoUrl": "/training/assets/videos/SS-D6-V008.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "attendance-roll-call",
    "recommendedStaffRoles": [
      "FRONT_DESK"
    ],
    "audienceLabel": "Front Desk",
    "relatedGuideSlugs": [
      "attendance-roll-call",
      "front-desk-guide"
    ],
    "order": 6
  },
  {
    "id": "SS-D6-V009",
    "slug": "overriding-attendance-status-late-excused",
    "title": "Overriding Attendance Status (Late / Excused)",
    "description": "Changing student status to Late, Excused, or Absent with note",
    "category": "core-operations",
    "videoUrl": "/training/assets/videos/SS-D6-V009.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "attendance-roll-call",
    "recommendedStaffRoles": [
      "FRONT_DESK"
    ],
    "audienceLabel": "Front Desk",
    "relatedGuideSlugs": [
      "attendance-roll-call"
    ],
    "order": 7
  },
  {
    "id": "SS-D6-V010",
    "slug": "forgiving-an-absence-on-session-credit-ledger",
    "title": "Forgiving an Absence on Session Credit Ledger",
    "description": "Clearing student session deficit on attendance credit ledger",
    "category": "core-operations",
    "videoUrl": "/training/assets/videos/SS-D6-V010.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "attendance-roll-call",
    "recommendedStaffRoles": [
      "MANAGER"
    ],
    "audienceLabel": "Manager",
    "relatedGuideSlugs": [
      "attendance-roll-call",
      "manager-guide"
    ],
    "order": 8
  },
  {
    "id": "SS-D6-V011",
    "slug": "logging-a-first-aid-accident-on-body-map",
    "title": "Logging a First Aid Accident on Body Map",
    "description": "Recording first aid incident with anatomical body map coordinates",
    "category": "safeguarding",
    "videoUrl": "/training/assets/videos/SS-D6-V011.mp4",
    "durationSeconds": 60,
    "durationLabel": "60s",
    "targetGuideSlug": "incidents-safeguarding",
    "recommendedStaffRoles": [
      "TUTOR"
    ],
    "audienceLabel": "Tutor",
    "relatedGuideSlugs": [
      "incidents-safeguarding",
      "master-attendance-to-safeguarding",
      "tutor-guide"
    ],
    "order": 1
  },
  {
    "id": "SS-D6-V012",
    "slug": "creating-a-confidential-safeguarding-record",
    "title": "Creating a Confidential Safeguarding Record",
    "description": "Creating restricted child protection incident file",
    "category": "safeguarding",
    "videoUrl": "/training/assets/videos/SS-D6-V012.mp4",
    "durationSeconds": 60,
    "durationLabel": "60s",
    "targetGuideSlug": "incidents-safeguarding",
    "recommendedStaffRoles": [
      "MANAGER"
    ],
    "audienceLabel": "Manager / DSL",
    "relatedGuideSlugs": [
      "incidents-safeguarding",
      "manager-guide",
      "master-attendance-to-safeguarding"
    ],
    "order": 2
  },
  {
    "id": "SS-D6-V013",
    "slug": "setting-up-agreed-monthly-family-tuition-fee",
    "title": "Setting up Agreed Monthly Family Tuition Fee",
    "description": "Configuring monthly flat-rate tuition fee with sibling junction",
    "category": "finance",
    "videoUrl": "/training/assets/videos/SS-D6-V013.mp4",
    "durationSeconds": 60,
    "durationLabel": "60s",
    "targetGuideSlug": "agreed-fee-billing",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER"
    ],
    "audienceLabel": "Owner / Manager",
    "relatedGuideSlugs": [
      "agreed-fee-billing",
      "master-finance-billing-payments",
      "owner-guide"
    ],
    "order": 1
  },
  {
    "id": "SS-D6-V014",
    "slug": "executing-monthly-invoicing-batch-run",
    "title": "Executing Monthly Invoicing Batch Run",
    "description": "Running automated batch generation of monthly cycle invoices",
    "category": "finance",
    "videoUrl": "/training/assets/videos/SS-D6-V014.mp4",
    "durationSeconds": 60,
    "durationLabel": "60s",
    "targetGuideSlug": "invoices-billing",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER"
    ],
    "audienceLabel": "Owner / Manager",
    "relatedGuideSlugs": [
      "invoices-billing",
      "master-finance-billing-payments",
      "owner-first-30-minutes",
      "owner-guide"
    ],
    "order": 2
  },
  {
    "id": "SS-D6-V015",
    "slug": "recording-an-offline-cash-payment",
    "title": "Recording an Offline Cash Payment",
    "description": "Logging cash received at reception desk",
    "category": "finance",
    "videoUrl": "/training/assets/videos/SS-D6-V015.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "payments-reconciliation",
    "recommendedStaffRoles": [
      "FRONT_DESK"
    ],
    "audienceLabel": "Front Desk",
    "relatedGuideSlugs": [
      "payments-reconciliation"
    ],
    "order": 3
  },
  {
    "id": "SS-D6-V016",
    "slug": "recording-an-offline-bank-transfer-payment",
    "title": "Recording an Offline Bank Transfer Payment",
    "description": "Logging verified bank remittance against invoice",
    "category": "finance",
    "videoUrl": "/training/assets/videos/SS-D6-V016.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "payments-reconciliation",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER",
      "FRONT_DESK",
      "TUTOR"
    ],
    "audienceLabel": "Staff",
    "relatedGuideSlugs": [
      "payments-reconciliation"
    ],
    "order": 4
  },
  {
    "id": "SS-D6-V017",
    "slug": "reconciling-childcare-vouchers-and-tfc",
    "title": "Reconciling Childcare Vouchers & TFC",
    "description": "Reconciling Tax-Free Childcare voucher against pending invoice",
    "category": "finance",
    "videoUrl": "/training/assets/videos/SS-D6-V017.mp4",
    "durationSeconds": 60,
    "durationLabel": "60s",
    "targetGuideSlug": "payments-reconciliation",
    "recommendedStaffRoles": [
      "MANAGER"
    ],
    "audienceLabel": "Manager",
    "relatedGuideSlugs": [
      "master-finance-billing-payments",
      "payments-reconciliation"
    ],
    "order": 5
  },
  {
    "id": "SS-D6-V018",
    "slug": "voiding-an-incorrect-invoice",
    "title": "Voiding an Incorrect Invoice",
    "description": "Owner voiding an erroneous invoice record",
    "category": "finance",
    "videoUrl": "/training/assets/videos/SS-D6-V018.mp4",
    "durationSeconds": 60,
    "durationLabel": "60s",
    "targetGuideSlug": "invoices-billing",
    "recommendedStaffRoles": [
      "ORG_OWNER"
    ],
    "audienceLabel": "Owner",
    "relatedGuideSlugs": [
      "invoices-billing",
      "owner-guide"
    ],
    "order": 6
  },
  {
    "id": "SS-D6-V019",
    "slug": "parent-portal-billing-and-invoices-overview",
    "title": "Parent Portal Billing & Invoices Overview",
    "description": "Parent reviewing invoice history and payment status online",
    "category": "finance",
    "videoUrl": "/training/assets/videos/SS-D6-V019.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "parent-portal-guide",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER",
      "FRONT_DESK",
      "TUTOR"
    ],
    "audienceLabel": "Parent",
    "relatedGuideSlugs": [
      "parent-portal-guide"
    ],
    "order": 7
  },
  {
    "id": "SS-D6-V020",
    "slug": "creating-and-setting-up-a-new-centre-venue",
    "title": "Creating & Setting Up a New Centre Venue",
    "description": "Creating a new physical venue and setting initial capacity",
    "category": "administration",
    "videoUrl": "/training/assets/videos/SS-D6-V020.mp4",
    "durationSeconds": 60,
    "durationLabel": "60s",
    "targetGuideSlug": "centres-multi-centre",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER"
    ],
    "audienceLabel": "Owner / Manager",
    "relatedGuideSlugs": [
      "centres-multi-centre",
      "master-administration-operations"
    ],
    "order": 1
  },
  {
    "id": "SS-D6-V021",
    "slug": "managing-centre-bank-account-details",
    "title": "Managing Centre Bank Account Details",
    "description": "Owner updating venue bank details and sort code",
    "category": "administration",
    "videoUrl": "/training/assets/videos/SS-D6-V021.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "centres-multi-centre",
    "recommendedStaffRoles": [
      "ORG_OWNER"
    ],
    "audienceLabel": "Owner",
    "relatedGuideSlugs": [
      "centres-multi-centre"
    ],
    "order": 2
  },
  {
    "id": "SS-D6-V022",
    "slug": "inviting-a-new-staff-member-via-email",
    "title": "Inviting a New Staff Member via Email",
    "description": "Owner inviting staff member with role and centre selection",
    "category": "administration",
    "videoUrl": "/training/assets/videos/SS-D6-V022.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "staff-access-permissions",
    "recommendedStaffRoles": [
      "ORG_OWNER"
    ],
    "audienceLabel": "Owner",
    "relatedGuideSlugs": [
      "staff-access-permissions"
    ],
    "order": 3
  },
  {
    "id": "SS-D6-V023",
    "slug": "accepting-a-staff-email-invitation",
    "title": "Accepting a Staff Email Invitation",
    "description": "New staff member setting password and onboarding",
    "category": "getting-started",
    "videoUrl": "/training/assets/videos/SS-D6-V023.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "staff-access-permissions",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER",
      "FRONT_DESK",
      "TUTOR"
    ],
    "audienceLabel": "New Staff",
    "relatedGuideSlugs": [
      "staff-access-permissions",
      "tutor-first-day"
    ],
    "order": 3
  },
  {
    "id": "SS-D6-V024",
    "slug": "scoping-staff-access-across-specific-centres",
    "title": "Scoping Staff Access Across Specific Centres",
    "description": "Assigning and modifying staff centre memberships",
    "category": "administration",
    "videoUrl": "/training/assets/videos/SS-D6-V024.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "staff-access-permissions",
    "recommendedStaffRoles": [
      "ORG_OWNER"
    ],
    "audienceLabel": "Owner",
    "relatedGuideSlugs": [
      "master-administration-operations",
      "staff-access-permissions"
    ],
    "order": 4
  },
  {
    "id": "SS-D6-V025",
    "slug": "updating-staff-role-and-privileges",
    "title": "Updating Staff Role & Privileges",
    "description": "Promoting or demoting staff roles (e.g. Tutor to Front Desk)",
    "category": "administration",
    "videoUrl": "/training/assets/videos/SS-D6-V025.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "staff-access-permissions",
    "recommendedStaffRoles": [
      "ORG_OWNER"
    ],
    "audienceLabel": "Owner",
    "relatedGuideSlugs": [
      "staff-access-permissions"
    ],
    "order": 5
  },
  {
    "id": "SS-D6-V026",
    "slug": "safely-deactivating-a-staff-member",
    "title": "Safely Deactivating a Staff Member",
    "description": "Deactivating staff account and revoking login sessions",
    "category": "administration",
    "videoUrl": "/training/assets/videos/SS-D6-V026.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "staff-access-permissions",
    "recommendedStaffRoles": [
      "ORG_OWNER"
    ],
    "audienceLabel": "Owner",
    "relatedGuideSlugs": [
      "staff-access-permissions"
    ],
    "order": 6
  },
  {
    "id": "SS-D6-V027",
    "slug": "broadcasting-an-email-to-consented-parents",
    "title": "Broadcasting an Email to Consented Parents",
    "description": "Sending targeted broadcast to consented parents at venue",
    "category": "administration",
    "videoUrl": "/training/assets/videos/SS-D6-V027.mp4",
    "durationSeconds": 60,
    "durationLabel": "60s",
    "targetGuideSlug": "communications-notifications",
    "recommendedStaffRoles": [
      "MANAGER"
    ],
    "audienceLabel": "Manager",
    "relatedGuideSlugs": [
      "communications-notifications",
      "master-administration-operations"
    ],
    "order": 7
  },
  {
    "id": "SS-D6-V028",
    "slug": "moving-a-family-to-the-30-day-recovery-bin",
    "title": "Moving a Family to the 30-Day Recovery Bin",
    "description": "Soft-deleting a family record into quarantine",
    "category": "administration",
    "videoUrl": "/training/assets/videos/SS-D6-V028.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "parents-family-records",
    "recommendedStaffRoles": [
      "FRONT_DESK"
    ],
    "audienceLabel": "Front Desk",
    "relatedGuideSlugs": [
      "parents-family-records"
    ],
    "order": 8
  },
  {
    "id": "SS-D6-V029",
    "slug": "restoring-an-archived-family-from-bin",
    "title": "Restoring an Archived Family from Bin",
    "description": "Recovering soft-deleted parent and children back to active rosters",
    "category": "administration",
    "videoUrl": "/training/assets/videos/SS-D6-V029.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "parents-family-records",
    "recommendedStaffRoles": [
      "FRONT_DESK"
    ],
    "audienceLabel": "Front Desk",
    "relatedGuideSlugs": [
      "parents-family-records"
    ],
    "order": 9
  },
  {
    "id": "SS-D6-V030",
    "slug": "irreversible-permanent-gdpr-family-purge",
    "title": "Irreversible Permanent GDPR Family Purge",
    "description": "Owner permanently erasing quarantined record",
    "category": "administration",
    "videoUrl": "/training/assets/videos/SS-D6-V030.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "parents-family-records",
    "recommendedStaffRoles": [
      "ORG_OWNER"
    ],
    "audienceLabel": "Owner",
    "relatedGuideSlugs": [
      "master-administration-operations",
      "parents-family-records"
    ],
    "order": 10
  },
  {
    "id": "SS-D6-V031",
    "slug": "parent-magic-link-sign-in-and-portal-tour",
    "title": "Parent Magic Link Sign-In & Portal Tour",
    "description": "Parent logging into portal via magic link and navigating features",
    "category": "getting-started",
    "videoUrl": "/training/assets/videos/SS-D6-V031.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "parent-portal-guide",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER",
      "FRONT_DESK",
      "TUTOR"
    ],
    "audienceLabel": "Parent",
    "relatedGuideSlugs": [
      "parent-getting-started",
      "parent-portal-guide"
    ],
    "order": 4
  },
  {
    "id": "SS-D6-V032",
    "slug": "exporting-organisation-data-as-json",
    "title": "Exporting Organisation Data as JSON",
    "description": "Owner exporting organisation data structures to JSON file",
    "category": "administration",
    "videoUrl": "/training/assets/videos/SS-D6-V032.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "administration-settings",
    "recommendedStaffRoles": [
      "ORG_OWNER"
    ],
    "audienceLabel": "Owner",
    "relatedGuideSlugs": [
      "administration-settings"
    ],
    "order": 11
  },
  {
    "id": "SS-D6-V033",
    "slug": "adding-a-new-parent-manually",
    "title": "Adding a New Parent Manually",
    "description": "Staff manually creating parent record from back-office directory",
    "category": "core-operations",
    "videoUrl": "/training/assets/videos/SS-D6-V033.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "parents-family-records",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER",
      "FRONT_DESK",
      "TUTOR"
    ],
    "audienceLabel": "Staff",
    "relatedGuideSlugs": [
      "parents-family-records"
    ],
    "order": 9
  },
  {
    "id": "SS-D6-V034",
    "slug": "adding-a-sibling-to-an-existing-family",
    "title": "Adding a Sibling to an Existing Family",
    "description": "Adding brother or sister record to existing parent profile",
    "category": "core-operations",
    "videoUrl": "/training/assets/videos/SS-D6-V034.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "parents-family-records",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER",
      "FRONT_DESK",
      "TUTOR"
    ],
    "audienceLabel": "Staff",
    "relatedGuideSlugs": [
      "parents-family-records"
    ],
    "order": 10
  },
  {
    "id": "SS-D6-V035",
    "slug": "entering-authorised-pick-up-collector-details-during-registration",
    "title": "Entering Authorised Pick-Up Collector Details During Registration",
    "description": "Filling in trusted adult collector details on public registration",
    "category": "core-operations",
    "videoUrl": "/training/assets/videos/SS-D6-V035.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "registrations-intake",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER",
      "FRONT_DESK",
      "TUTOR"
    ],
    "audienceLabel": "Staff",
    "relatedGuideSlugs": [
      "parents-family-records",
      "registrations-intake"
    ],
    "order": 11
  },
  {
    "id": "SS-D6-V036",
    "slug": "updating-pupil-medical-and-allergy-profiles",
    "title": "Updating Pupil Medical & Allergy Profiles",
    "description": "Updating medical conditions, allergies, and emergency GP details",
    "category": "core-operations",
    "videoUrl": "/training/assets/videos/SS-D6-V036.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "children-students",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER",
      "FRONT_DESK",
      "TUTOR"
    ],
    "audienceLabel": "Staff",
    "relatedGuideSlugs": [
      "children-students"
    ],
    "order": 12
  },
  {
    "id": "SS-D6-V037",
    "slug": "logging-student-homework-and-progress-notes",
    "title": "Logging Student Homework & Progress Notes",
    "description": "Tutor entering homework feedback and subject milestones",
    "category": "core-operations",
    "videoUrl": "/training/assets/videos/SS-D6-V037.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "student-records-notes",
    "recommendedStaffRoles": [
      "TUTOR"
    ],
    "audienceLabel": "Tutor",
    "relatedGuideSlugs": [
      "student-records-notes",
      "tutor-guide"
    ],
    "order": 13
  },
  {
    "id": "SS-D6-V038",
    "slug": "rescheduling-an-existing-booking-slot",
    "title": "Rescheduling an Existing Booking Slot",
    "description": "Moving booking slot to alternate session date",
    "category": "core-operations",
    "videoUrl": "/training/assets/videos/SS-D6-V038.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "bookings-scheduling",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER",
      "FRONT_DESK",
      "TUTOR"
    ],
    "audienceLabel": "Staff",
    "relatedGuideSlugs": [
      "bookings-scheduling"
    ],
    "order": 14
  },
  {
    "id": "SS-D6-V039",
    "slug": "cancelling-a-booking-slot",
    "title": "Cancelling a Booking Slot",
    "description": "Cancelling student session and releasing venue capacity",
    "category": "core-operations",
    "videoUrl": "/training/assets/videos/SS-D6-V039.mp4",
    "durationSeconds": 30,
    "durationLabel": "30s",
    "targetGuideSlug": "bookings-scheduling",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER",
      "FRONT_DESK",
      "TUTOR"
    ],
    "audienceLabel": "Staff",
    "relatedGuideSlugs": [
      "bookings-scheduling"
    ],
    "order": 15
  },
  {
    "id": "SS-D6-V040",
    "slug": "creating-a-session-booking-for-a-family",
    "title": "Creating a Session Booking for a Family",
    "description": "Selecting family, picking child, and creating session booking",
    "category": "core-operations",
    "videoUrl": "/training/assets/videos/SS-D6-V040.mp4",
    "durationSeconds": 60,
    "durationLabel": "60s",
    "targetGuideSlug": "bookings-scheduling",
    "recommendedStaffRoles": [
      "MANAGER"
    ],
    "audienceLabel": "Manager",
    "relatedGuideSlugs": [
      "bookings-scheduling",
      "master-family-to-booking"
    ],
    "order": 16
  },
  {
    "id": "SS-D6-V041",
    "slug": "adjusting-attendance-arrival-timelogs",
    "title": "Adjusting Attendance Arrival Timelogs",
    "description": "Manager adjusting recorded check-in time for attendance accuracy",
    "category": "core-operations",
    "videoUrl": "/training/assets/videos/SS-D6-V041.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "attendance-roll-call",
    "recommendedStaffRoles": [
      "MANAGER"
    ],
    "audienceLabel": "Manager",
    "relatedGuideSlugs": [
      "attendance-roll-call"
    ],
    "order": 17
  },
  {
    "id": "SS-D6-V042",
    "slug": "exporting-daily-roll-call-attendance-csv",
    "title": "Exporting Daily Roll Call Attendance CSV",
    "description": "Exporting daily attendance register as spreadsheet file",
    "category": "core-operations",
    "videoUrl": "/training/assets/videos/SS-D6-V042.mp4",
    "durationSeconds": 30,
    "durationLabel": "30s",
    "targetGuideSlug": "attendance-roll-call",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER",
      "FRONT_DESK",
      "TUTOR"
    ],
    "audienceLabel": "Staff",
    "relatedGuideSlugs": [
      "attendance-roll-call"
    ],
    "order": 18
  },
  {
    "id": "SS-D6-V043",
    "slug": "exporting-finance-and-invoicing-csv",
    "title": "Exporting Finance & Invoicing CSV",
    "description": "Exporting invoice summary and payment ledger to CSV",
    "category": "finance",
    "videoUrl": "/training/assets/videos/SS-D6-V043.mp4",
    "durationSeconds": 30,
    "durationLabel": "30s",
    "targetGuideSlug": "finance-overview",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER"
    ],
    "audienceLabel": "Owner / Manager",
    "relatedGuideSlugs": [
      "finance-overview"
    ],
    "order": 8
  },
  {
    "id": "SS-D6-V044",
    "slug": "editing-invoice-issue-date-and-notes",
    "title": "Editing Invoice Issue Date & Notes",
    "description": "Updating invoice issue date and attaching custom billing notes",
    "category": "finance",
    "videoUrl": "/training/assets/videos/SS-D6-V044.mp4",
    "durationSeconds": 30,
    "durationLabel": "30s",
    "targetGuideSlug": "invoices-billing",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER",
      "FRONT_DESK",
      "TUTOR"
    ],
    "audienceLabel": "Staff",
    "relatedGuideSlugs": [
      "invoices-billing"
    ],
    "order": 9
  },
  {
    "id": "SS-D6-V045",
    "slug": "handling-duplicate-childcare-voucher-reconciliation",
    "title": "Handling Duplicate Childcare Voucher Reconciliation",
    "description": "Handling voucher rejection when duplicate reference submitted",
    "category": "finance",
    "videoUrl": "/training/assets/videos/SS-D6-V045.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "payments-reconciliation",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER",
      "FRONT_DESK",
      "TUTOR"
    ],
    "audienceLabel": "Staff",
    "relatedGuideSlugs": [
      "payments-reconciliation"
    ],
    "order": 10
  },
  {
    "id": "SS-D6-V046",
    "slug": "configuring-venue-operating-times",
    "title": "Configuring Venue Operating Times",
    "description": "Editing session slot operating hours and saving changes",
    "category": "administration",
    "videoUrl": "/training/assets/videos/SS-D6-V046.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "centres-multi-centre",
    "recommendedStaffRoles": [
      "MANAGER"
    ],
    "audienceLabel": "Manager",
    "relatedGuideSlugs": [
      "centres-multi-centre"
    ],
    "order": 12
  },
  {
    "id": "SS-D6-V047",
    "slug": "reviewing-in-app-header-notifications",
    "title": "Reviewing In-App Header Notifications",
    "description": "Opening notifications dropdown, reviewing alerts, and marking all read",
    "category": "administration",
    "videoUrl": "/training/assets/videos/SS-D6-V047.mp4",
    "durationSeconds": 30,
    "durationLabel": "30s",
    "targetGuideSlug": "communications-notifications",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER",
      "FRONT_DESK",
      "TUTOR"
    ],
    "audienceLabel": "Staff",
    "relatedGuideSlugs": [
      "communications-notifications",
      "master-system-foundations"
    ],
    "order": 13
  },
  {
    "id": "SS-D6-V048",
    "slug": "tracking-parent-email-broadcast-delivery",
    "title": "Tracking Parent Email Broadcast Delivery",
    "description": "Reviewing sent broadcast history and application dispatch numbers",
    "category": "administration",
    "videoUrl": "/training/assets/videos/SS-D6-V048.mp4",
    "durationSeconds": 30,
    "durationLabel": "30s",
    "targetGuideSlug": "communications-notifications",
    "recommendedStaffRoles": [
      "MANAGER"
    ],
    "audienceLabel": "Manager",
    "relatedGuideSlugs": [
      "communications-notifications"
    ],
    "order": 14
  },
  {
    "id": "SS-D6-V049",
    "slug": "declining-an-incomplete-registration",
    "title": "Declining an Incomplete Registration",
    "description": "Setting registration status to Declined in back-office",
    "category": "core-operations",
    "videoUrl": "/training/assets/videos/SS-D6-V049.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "registrations-intake",
    "recommendedStaffRoles": [
      "MANAGER"
    ],
    "audienceLabel": "Manager",
    "relatedGuideSlugs": [
      "registrations-intake"
    ],
    "order": 19
  },
  {
    "id": "SS-D6-V050",
    "slug": "parent-adding-a-medical-note-on-the-portal",
    "title": "Parent Adding a Medical Note on the Portal",
    "description": "Parent submitting medical update note via Parent Portal child profile",
    "category": "getting-started",
    "videoUrl": "/training/assets/videos/SS-D6-V050.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "parent-portal-guide",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER",
      "FRONT_DESK",
      "TUTOR"
    ],
    "audienceLabel": "Parent",
    "relatedGuideSlugs": [
      "parent-portal-guide"
    ],
    "order": 5
  },
  {
    "id": "SS-D6-V051",
    "slug": "handling-zero-centre-staff-assignment",
    "title": "Handling Zero-Centre Staff Assignment",
    "description": "Owner unchecking all centres to test zero-centre guard",
    "category": "administration",
    "videoUrl": "/training/assets/videos/SS-D6-V051.mp4",
    "durationSeconds": 45,
    "durationLabel": "45s",
    "targetGuideSlug": "staff-access-permissions",
    "recommendedStaffRoles": [
      "ORG_OWNER"
    ],
    "audienceLabel": "Owner",
    "relatedGuideSlugs": [
      "staff-access-permissions"
    ],
    "order": 15
  },
  {
    "id": "SS-D6-V052",
    "slug": "understanding-the-parent-portal-rate-limit-warning",
    "title": "Understanding the Parent Portal Rate-Limit Warning",
    "description": "Parent Portal displaying 429 rate-limit warning after repeated attempts",
    "category": "troubleshooting",
    "videoUrl": "/training/assets/videos/SS-D6-V052.mp4",
    "durationSeconds": 30,
    "durationLabel": "30s",
    "targetGuideSlug": "parent-portal-guide",
    "recommendedStaffRoles": [
      "ORG_OWNER",
      "MANAGER",
      "FRONT_DESK",
      "TUTOR"
    ],
    "audienceLabel": "All Roles",
    "relatedGuideSlugs": [
      "parent-portal-guide"
    ],
    "order": 1
  }
];
