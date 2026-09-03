/**
 * SprintScale CMS — Role-Based Learning Paths Manifest (Milestone PM-1F)
 * Canonical registry of all 5 role-based onboarding and continuous learning paths.
 * Composes existing approved guides (HELP_GUIDES) and certified micro-videos (HELP_VIDEOS).
 * Default-deny security: all item slugs strictly reference allowlisted content.
 */

import { HelpLearningPathMetadata } from './types';

export const HELP_LEARNING_PATHS: HelpLearningPathMetadata[] = [
  {
    id: 'lp-organisation-owner',
    slug: 'organisation-owner',
    title: 'Organisation Owner: Governance, Finance & Multi-Centre Control',
    description:
      'Essential operational roadmap for organisation owners and directors managing centre venues, staff permissions, batch invoicing, and compliance oversight.',
    persona: 'ORG_OWNER',
    audienceLabel: 'Organisation Owners & Founders',
    recommendedStaffRoles: ['ORG_OWNER'],
    isStaffReferenceOnly: false,
    order: 1,
    sections: [
      {
        id: 'owner-start-here',
        title: 'Start Here & Organisation Setup',
        description: 'First 30 minutes orientation, venue creation, and bank details.',
        items: [
          {
            type: 'guide',
            slug: 'owner-first-30-minutes',
            note: 'Essential orientation for club founders and owners setting up venues, staff, and billing.',
          },
          {
            type: 'guide',
            slug: 'owner-guide',
            note: 'Comprehensive governance handbook covering legal entity oversight and policy controls.',
          },
          {
            type: 'video',
            slug: 'creating-and-setting-up-a-new-centre-venue',
            note: 'Click-by-click walkthrough creating a new operating centre venue and rooms.',
          },
          {
            type: 'video',
            slug: 'managing-centre-bank-account-details',
            note: 'Configuring payout credentials and operating bank account details.',
          },
        ],
      },
      {
        id: 'owner-staffing-access',
        title: 'Staff Access & Multi-Centre Oversight',
        description: 'Inviting team members, centre scoping, and privilege management.',
        items: [
          {
            type: 'guide',
            slug: 'centres-multi-centre',
            note: 'Managing multi-site clubs with isolated data boundaries and shared reporting.',
          },
          {
            type: 'guide',
            slug: 'staff-access-permissions',
            note: 'RBAC hierarchy, centre assignment, and access revocation principles.',
          },
          {
            type: 'video',
            slug: 'inviting-a-new-staff-member-via-email',
            note: 'Dispatching secure email invitations to new team members.',
          },
          {
            type: 'video',
            slug: 'scoping-staff-access-across-specific-centres',
            note: 'Restricting staff visibility to assigned centre sites only.',
          },
          {
            type: 'video',
            slug: 'updating-staff-role-and-privileges',
            note: 'Promoting or demoting staff roles across Owner, Manager, Front Desk, and Tutor.',
          },
          {
            type: 'video',
            slug: 'safely-deactivating-a-staff-member',
            note: 'Immediate access revocation without historical audit disruption.',
          },
        ],
      },
      {
        id: 'owner-finance-billing',
        title: 'Financial Architecture & Billing Integrity',
        description: 'Invoicing batches, agreed-fee plans, payment reconciliation, and audit integrity.',
        items: [
          {
            type: 'guide',
            slug: 'finance-overview',
            note: 'Overview of revenue tracking, outstanding balances, and VAT exemption.',
          },
          {
            type: 'guide',
            slug: 'invoices-billing',
            note: 'Monthly invoicing cycles, draft reviews, and automated parent dispatch.',
          },
          {
            type: 'guide',
            slug: 'agreed-fee-billing',
            note: 'Configuring fixed monthly tuition fees across term schedules.',
          },
          {
            type: 'guide',
            slug: 'payments-reconciliation',
            note: 'Auditing verified payments and matching bank records.',
          },
          {
            type: 'video',
            slug: 'setting-up-agreed-monthly-family-tuition-fee',
            note: 'Establishing custom agreed monthly fee structures for multi-child families.',
          },
          {
            type: 'video',
            slug: 'executing-monthly-invoicing-batch-run',
            note: 'Generating and dispatching monthly billing invoices in a single batch.',
          },
          {
            type: 'video',
            slug: 'voiding-an-incorrect-invoice',
            note: 'Owner-only permission: safely cancelling an erroneous invoice with reason audit.',
          },
          {
            type: 'video',
            slug: 'exporting-finance-and-invoicing-csv',
            note: 'Exporting raw billing and revenue ledger data for accountant reconciliation.',
          },
        ],
      },
      {
        id: 'owner-compliance-retention',
        title: 'Compliance, Retention & Academic Rollover',
        description: 'Year-end promotion, data export, and GDPR lifecycle controls.',
        items: [
          {
            type: 'guide',
            slug: 'academic-year-data-maintenance',
            note: 'Annual rollover checklists and student year group progression.',
          },
          {
            type: 'guide',
            slug: 'administration-settings',
            note: 'Configuring terms, booking rules, and organisation branding.',
          },
          {
            type: 'video',
            slug: 'exporting-organisation-data-as-json',
            note: 'Extracting partial organisation records in structured JSON format.',
          },
          {
            type: 'video',
            slug: 'moving-a-family-to-the-30-day-recovery-bin',
            note: 'Soft-deleting archived family records with 30-day grace recovery.',
          },
          {
            type: 'video',
            slug: 'irreversible-permanent-gdpr-family-purge',
            note: 'Permanent hard deletion of expired records meeting statutory retention limits.',
          },
        ],
      },
      {
        id: 'owner-continuous-handbook',
        title: 'Master System Handbooks',
        description: 'Comprehensive end-to-end continuous operational manuals.',
        items: [
          {
            type: 'guide',
            slug: 'master-system-foundations',
            note: 'Continuous Handbook Part 1: Architecture, Security, RBAC & Core Setup.',
          },
          {
            type: 'guide',
            slug: 'master-finance-billing-payments',
            note: 'Continuous Handbook Part 4: Invoicing, Agreed Fees & Financial Ledgers.',
          },
          {
            type: 'guide',
            slug: 'master-administration-operations',
            note: 'Continuous Handbook Part 5: Multi-Centre Settings, Staff & Compliance.',
          },
        ],
      },
    ],
  },
  {
    id: 'lp-centre-manager',
    slug: 'centre-manager',
    title: 'Centre Manager: Daily Operations, Triage & Supervisory Oversight',
    description:
      'Comprehensive operational handbook for centre managers supervising registration intake, daily roll call, staff-to-child ratios, and incident records.',
    persona: 'MANAGER',
    audienceLabel: 'Centre Managers & Site Supervisors',
    recommendedStaffRoles: ['MANAGER', 'ORG_OWNER'],
    isStaffReferenceOnly: false,
    order: 2,
    sections: [
      {
        id: 'manager-start-here',
        title: 'Start Here & Intake Control',
        description: 'First 30 minutes orientation, registration triage, and session control.',
        items: [
          {
            type: 'guide',
            slug: 'manager-first-30-minutes',
            note: 'Quick-start guide for centre managers supervising daily registers and staff.',
          },
          {
            type: 'guide',
            slug: 'manager-guide',
            note: 'Detailed operational manual covering session ratios, parent triage, and reporting.',
          },
          {
            type: 'video',
            slug: 'reviewing-and-approving-a-public-registration',
            note: 'Reviewing incoming registration submissions and matching existing family profiles.',
          },
          {
            type: 'video',
            slug: 'declining-an-incomplete-registration',
            note: 'Safely rejecting an invalid submission with explanatory feedback to the parent.',
          },
        ],
      },
      {
        id: 'manager-attendance-capacity',
        title: 'Daily Attendance, Capacities & Sessions',
        description: 'Supervising roll call, schedule adjustments, and room capacity limits.',
        items: [
          {
            type: 'guide',
            slug: 'attendance-roll-call',
            note: 'Supervisory register procedures, late overrides, and attendance sign-off.',
          },
          {
            type: 'guide',
            slug: 'bookings-scheduling',
            note: 'Session capacity controls, recurring term slots, and booking amendments.',
          },
          {
            type: 'video',
            slug: 'marking-morning-and-afternoon-class-register',
            note: 'Real-time register completion across morning and afternoon club cohorts.',
          },
          {
            type: 'video',
            slug: 'overriding-attendance-status-late-excused',
            note: 'Correcting register status with audit timestamps and reason codes.',
          },
          {
            type: 'video',
            slug: 'creating-a-session-booking-for-a-family',
            note: 'Booking a child into an available session slot with instant capacity check.',
          },
          {
            type: 'video',
            slug: 'rescheduling-an-existing-booking-slot',
            note: 'Moving a confirmed booking to an alternate date or time window.',
          },
          {
            type: 'video',
            slug: 'cancelling-a-booking-slot',
            note: 'Cancelling a booking and releasing room capacity back to the roster.',
          },
          {
            type: 'video',
            slug: 'exporting-daily-roll-call-attendance-csv',
            note: 'Downloading daily attendance logs for external school liaison and audits.',
          },
        ],
      },
      {
        id: 'manager-safeguarding-incidents',
        title: 'Safeguarding, First Aid & Incident Logging',
        description:
          'First aid incident documentation and confidential concerns. Note: CMS role does NOT equal formal DSL appointment.',
        items: [
          {
            type: 'guide',
            slug: 'incidents-safeguarding',
            note: 'First aid incident logging, body mapping, emergency contacts, and safeguarding protocols.',
          },
          {
            type: 'video',
            slug: 'logging-a-first-aid-accident-on-body-map',
            note: 'Documenting minor injuries with interactive anatomical body map marking.',
          },
          {
            type: 'video',
            slug: 'creating-a-confidential-safeguarding-record',
            note: 'Logging sensitive safeguarding notes with confidential permission guards.',
          },
        ],
      },
      {
        id: 'manager-communication-troubleshooting',
        title: 'Parent Communication & Operational Runbooks',
        description: 'Broadcast messaging, delivery tracking, and rapid issue resolution.',
        items: [
          {
            type: 'guide',
            slug: 'communications-notifications',
            note: 'Parent broadcast dispatch guidelines and in-app alert management.',
          },
          {
            type: 'guide',
            slug: 'family-booking-troubleshooting',
            note: 'Resolution runbooks for registration matching, duplicate records, and booking conflicts.',
          },
          {
            type: 'guide',
            slug: 'attendance-safeguarding-troubleshooting',
            note: 'Handling kiosk sync delays, unrecorded departures, and incident review.',
          },
          {
            type: 'video',
            slug: 'broadcasting-an-email-to-consented-parents',
            note: 'Dispatching announcements to parents with verified consent records.',
          },
          {
            type: 'video',
            slug: 'tracking-parent-email-broadcast-delivery',
            note: 'Monitoring application dispatch counts and sent delivery statuses.',
          },
          {
            type: 'video',
            slug: 'reviewing-in-app-header-notifications',
            note: 'Actioning operational alerts directly from the dashboard navigation header.',
          },
        ],
      },
      {
        id: 'manager-continuous-handbook',
        title: 'Master Operational Handbooks',
        description: 'In-depth reference manuals for supervisory staff.',
        items: [
          {
            type: 'guide',
            slug: 'master-family-to-booking',
            note: 'Continuous Handbook Part 2: Registrations, Family Profiles & Session Scheduling.',
          },
          {
            type: 'guide',
            slug: 'master-attendance-to-safeguarding',
            note: 'Continuous Handbook Part 3: Live Register, Kiosks, First Aid & Safety Protocols.',
          },
        ],
      },
    ],
  },
  {
    id: 'lp-front-desk',
    slug: 'front-desk',
    title: 'Front Desk: Reception, Intake & Daily Administration',
    description:
      'Front-of-house procedures for parent greetings, kiosk arrival sign-in, collector verification, ad-hoc session bookings, and offline payment logging.',
    persona: 'FRONT_DESK',
    audienceLabel: 'Front Desk & Reception Administrators',
    recommendedStaffRoles: ['FRONT_DESK', 'MANAGER', 'ORG_OWNER'],
    isStaffReferenceOnly: false,
    order: 3,
    sections: [
      {
        id: 'front-desk-arrival-kiosk',
        title: 'Arrival, Pick-Up & Reception Kiosk',
        description: 'Managing greeting desk flow, tablet sign-in, and collector safety verification.',
        items: [
          {
            type: 'guide',
            slug: 'front-desk-guide',
            note: 'Front-of-house parent interactions, arrival check-in, and registration intake.',
          },
          {
            type: 'video',
            slug: 'operating-the-tablet-kiosk-sign-in-and-pick-up',
            note: 'Setting up and monitoring the contactless tablet kiosk at centre reception.',
          },
          {
            type: 'video',
            slug: 'entering-authorised-pick-up-collector-details-during-registration',
            note: 'Recording trusted adult collectors, contact numbers, and security passwords.',
          },
        ],
      },
      {
        id: 'front-desk-intake-records',
        title: 'Family Intake & Student Directory',
        description: 'Manual parent creation, sibling additions, and medical alert verification.',
        items: [
          {
            type: 'guide',
            slug: 'registrations-intake',
            note: 'Processing walk-in and paper registration forms into the live CMS database.',
          },
          {
            type: 'guide',
            slug: 'parents-family-records',
            note: 'Maintaining parent contact profiles, billing addresses, and emergency telephone numbers.',
          },
          {
            type: 'guide',
            slug: 'children-students',
            note: 'Managing pupil profiles, school year groups, and medical dietary requirements.',
          },
          {
            type: 'video',
            slug: 'adding-a-new-parent-manually',
            note: 'Creating a family account directly from the front desk admin console.',
          },
          {
            type: 'video',
            slug: 'adding-a-sibling-to-an-existing-family',
            note: 'Linking a new child profile to an established parent account with shared billing.',
          },
          {
            type: 'video',
            slug: 'updating-pupil-medical-and-allergy-profiles',
            note: 'Updating dietary restrictions, allergy classifications, and Epipen alerts.',
          },
          {
            type: 'video',
            slug: 'fast-walk-in-registration-from-daily-attendance',
            note: 'Enrolling an unannounced child directly into today’s live roll call register.',
          },
        ],
      },
      {
        id: 'front-desk-bookings-sessions',
        title: 'Ad-Hoc Bookings & Slot Adjustments',
        description: 'Single-session reservations, recurring plans, and parent change requests.',
        items: [
          {
            type: 'guide',
            slug: 'bookings-scheduling',
            note: 'Calendar management, daily session slots, and booking capacity validation.',
          },
          {
            type: 'video',
            slug: 'creating-an-ad-hoc-single-session-booking',
            note: 'Reserving a single afternoon session slot for a registered student.',
          },
          {
            type: 'video',
            slug: 'setting-up-a-recurring-term-booking-plan',
            note: 'Configuring standing weekly session plans across the entire academic term.',
          },
          {
            type: 'video',
            slug: 'rescheduling-an-existing-booking-slot',
            note: 'Moving a session date per parent telephone or in-person request.',
          },
        ],
      },
      {
        id: 'front-desk-payments-vouchers',
        title: 'Front-of-House Payments & Childcare Vouchers',
        description: 'Logging cash, bank transfers, and Tax-Free Childcare voucher settlements.',
        items: [
          {
            type: 'guide',
            slug: 'payments-reconciliation',
            note: 'Front-desk payment recording rules: only verified payments reduce invoice balances.',
          },
          {
            type: 'video',
            slug: 'recording-an-offline-cash-payment',
            note: 'Logging an in-person cash payment against a pending invoice with instant receipt delivery.',
          },
          {
            type: 'video',
            slug: 'recording-an-offline-bank-transfer-payment',
            note: 'Matching a verified bank transfer reference against an outstanding family balance.',
          },
          {
            type: 'video',
            slug: 'reconciling-childcare-vouchers-and-tfc',
            note: 'Applying Tax-Free Childcare (TFC) and employer voucher references to invoices.',
          },
          {
            type: 'video',
            slug: 'handling-duplicate-childcare-voucher-reconciliation',
            note: 'Resolving duplicate voucher submissions while preventing double-credit allocations.',
          },
        ],
      },
      {
        id: 'front-desk-troubleshooting',
        title: 'Parent Assistance & Runbooks',
        description: 'Assisting families with portal logins and resolving booking questions.',
        items: [
          {
            type: 'guide',
            slug: 'family-booking-troubleshooting',
            note: 'Runbook for common parent portal questions, booking errors, and capacity limits.',
          },
          {
            type: 'video',
            slug: 'parent-magic-link-sign-in-and-portal-tour',
            note: 'Understanding the parent magic link login flow to assist families by telephone.',
          },
        ],
      },
    ],
  },
  {
    id: 'lp-tutor-club-leader',
    slug: 'tutor-club-leader',
    title: 'Tutor & Club Leader: Session Delivery, Attendance & Welfare',
    description:
      'Focused operational guidance for classroom tutors and activity leaders conducting roll call, monitoring medical alerts, logging incidents, and recording notes.',
    persona: 'TUTOR',
    audienceLabel: 'Tutors, Coaches & Activity Leaders',
    recommendedStaffRoles: ['TUTOR'],
    isStaffReferenceOnly: false,
    order: 4,
    sections: [
      {
        id: 'tutor-orientation-roll-call',
        title: 'First Day Orientation & Roll Call',
        description: 'Classroom setup, live register marking, and arrival/departure timestamps.',
        items: [
          {
            type: 'guide',
            slug: 'tutor-first-day',
            note: 'Session roll call, medical badge recognition, incident logging, and kiosk operation.',
          },
          {
            type: 'guide',
            slug: 'tutor-guide',
            note: 'Classroom roll call, student medical badges, behaviour notes, and safety protocols.',
          },
          {
            type: 'video',
            slug: 'marking-morning-and-afternoon-class-register',
            note: 'Marking Present, Absent, and Late attendance statuses on mobile/tablet devices.',
          },
          {
            type: 'video',
            slug: 'overriding-attendance-status-late-excused',
            note: 'Updating an attendance entry with arrival timestamps when a pupil joins late.',
          },
          {
            type: 'video',
            slug: 'adjusting-attendance-arrival-timelogs',
            note: 'Refining exact arrival and departure time stamps for accurate duty of care records.',
          },
        ],
      },
      {
        id: 'tutor-medical-first-aid',
        title: 'Pupil Welfare, Medical Alerts & First Aid',
        description: 'Recognising allergy badges, emergency contacts, and minor injury logging.',
        items: [
          {
            type: 'guide',
            slug: 'attendance-roll-call',
            note: 'Quick visual identification of allergy alerts and medical badges on the live register.',
          },
          {
            type: 'guide',
            slug: 'student-records-notes',
            note: 'Reviewing dietary restrictions, emergency contacts, and collection permissions.',
          },
          {
            type: 'guide',
            slug: 'incidents-safeguarding',
            note: 'First aid incident logging protocol and immediate notification procedure.',
          },
          {
            type: 'video',
            slug: 'logging-a-first-aid-accident-on-body-map',
            note: 'Marking minor playground bumps and scrapes on the interactive body map.',
          },
          {
            type: 'video',
            slug: 'updating-pupil-medical-and-allergy-profiles',
            note: 'Verifying that medical conditions, inhalers, and Epipens are noted on the profile.',
          },
        ],
      },
      {
        id: 'tutor-progress-notes',
        title: 'Pupil Notes & Session Engagement',
        description: 'Recording academic progress, homework completion, and positive feedback.',
        items: [
          {
            type: 'guide',
            slug: 'children-students',
            note: 'Viewing pupil details, tutor notes history, and parent collection notes.',
          },
          {
            type: 'video',
            slug: 'logging-student-homework-and-progress-notes',
            note: 'Adding timestamped activity and engagement notes to a student record.',
          },
        ],
      },
      {
        id: 'tutor-troubleshooting',
        title: 'Session Support Runbook',
        description: 'Handling unlisted children, kiosk offline mode, and register disputes.',
        items: [
          {
            type: 'guide',
            slug: 'attendance-safeguarding-troubleshooting',
            note: 'Immediate runbook for missing pupil reconciliation and unrecorded departures.',
          },
        ],
      },
    ],
  },
  {
    id: 'lp-parent-portal',
    slug: 'parent-portal',
    title: 'Parent Portal: Staff Reference & Family Assistance',
    description:
      'Staff reference guide detailing the self-service Parent Portal workflows, online booking submission, fee review, and magic link authentication to support parents effectively.',
    persona: 'PARENT',
    audienceLabel: 'Staff Reference for Parent Support',
    recommendedStaffRoles: ['FRONT_DESK', 'MANAGER', 'ORG_OWNER'],
    isStaffReferenceOnly: true,
    order: 5,
    sections: [
      {
        id: 'parent-onboarding-login',
        title: 'Parent Onboarding & Magic Link Sign-In',
        description: 'Understanding how parents register online and authenticate securely.',
        items: [
          {
            type: 'guide',
            slug: 'parent-getting-started',
            note: 'Overview of parent self-service for registration, session bookings, and invoice review.',
          },
          {
            type: 'guide',
            slug: 'parent-portal-guide',
            note: 'Step-by-step parent manual for managing children, bookings, and payments.',
          },
          {
            type: 'video',
            slug: 'registering-a-multi-child-family-via-public-portal',
            note: 'Walkthrough of the public multi-child registration submission from parent perspective.',
          },
          {
            type: 'video',
            slug: 'parent-magic-link-sign-in-and-portal-tour',
            note: 'Understanding the passwordless magic link email authentication flow.',
          },
        ],
      },
      {
        id: 'parent-bookings-medical',
        title: 'Parent Bookings & Child Profiles',
        description: 'How families book sessions, request changes, and submit medical details.',
        items: [
          {
            type: 'video',
            slug: 'booking-a-session-via-parent-portal',
            note: 'Demonstrating the parent self-service booking calendar and slot selection.',
          },
          {
            type: 'video',
            slug: 'parent-adding-a-medical-note-on-the-portal',
            note: 'How parents submit updated allergy or medication notes from home.',
          },
        ],
      },
      {
        id: 'parent-billing-vouchers',
        title: 'Statements, Invoices & Vouchers',
        description: 'Helping parents view invoices, statements, and payment status.',
        items: [
          {
            type: 'video',
            slug: 'parent-portal-billing-and-invoices-overview',
            note: 'Understanding the parent billing tab, statement view, and invoice breakdown.',
          },
        ],
      },
      {
        id: 'parent-troubleshooting',
        title: 'Family Troubleshooting Reference',
        description: 'Troubleshooting common parent portal errors and rate-limit warnings.',
        items: [
          {
            type: 'guide',
            slug: 'family-booking-troubleshooting',
            note: 'Resolving parent portal login issues, expired magic links, and missing bookings.',
          },
          {
            type: 'video',
            slug: 'understanding-the-parent-portal-rate-limit-warning',
            note: 'Explaining security rate-limit protection warnings when parents make rapid attempts.',
          },
        ],
      },
    ],
  },
];
