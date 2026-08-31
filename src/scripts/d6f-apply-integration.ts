/**
 * SprintScale CMS — Milestone D6F Integration Applier
 * Accurately updates functional manuals, role guides, quick starts, and master manuals.
 */

import fs from 'fs';
import path from 'path';

const DOCS_DIR = path.resolve('project-notes/documentation-training');

function updateDocument(relPath: string, updater: (content: string) => string) {
  const fullPath = path.join(DOCS_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`Missing document: ${fullPath}`);
    return;
  }
  const original = fs.readFileSync(fullPath, 'utf-8');
  const updated = updater(original);
  if (original !== updated) {
    fs.writeFileSync(fullPath, updated, 'utf-8');
    console.log(`[UPDATED] ${relPath}`);
  } else {
    console.log(`[UNCHANGED] ${relPath}`);
  }
}

export function runAllIntegrations() {
  console.log('[INTEGRATION] Applying visual integrations across documentation tree...');

  // -------------------------------------------------------------
  // 1. functional-manuals/parents.md
  // -------------------------------------------------------------
  updateDocument('functional-manuals/parents.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S002.png')) {
      res = res.replace(
        '### Procedure: Finding and Opening a Parent Record',
        '### Procedure: Finding and Opening a Parent Record\n\n' +
        '![Figure — Parent Directory Roster showing parent contact status and linked children](../assets/screenshots/annotated/SS-D6-S002.png)\n' +
        '*Figure 2.1 — Parent Directory Roster*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Adding a New Parent Manually](../assets/videos/SS-D6-V033.mp4)'
      );
    }
    if (!res.includes('SS-D6-S003.png')) {
      res = res.replace(
        'The complete parent record opens, displaying contact information, linked sibling cards, recent registrations, and family billing summaries.',
        'The complete parent record opens, displaying contact information, linked sibling cards, recent registrations, and family billing summaries.\n\n' +
        '![Figure — Parent Profile & Emergency Contact Cards with contact hierarchy](../assets/screenshots/annotated/SS-D6-S003.png)\n' +
        '*Figure 2.2 — Parent Profile & Emergency Contact Cards*\n\n' +
        '![Figure — Multi-Child Family Sibling Linkage View on parent profile](../assets/screenshots/annotated/SS-D6-S065.png)\n' +
        '*Figure 2.3 — Multi-Child Family Sibling Linkage View*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Adding a Sibling to an Existing Family](../assets/videos/SS-D6-V034.mp4)'
      );
    }
    if (!res.includes('SS-D6-S004.png')) {
      res = res.replace(
        '## 6. Editing Parent Details & Communications Consent',
        '## 6. Authorised Pick-Up Collector Protocols\n\n' +
        '![Figure — Authorised Collector Details captured during registration review](../assets/screenshots/annotated/SS-D6-S004.png)\n' +
        '*Figure 2.4 — Authorised Collector Details*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Entering Authorised Pick-Up Collector Details During Registration](../assets/videos/SS-D6-V035.mp4)\n\n' +
        '## 7. Editing Parent Details & Communications Consent'
      );
    }
    if (!res.includes('SS-D6-S045.png')) {
      res = res.replace(
        '## 7. Moving a Family to the Recovery Bin (Soft-Deletion)',
        '## 8. Recovery Bin, Soft-Deletion & 30-Day Retention\n\n' +
        '![Figure — Soft-Delete Confirmation Dialog with 30-day grace period notice](../assets/screenshots/annotated/SS-D6-S061.png)\n' +
        '*Figure 2.5 — Soft-Delete Confirmation Dialog*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Moving a Family to the 30-Day Recovery Bin](../assets/videos/SS-D6-V028.mp4)\n\n' +
        '![Figure — Recovery Bin Roster showing archived records and days remaining](../assets/screenshots/annotated/SS-D6-S045.png)\n' +
        '*Figure 2.6 — Recovery Bin Soft-Deleted Families List*\n\n' +
        '![Figure — Recovery Bin Family Record Restore Modal](../assets/screenshots/annotated/SS-D6-S060.png)\n' +
        '*Figure 2.7 — Recovery Bin Family Record Restore Modal*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Restoring an Archived Family from Bin](../assets/videos/SS-D6-V029.mp4)\n\n' +
        '![Figure — Permanent GDPR Purge Owner-Only Warning Modal](../assets/screenshots/annotated/SS-D6-S046.png)\n' +
        '*Figure 2.8 — Permanent GDPR Purge Owner-Only Warning Modal*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Irreversible Permanent GDPR Family Purge](../assets/videos/SS-D6-V030.mp4)'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 2. functional-manuals/children-students.md
  // -------------------------------------------------------------
  updateDocument('functional-manuals/children-students.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S006.png')) {
      res = res.replace(
        '## 4. Student Profile 360° Anatomy',
        '## 4. Student Profile 360° Anatomy\n\n' +
        '![Figure — Student Profile Card displaying medical conditions, allergies, and GP contact info](../assets/screenshots/annotated/SS-D6-S006.png)\n' +
        '*Figure 3.1 — Student Profile Card*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Updating Pupil Medical & Allergy Profiles](../assets/videos/SS-D6-V036.mp4)'
      );
    }
    if (!res.includes('SS-D6-S005.png')) {
      res = res.replace(
        '## 7. Managing Medical Alerts & Severe Allergies',
        '## 7. Managing Medical Alerts & Severe Allergies\n\n' +
        '![Figure — Student Directory showing high-visibility allergy and dietary warning badges](../assets/screenshots/annotated/SS-D6-S005.png)\n' +
        '*Figure 3.2 — Student Directory Allergy Badges*'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 3. functional-manuals/registrations.md
  // -------------------------------------------------------------
  updateDocument('functional-manuals/registrations.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S007.png')) {
      res = res.replace(
        '## 5. The Public Registration Journey (Parent-Facing)',
        '## 5. The Public Registration Journey (Parent-Facing)\n\n' +
        '![Figure — Public Multi-Child Registration Form with sibling tabs and emergency contact entry](../assets/screenshots/annotated/SS-D6-S007.png)\n' +
        '*Figure 4.1 — Public Multi-Child Registration Form*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Registering a Multi-Child Family via Public Portal](../assets/videos/SS-D6-V001.mp4)\n\n' +
        '![Figure — Registration Terms & Digital Signature Pad with consent checkboxes](../assets/screenshots/annotated/SS-D6-S008.png)\n' +
        '*Figure 4.2 — Terms & Signature Pad*\n\n' +
        '![Figure — Registration Submission Confirmation page with reference number](../assets/screenshots/annotated/SS-D6-S072.png)\n' +
        '*Figure 4.3 — Registration Submission Confirmation Screen*'
      );
    }
    if (!res.includes('SS-D6-S009.png')) {
      res = res.replace(
        '## 6. Reviewing & Triaging Inbound Applications',
        '## 6. Reviewing & Triaging Inbound Applications\n\n' +
        '![Figure — Registration Triage Roster showing awaiting confirmation queue](../assets/screenshots/annotated/SS-D6-S009.png)\n' +
        '*Figure 4.4 — Inbound Registration Intake Triage*'
      );
    }
    if (!res.includes('SS-D6-S010.png')) {
      res = res.replace(
        '## 7. Approving a Registration (Step-by-Step)',
        '## 7. Approving a Registration (Step-by-Step)\n\n' +
        '![Figure — Registration Approval Interface showing sibling matching and confirm action](../assets/screenshots/annotated/SS-D6-S010.png)\n' +
        '*Figure 4.5 — Registration Approval & Sibling Matching Interface*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Reviewing & Approving a Public Registration](../assets/videos/SS-D6-V002.mp4)'
      );
    }
    if (!res.includes('SS-D6-S073.png')) {
      res = res.replace(
        '## 8. Rejecting or Declining a Registration',
        '## 8. Rejecting or Declining a Registration\n\n' +
        '![Figure — Registration Status Dropdown selecting Declined status](../assets/screenshots/annotated/SS-D6-S073.png)\n' +
        '*Figure 4.6 — Registration Decline Status Selection*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Declining an Incomplete Registration](../assets/videos/SS-D6-V049.mp4)'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 4. functional-manuals/bookings.md
  // -------------------------------------------------------------
  updateDocument('functional-manuals/bookings.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S011.png')) {
      res = res.replace(
        '## 1. What the Booking System Is For',
        '## 1. What the Booking System Is For\n\n' +
        '![Figure — Weekly Booking Matrix displaying capacity utilization across session slots](../assets/screenshots/annotated/SS-D6-S011.png)\n' +
        '*Figure 5.1 — Weekly Booking Matrix & Venue Capacity Overview*\n\n' +
        '![Figure — Bookings Roster showing session times, pupil names, and status distribution](../assets/screenshots/annotated/SS-D6-S069.png)\n' +
        '*Figure 5.2 — Session Bookings & Status Distribution Roster*'
      );
    }
    if (!res.includes('SS-D6-S012.png')) {
      res = res.replace(
        '### Procedure 1: Creating a Staff Booking',
        '### Procedure 1: Creating a Staff Booking\n\n' +
        '![Figure — Ad-Hoc Booking Modal with student, date, and session slot picker](../assets/screenshots/annotated/SS-D6-S012.png)\n' +
        '*Figure 5.3 — Ad-Hoc Single Session Booking Modal*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Creating an Ad-Hoc Single Session Booking](../assets/videos/SS-D6-V003.mp4)\n\n' +
        '📹 **Video Walkthrough:** [Watch: Creating a Session Booking for a Family](../assets/videos/SS-D6-V040.mp4)\n\n' +
        '![Figure — Recurring Term Booking Plan Setup with day-of-week selection](../assets/screenshots/annotated/SS-D6-S013.png)\n' +
        '*Figure 5.4 — Recurring Term Booking Plan Setup*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Setting up a Recurring Term Booking Plan](../assets/videos/SS-D6-V004.mp4)'
      );
    }
    if (!res.includes('SS-D6-S070.png')) {
      res = res.replace(
        '### Procedure 3: Rescheduling an Existing Booking',
        '### Procedure 3: Rescheduling an Existing Booking\n\n' +
        '![Figure — Booking Reschedule Dialog with new date and session slot picker](../assets/screenshots/annotated/SS-D6-S070.png)\n' +
        '*Figure 5.5 — Booking Reschedule Dialog*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Rescheduling an Existing Booking Slot](../assets/videos/SS-D6-V038.mp4)\n\n' +
        '![Figure — Booking Cancellation Confirmation with cancellation reason logging](../assets/screenshots/annotated/SS-D6-S071.png)\n' +
        '*Figure 5.6 — Booking Cancellation Dialog*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Cancelling a Booking Slot](../assets/videos/SS-D6-V039.mp4)'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 5. functional-manuals/attendance.md
  // -------------------------------------------------------------
  updateDocument('functional-manuals/attendance.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S014.png')) {
      res = res.replace(
        '### Procedure 1: Conducting Daily Roll Call on the Register',
        '### Procedure 1: Conducting Daily Roll Call on the Register\n\n' +
        '![Figure — Daily Attendance Register with attendee roster, status badges, and timelogs](../assets/screenshots/annotated/SS-D6-S014.png)\n' +
        '*Figure 6.1 — Daily Attendance Register*\n\n' +
        '![Figure — Attendance Daily Register & Roll Call Overview](../assets/screenshots/annotated/SS-D6-S077.png)\n' +
        '*Figure 6.2 — Daily Register Header Statistics*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Marking Morning and Afternoon Class Register](../assets/videos/SS-D6-V006.mp4)\n\n' +
        '![Figure — Live Check-In Arrival Timestamp](../assets/screenshots/annotated/SS-D6-S015.png)\n' +
        '*Figure 6.3 — Live Arrival Timelog*\n\n' +
        '![Figure — Bulk Check-In Button and selection checkboxes on daily register](../assets/screenshots/annotated/SS-D6-S068.png)\n' +
        '*Figure 6.4 — Bulk Check-In Action*\n\n' +
        '![Figure — Live Check-Out Departure Timestamp](../assets/screenshots/annotated/SS-D6-S016.png)\n' +
        '*Figure 6.5 — Live Check-Out Timelog*\n\n' +
        '![Figure — Timelog Adjustment Controls allowing manager time correction](../assets/screenshots/annotated/SS-D6-S067.png)\n' +
        '*Figure 6.6 — Timelog Correction Controls*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Adjusting Attendance Arrival Timelogs](../assets/videos/SS-D6-V041.mp4)\n\n' +
        '📹 **Video Walkthrough:** [Watch: Exporting Daily Roll Call Attendance CSV](../assets/videos/SS-D6-V042.mp4)'
      );
    }
    if (!res.includes('SS-D6-S018.png')) {
      res = res.replace(
        '### Procedure 2: Operating Tablet Kiosk Mode (Fast Touch Check-In)',
        '### Procedure 2: Operating Tablet Kiosk Mode (Fast Touch Check-In)\n\n' +
        '![Figure — Tablet Kiosk Mode Landing Screen with large touch targets for check-in](../assets/screenshots/annotated/SS-D6-S018.png)\n' +
        '*Figure 6.7 — Tablet Kiosk Mode Interface*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Operating the Tablet Kiosk Sign-In & Pick-Up](../assets/videos/SS-D6-V007.mp4)'
      );
    }
    if (!res.includes('SS-D6-S017.png')) {
      res = res.replace(
        '### Procedure 3: Recording an Absence & Reason',
        '### Procedure 3: Recording an Absence & Reason\n\n' +
        '![Figure — Absence Status Override Modal with reason dropdown and notes](../assets/screenshots/annotated/SS-D6-S017.png)\n' +
        '*Figure 6.8 — Absence Reason Override Modal*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Overriding Attendance Status (Late / Excused)](../assets/videos/SS-D6-V009.mp4)'
      );
    }
    if (!res.includes('SS-D6-S019.png')) {
      res = res.replace(
        '### Procedure 4: Handling an Unscheduled Walk-In Arrival',
        '### Procedure 4: Handling an Unscheduled Walk-In Arrival\n\n' +
        '![Figure — Walk-In Pupil Fast Intake Dialog capturing emergency contact on arrival](../assets/screenshots/annotated/SS-D6-S019.png)\n' +
        '*Figure 6.9 — Kiosk Fast Walk-In Intake Dialog*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Fast Walk-In Registration from Daily Attendance](../assets/videos/SS-D6-V008.mp4)'
      );
    }
    if (!res.includes('SS-D6-S020.png')) {
      res = res.replace(
        '## 6. The Session Credit Ledger & Absence Forgiveness',
        '## 6. The Session Credit Ledger & Absence Forgiveness\n\n' +
        '![Figure — Session Credit Ledger Overview](../assets/screenshots/annotated/SS-D6-S020.png)\n' +
        '*Figure 6.10 — Session Credit Ledger Overview*\n\n' +
        '![Figure — Admin Session Forgiveness Dialog](../assets/screenshots/annotated/SS-D6-S021.png)\n' +
        '*Figure 6.11 — Admin Session Forgiveness Modal*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Forgiving an Absence on Session Credit Ledger](../assets/videos/SS-D6-V010.mp4)'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 6. functional-manuals/incidents-safeguarding.md
  // -------------------------------------------------------------
  updateDocument('functional-manuals/incidents-safeguarding.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S023.png')) {
      res = res.replace(
        '### Procedure 1: Logging a Standard First Aid Accident',
        '### Procedure 1: Logging a Standard First Aid Accident\n\n' +
        '![Figure — First Aid Incident Modal with interactive body map injury marker placement](../assets/screenshots/annotated/SS-D6-S023.png)\n' +
        '*Figure 7.1 — First Aid Accident Logging & Body Map*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Logging a First Aid Accident on Body Map](../assets/videos/SS-D6-V011.mp4)'
      );
    }
    if (!res.includes('SS-D6-S024.png')) {
      res = res.replace(
        '### Procedure 3: Recording a Restricted Safeguarding Concern',
        '### Procedure 3: Recording a Restricted Safeguarding Concern\n\n' +
        '![Figure — Confidential Safeguarding Incident Entry Form (DSL restricted)](../assets/screenshots/annotated/SS-D6-S024.png)\n' +
        '*Figure 7.2 — Confidential Safeguarding Incident Entry Form*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Creating a Confidential Safeguarding Record](../assets/videos/SS-D6-V012.mp4)'
      );
    }
    if (!res.includes('SS-D6-S025.png')) {
      res = res.replace(
        '## 3. Role-Based Software Access & Permission Boundaries',
        '## 3. Role-Based Software Access & Permission Boundaries\n\n' +
        '![Figure — Tutor Access Restriction Screen demonstrating server-enforced role boundary](../assets/screenshots/annotated/SS-D6-S025.png)\n' +
        '*Figure 7.3 — Tutor Safeguarding 403 Restriction Screen*'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 7. functional-manuals/student-records-notes.md
  // -------------------------------------------------------------
  updateDocument('functional-manuals/student-records-notes.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S022.png')) {
      res = res.replace(
        '### Procedure 1: Logging an Internal Classroom Note',
        '### Procedure 1: Logging an Internal Classroom Note\n\n' +
        '![Figure — Student Note Logging Form with category selection and timestamp](../assets/screenshots/annotated/SS-D6-S022.png)\n' +
        '*Figure 8.1 — Student Classroom Note Entry Form*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Logging Student Homework & Progress Notes](../assets/videos/SS-D6-V037.mp4)'
      );
    }
    if (!res.includes('SS-D6-S066.png')) {
      res = res.replace(
        '### Procedure 3: Creating and Sending an Assessment Scorecard',
        '### Procedure 3: Creating and Sending an Assessment Scorecard\n\n' +
        '![Figure — Student Academic Progress Card with score tracking and milestone achievements](../assets/screenshots/annotated/SS-D6-S066.png)\n' +
        '*Figure 8.2 — Student Academic Scorecard & Progress View*'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 8. functional-manuals/finance-overview.md
  // -------------------------------------------------------------
  updateDocument('functional-manuals/finance-overview.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S026.png')) {
      res = res.replace(
        '## 1. What the Finance Module Does',
        '## 1. What the Finance Module Does\n\n' +
        '![Figure — Executive Finance Dashboard showing collected fees, pending balances, and overdue totals](../assets/screenshots/annotated/SS-D6-S026.png)\n' +
        '*Figure 9.1 — Executive Finance Overview Dashboard*'
      );
    }
    if (!res.includes('SS-D6-S076.png')) {
      res = res.replace(
        '## 6. Overpayment & Correction Rules',
        '## 6. Financial Reporting & CSV Ledger Export\n\n' +
        '![Figure — Finance CSV Export Button on the main financial overview ledger](../assets/screenshots/annotated/SS-D6-S076.png)\n' +
        '*Figure 9.2 — Finance CSV Export Action*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Exporting Finance & Invoicing CSV](../assets/videos/SS-D6-V043.mp4)\n\n' +
        '## 7. Overpayment & Correction Rules'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 9. functional-manuals/agreed-fee-billing.md
  // -------------------------------------------------------------
  updateDocument('functional-manuals/agreed-fee-billing.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S027.png')) {
      res = res.replace(
        '### Procedure 1: Setting Up an Agreed Fee for a Family',
        '### Procedure 1: Setting Up an Agreed Fee for a Family\n\n' +
        '![Figure — Agreed-Fee Billing Setup Card with monthly rate, anchor day, and lead days](../assets/screenshots/annotated/SS-D6-S027.png)\n' +
        '*Figure 10.1 — Agreed-Fee Family Billing Configuration*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Setting up Agreed Monthly Family Tuition Fee](../assets/videos/SS-D6-V013.mp4)'
      );
    }
    if (!res.includes('SS-D6-S028.png')) {
      res = res.replace(
        '### Procedure 2: Adding a Sibling to an Existing Billing Agreement',
        '### Procedure 2: Adding a Sibling to an Existing Billing Agreement\n\n' +
        '![Figure — Sibling Coverage Junction checkboxes linking brothers and sisters to a single fee](../assets/screenshots/annotated/SS-D6-S028.png)\n' +
        '*Figure 10.2 — Sibling Coverage Junction Mapping*'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 10. functional-manuals/invoices.md
  // -------------------------------------------------------------
  updateDocument('functional-manuals/invoices.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S029.png')) {
      res = res.replace(
        '## 3. Duplicate Prevention & Billing Run Logging',
        '## 3. Duplicate Prevention & Billing Run Logging\n\n' +
        '![Figure — Monthly Invoice Batch Generation Run preview modal with total count and value](../assets/screenshots/annotated/SS-D6-S029.png)\n' +
        '*Figure 11.1 — Monthly Invoicing Batch Run Preview*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Executing Monthly Invoicing Batch Run](../assets/videos/SS-D6-V014.mp4)'
      );
    }
    if (!res.includes('SS-D6-S030.png')) {
      res = res.replace(
        '## 4. Invoice Status Lifecycle',
        '## 4. Invoice Status Lifecycle\n\n' +
        '![Figure — Invoices Directory showing invoice numbers, dates, recipients, amounts, and statuses](../assets/screenshots/annotated/SS-D6-S030.png)\n' +
        '*Figure 11.2 — Invoices Directory & Status Overview*\n\n' +
        '![Figure — Partially Paid Invoice Display showing balance remaining and partial status badge](../assets/screenshots/annotated/SS-D6-S035.png)\n' +
        '*Figure 11.3 — Partial Payment Invoice State*'
      );
    }
    if (!res.includes('SS-D6-S031.png')) {
      res = res.replace(
        '### Procedure 2: Viewing and Downloading an Invoice PDF',
        '### Procedure 2: Viewing and Downloading an Invoice PDF\n\n' +
        '![Figure — Detailed Invoice View showing itemised tuition charges and recorded payment audit log](../assets/screenshots/annotated/SS-D6-S031.png)\n' +
        '*Figure 11.4 — Detailed Invoice View & Payment Audit Log*'
      );
    }
    if (!res.includes('SS-D6-S063.png')) {
      res = res.replace(
        '### Procedure 3: Updating Invoice Date or Administrative Notes',
        '### Procedure 3: Updating Invoice Date or Administrative Notes\n\n' +
        '![Figure — Invoice Edit Controls for Issue Date and Custom Note fields](../assets/screenshots/annotated/SS-D6-S063.png)\n' +
        '*Figure 11.5 — Invoice Date & Notes Editing Form*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Editing Invoice Issue Date & Notes](../assets/videos/SS-D6-V044.mp4)'
      );
    }
    if (!res.includes('SS-D6-S062.png')) {
      res = res.replace(
        '### Procedure 4: Voiding an Invoice',
        '### Procedure 4: Voiding an Invoice\n\n' +
        '![Figure — Invoice Voiding Modal with mandatory reason entry (Owner only)](../assets/screenshots/annotated/SS-D6-S062.png)\n' +
        '*Figure 11.6 — Owner Invoice Voiding Confirmation Modal*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Voiding an Incorrect Invoice](../assets/videos/SS-D6-V018.mp4)'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 11. functional-manuals/payments-reconciliation.md
  // -------------------------------------------------------------
  updateDocument('functional-manuals/payments-reconciliation.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S032.png')) {
      res = res.replace(
        '### Procedure 1: Recording an Offline Payment (Cash / Bank Transfer)',
        '### Procedure 1: Recording an Offline Payment (Cash / Bank Transfer)\n\n' +
        '![Figure — Offline Cash Payment Dialog with amount and internal receipt note](../assets/screenshots/annotated/SS-D6-S032.png)\n' +
        '*Figure 12.1 — Offline Cash Payment Recording Modal*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Recording an Offline Cash Payment](../assets/videos/SS-D6-V015.mp4)\n\n' +
        '![Figure — Bank Transfer Recording Modal with transaction reference field](../assets/screenshots/annotated/SS-D6-S033.png)\n' +
        '*Figure 12.2 — Offline Bank Transfer Recording Modal*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Recording an Offline Bank Transfer Payment](../assets/videos/SS-D6-V016.mp4)'
      );
    }
    if (!res.includes('SS-D6-S034.png')) {
      res = res.replace(
        '### Procedure 3: Reconciling & Verifying a Voucher / TFC Payment',
        '### Procedure 3: Reconciling & Verifying a Voucher / TFC Payment\n\n' +
        '![Figure — Voucher Reconciliation Queue showing pending vouchers against matching invoices](../assets/screenshots/annotated/SS-D6-S034.png)\n' +
        '*Figure 12.3 — Childcare Voucher & TFC Reconciliation Queue*\n\n' +
        '![Figure — Childcare Voucher Reconciliation Form with provider reference input](../assets/screenshots/annotated/SS-D6-S064.png)\n' +
        '*Figure 12.4 — Childcare Voucher Reconciliation Form*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Reconciling Childcare Vouchers & TFC](../assets/videos/SS-D6-V017.mp4)'
      );
    }
    if (!res.includes('SS-D6-V045.mp4')) {
      res = res.replace(
        '### Procedure 4: Rejecting / Failing an Invalid Voucher Claim',
        '### Procedure 4: Rejecting / Failing an Invalid Voucher Claim\n\n' +
        '📹 **Video Walkthrough:** [Watch: Handling Duplicate Childcare Voucher Reconciliation](../assets/videos/SS-D6-V045.mp4)'
      );
    }
    if (!res.includes('SS-D6-S036.png')) {
      res = res.replace(
        '### Procedure 5: Generating and Printing a Payment Receipt PDF',
        '### Procedure 5: Generating and Printing a Payment Receipt PDF\n\n' +
        '![Figure — Official Payment Receipt PDF layout with organisation branding and payment details](../assets/screenshots/annotated/SS-D6-S036.png)\n' +
        '*Figure 12.5 — Payment Confirmation PDF Receipt*'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 12. functional-manuals/centres-multi-centre.md
  // -------------------------------------------------------------
  updateDocument('functional-manuals/centres-multi-centre.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S037.png')) {
      res = res.replace(
        '### Procedure 1: Creating a New Centre / Venue',
        '### Procedure 1: Creating a New Centre / Venue\n\n' +
        '![Figure — Multi-Centre Directory displaying active venue locations, addresses, and capacity](../assets/screenshots/annotated/SS-D6-S037.png)\n' +
        '*Figure 13.1 — Multi-Centre Directory*\n\n' +
        '![Figure — New Centre Creation Modal with venue name, slug, and initial capacity](../assets/screenshots/annotated/SS-D6-S057.png)\n' +
        '*Figure 13.2 — New Centre Venue Creation Modal*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Creating & Setting Up a New Centre Venue](../assets/videos/SS-D6-V020.mp4)'
      );
    }
    if (!res.includes('SS-D6-S038.png')) {
      res = res.replace(
        '### Procedure 2: Configuring Centre Settings & Session Slots',
        '### Procedure 2: Configuring Centre Settings & Session Slots\n\n' +
        '![Figure — Centre General Settings Form with capacity limits and Ofsted registration field](../assets/screenshots/annotated/SS-D6-S038.png)\n' +
        '*Figure 13.3 — Centre General Settings & Capacity*\n\n' +
        '![Figure — Venue Operating Times Configuration Card with session slot start and end times](../assets/screenshots/annotated/SS-D6-S056.png)\n' +
        '*Figure 13.4 — Venue Operating Times Configuration Card*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Configuring Venue Operating Times](../assets/videos/SS-D6-V046.mp4)'
      );
    }
    if (!res.includes('SS-D6-S039.png')) {
      res = res.replace(
        '### Procedure 3: Configuring Centre Bank & Billing Details',
        '### Procedure 3: Configuring Centre Bank & Billing Details\n\n' +
        '![Figure — Centre Bank Details Card (restricted to Organisation Owner role)](../assets/screenshots/annotated/SS-D6-S039.png)\n' +
        '*Figure 13.5 — Centre Bank Details Card (Owner-Only)*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Managing Centre Bank Account Details](../assets/videos/SS-D6-V021.mp4)'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 13. functional-manuals/staff-access-permissions.md
  // -------------------------------------------------------------
  updateDocument('functional-manuals/staff-access-permissions.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S040.png')) {
      res = res.replace(
        '## 1. What Staff Management Is',
        '## 1. What Staff Management Is\n\n' +
        '![Figure — Staff Directory showing user names, email addresses, and role badges](../assets/screenshots/annotated/SS-D6-S040.png)\n' +
        '*Figure 14.1 — Staff Directory Roster*'
      );
    }
    if (!res.includes('SS-D6-S041.png')) {
      res = res.replace(
        '### Procedure 1: Inviting a New Staff Member',
        '### Procedure 1: Inviting a New Staff Member\n\n' +
        '![Figure — Staff Invitation Modal with role selector (Manager, Front Desk, Tutor)](../assets/screenshots/annotated/SS-D6-S041.png)\n' +
        '*Figure 14.2 — Staff Invitation Modal*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Inviting a New Staff Member via Email](../assets/videos/SS-D6-V022.mp4)\n\n' +
        '![Figure — Staff Invitation Acceptance Page with password and profile setup](../assets/screenshots/annotated/SS-D6-S052.png)\n' +
        '*Figure 14.3 — Staff Invite Acceptance Screen*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Accepting a Staff Email Invitation](../assets/videos/SS-D6-V023.mp4)'
      );
    }
    if (!res.includes('SS-D6-S042.png')) {
      res = res.replace(
        '### Procedure 2: Assigning Centres to an Existing Staff Member',
        '### Procedure 2: Assigning Centres to an Existing Staff Member\n\n' +
        '![Figure — Staff Centre Membership checkboxes assigning user access to specific venues](../assets/screenshots/annotated/SS-D6-S042.png)\n' +
        '*Figure 14.4 — Staff Centre Membership Selection Form*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Scoping Staff Access Across Specific Centres](../assets/videos/SS-D6-V024.mp4)\n\n' +
        '![Figure — Zero-Centre Assigned Staff notice informing user to contact Organisation Owner](../assets/screenshots/annotated/SS-D6-S074.png)\n' +
        '*Figure 14.5 — Zero-Centre Assigned Staff Empty State*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Handling Zero-Centre Staff Assignment](../assets/videos/SS-D6-V051.mp4)'
      );
    }
    if (!res.includes('SS-D6-S058.png')) {
      res = res.replace(
        '### Procedure 3: Changing a Staff Member\'s Role',
        '### Procedure 3: Changing a Staff Member\'s Role\n\n' +
        '![Figure — Self-Demotion Guard Dialog preventing owner from removing own administrative privileges](../assets/screenshots/annotated/SS-D6-S058.png)\n' +
        '*Figure 14.6 — Self-Demotion Guard Modal*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Updating Staff Role & Privileges](../assets/videos/SS-D6-V025.mp4)'
      );
    }
    if (!res.includes('SS-D6-S043.png')) {
      res = res.replace(
        '### Procedure 4: Removing / Deactivating a Staff Member',
        '### Procedure 4: Removing / Deactivating a Staff Member\n\n' +
        '![Figure — Staff Deactivation Warning Dialog explaining session revocation and record preservation](../assets/screenshots/annotated/SS-D6-S043.png)\n' +
        '*Figure 14.7 — Staff Deactivation Modal*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Safely Deactivating a Staff Member](../assets/videos/SS-D6-V026.mp4)'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 14. functional-manuals/communications-notifications.md
  // -------------------------------------------------------------
  updateDocument('functional-manuals/communications-notifications.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S044.png')) {
      res = res.replace(
        '### Procedure 1: Sending an Email Broadcast to Parents',
        '### Procedure 1: Sending an Email Broadcast to Parents\n\n' +
        '![Figure — Email Broadcast Composer with centre targeting and consented recipient counter](../assets/screenshots/annotated/SS-D6-S044.png)\n' +
        '*Figure 15.1 — Parent Email Broadcast Composer*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Broadcasting an Email to Consented Parents](../assets/videos/SS-D6-V027.mp4)\n\n' +
        '![Figure — Broadcast Delivery History showing sent timestamp, subject, and dispatch accounting numbers](../assets/screenshots/annotated/SS-D6-S059.png)\n' +
        '*Figure 15.2 — Broadcast Delivery Counters & History*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Tracking Parent Email Broadcast Delivery](../assets/videos/SS-D6-V048.mp4)'
      );
    }
    if (!res.includes('SS-D6-S053.png')) {
      res = res.replace(
        '### Procedure 2: Reviewing In-App Header Notifications',
        '### Procedure 2: Reviewing In-App Header Notifications\n\n' +
        '![Figure — Header Notification Dropdown displaying unread intake and booking alerts](../assets/screenshots/annotated/SS-D6-S053.png)\n' +
        '*Figure 15.3 — In-App Header Notifications Dropdown*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Reviewing In-App Header Notifications](../assets/videos/SS-D6-V047.mp4)'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 15. functional-manuals/administration-settings.md
  // -------------------------------------------------------------
  updateDocument('functional-manuals/administration-settings.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S054.png')) {
      res = res.replace(
        '### Procedure 1: Viewing Organisation Information',
        '### Procedure 1: Viewing Organisation Information\n\n' +
        '![Figure — Organisation Profile Form with branding logo and contact email](../assets/screenshots/annotated/SS-D6-S054.png)\n' +
        '*Figure 16.1 — Organisation Profile & Branding Form*'
      );
    }
    if (!res.includes('SS-D6-S055.png')) {
      res = res.replace(
        '### Procedure 2: Exporting Organisation Data for GDPR / SAR Requests',
        '### Procedure 2: Exporting Organisation Data for GDPR / SAR Requests\n\n' +
        '![Figure — Organisation Data JSON Export Action in system settings](../assets/screenshots/annotated/SS-D6-S055.png)\n' +
        '*Figure 16.2 — GDPR Organisation JSON Export Action*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Exporting Organisation Data as JSON](../assets/videos/SS-D6-V032.mp4)'
      );
    }
    if (!res.includes('SS-D6-S078.png')) {
      res = res.replace(
        '## 4. Integration Settings & Service Classifications',
        '## 4. Integration Settings & Service Classifications\n\n' +
        '![Figure — External Integrations Card showing school sync status and last connection time](../assets/screenshots/annotated/SS-D6-S078.png)\n' +
        '*Figure 16.3 — External Integration Statuses Card*'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 16. quick-start/owner-first-30-minutes.md
  // -------------------------------------------------------------
  updateDocument('quick-start/owner-first-30-minutes.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S001.png')) {
      res = res.replace(
        '### Step 6: Review Dashboard KPIs (Minutes 25–30)',
        '### Step 6: Review Dashboard KPIs (Minutes 25–30)\n\n' +
        '![Figure — Dashboard Home & Navigation Overview showing key operational metrics and sidebar modules](../assets/screenshots/annotated/SS-D6-S001.png)\n' +
        '*Figure QS-O.1 — Owner Dashboard Overview*\n\n' +
        '![Figure — Executive Finance Dashboard showing collected fees, pending balances, and overdue totals](../assets/screenshots/annotated/SS-D6-S026.png)\n' +
        '*Figure QS-O.2 — Executive Finance Overview*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Executing Monthly Invoicing Batch Run](../assets/videos/SS-D6-V014.mp4)'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 17. quick-start/manager-first-30-minutes.md
  // -------------------------------------------------------------
  updateDocument('quick-start/manager-first-30-minutes.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S009.png')) {
      res = res.replace(
        '### Step 4: Triage Inbound Registrations Queue (Minutes 15–20)',
        '### Step 4: Triage Inbound Registrations Queue (Minutes 15–20)\n\n' +
        '![Figure — Registration Triage Roster showing awaiting confirmation queue](../assets/screenshots/annotated/SS-D6-S009.png)\n' +
        '*Figure QS-M.1 — Inbound Registration Intake Triage*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Reviewing & Approving a Public Registration](../assets/videos/SS-D6-V002.mp4)'
      );
    }
    if (!res.includes('SS-D6-S014.png')) {
      res = res.replace(
        '### Step 5: Verify Attendance Register & Today\'s Schedule (Minutes 20–25)',
        '### Step 5: Verify Attendance Register & Today\'s Schedule (Minutes 20–25)\n\n' +
        '![Figure — Daily Attendance Register with attendee roster, status badges, and timelogs](../assets/screenshots/annotated/SS-D6-S014.png)\n' +
        '*Figure QS-M.2 — Daily Attendance Register*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Marking Morning and Afternoon Class Register](../assets/videos/SS-D6-V006.mp4)'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 18. quick-start/tutor-first-day.md
  // -------------------------------------------------------------
  updateDocument('quick-start/tutor-first-day.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S052.png')) {
      res = res.replace(
        '### Step 1: Sign In to SprintScale CMS',
        '### Step 1: Sign In to SprintScale CMS\n\n' +
        '![Figure — Staff Invitation Acceptance Page with password and profile setup](../assets/screenshots/annotated/SS-D6-S052.png)\n' +
        '*Figure QS-T.1 — Staff Invitation Acceptance Screen*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Accepting a Staff Email Invitation](../assets/videos/SS-D6-V023.mp4)'
      );
    }
    if (!res.includes('SS-D6-S014.png')) {
      res = res.replace(
        '### Step 3: Open the Live Attendance Register',
        '### Step 3: Open the Live Attendance Register\n\n' +
        '![Figure — Daily Attendance Register with attendee roster, status badges, and timelogs](../assets/screenshots/annotated/SS-D6-S014.png)\n' +
        '*Figure QS-T.2 — Daily Attendance Register*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Marking Morning and Afternoon Class Register](../assets/videos/SS-D6-V006.mp4)'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 19. quick-start/parent-getting-started.md
  // -------------------------------------------------------------
  updateDocument('quick-start/parent-getting-started.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S050.png')) {
      res = res.replace(
        '### Step 1: Request Your Secure Sign-In Link',
        '### Step 1: Request Your Secure Sign-In Link\n\n' +
        '![Figure — Passwordless Magic Link Login prompt on Parent Portal](../assets/screenshots/annotated/SS-D6-S050.png)\n' +
        '*Figure QS-P.1 — Passwordless Sign-In Link Request*\n\n' +
        '![Figure — Parent Portal Dashboard showing children profiles, next booked sessions, and billing summary](../assets/screenshots/annotated/SS-D6-S047.png)\n' +
        '*Figure QS-P.2 — Parent Portal Home View*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Parent Magic Link Sign-In & Portal Tour](../assets/videos/SS-D6-V031.mp4)'
      );
    }
    if (!res.includes('SS-D6-V005.mp4')) {
      res = res.replace(
        '### Step 4: Book Sessions or Pay Invoices',
        '### Step 4: Book Sessions or Pay Invoices\n\n' +
        '📹 **Video Walkthrough:** [Watch: Booking a Session via Parent Portal](../assets/videos/SS-D6-V005.mp4)'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 20. master-manual/01-system-foundations.md
  // -------------------------------------------------------------
  updateDocument('master-manual/01-system-foundations.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S001.png')) {
      res = res.replace(
        '## 1. What SprintScale CMS Is',
        '## 1. What SprintScale CMS Is\n\n' +
        '![Figure — Dashboard Home & Navigation Overview showing key operational metrics and sidebar modules](../assets/screenshots/annotated/SS-D6-S001.png)\n' +
        '*Figure MM-1.1 — Global Dashboard Interface*\n\n' +
        '![Figure — Header Notification Dropdown displaying unread intake and booking alerts](../assets/screenshots/annotated/SS-D6-S053.png)\n' +
        '*Figure MM-1.2 — In-App Header Alerts Dropdown*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Reviewing In-App Header Notifications](../assets/videos/SS-D6-V047.mp4)'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 21. master-manual/02-family-to-booking-journey.md
  // -------------------------------------------------------------
  updateDocument('master-manual/02-family-to-booking-journey.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S007.png')) {
      res = res.replace(
        '## 2. Stage 1: Public Intake & Data Capture',
        '## 2. Stage 1: Public Intake & Data Capture\n\n' +
        '![Figure — Public Multi-Child Registration Form with sibling tabs and emergency contact entry](../assets/screenshots/annotated/SS-D6-S007.png)\n' +
        '*Figure MM-2.1 — Multi-Child Registration Intake Form*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Registering a Multi-Child Family via Public Portal](../assets/videos/SS-D6-V001.mp4)'
      );
    }
    if (!res.includes('SS-D6-S010.png')) {
      res = res.replace(
        '## 4. Stage 3: Approval & Record Activation',
        '## 4. Stage 3: Approval & Record Activation\n\n' +
        '![Figure — Registration Approval Interface showing sibling matching and confirm action](../assets/screenshots/annotated/SS-D6-S010.png)\n' +
        '*Figure MM-2.2 — Registration Approval & Sibling Matching*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Reviewing & Approving a Public Registration](../assets/videos/SS-D6-V002.mp4)'
      );
    }
    if (!res.includes('SS-D6-S011.png')) {
      res = res.replace(
        '## 5. Stage 4: Scheduling & Booking Sessions',
        '## 5. Stage 4: Scheduling & Booking Sessions\n\n' +
        '![Figure — Weekly Booking Matrix displaying capacity utilization across session slots](../assets/screenshots/annotated/SS-D6-S011.png)\n' +
        '*Figure MM-2.3 — Weekly Booking Matrix & Capacity*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Creating a Session Booking for a Family](../assets/videos/SS-D6-V040.mp4)'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 22. master-manual/03-attendance-to-safeguarding-journey.md
  // -------------------------------------------------------------
  updateDocument('master-manual/03-attendance-to-safeguarding-journey.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S014.png')) {
      res = res.replace(
        '## 3. Stage 2: Physical Arrival & Check-In',
        '## 3. Stage 2: Physical Arrival & Check-In\n\n' +
        '![Figure — Daily Attendance Register with attendee roster, status badges, and timelogs](../assets/screenshots/annotated/SS-D6-S014.png)\n' +
        '*Figure MM-3.1 — Daily Attendance Register*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Marking Morning and Afternoon Class Register](../assets/videos/SS-D6-V006.mp4)'
      );
    }
    if (!res.includes('SS-D6-S023.png')) {
      res = res.replace(
        '### Pathway A: Standard First Aid & Minor Accidents',
        '### Pathway A: Standard First Aid & Minor Accidents\n\n' +
        '![Figure — First Aid Incident Modal with interactive body map injury marker placement](../assets/screenshots/annotated/SS-D6-S023.png)\n' +
        '*Figure MM-3.2 — First Aid Accident Logging & Body Map*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Logging a First Aid Accident on Body Map](../assets/videos/SS-D6-V011.mp4)'
      );
    }
    if (!res.includes('SS-D6-S024.png')) {
      res = res.replace(
        '### Pathway B: Restricted Child Safeguarding Concerns',
        '### Pathway B: Restricted Child Safeguarding Concerns\n\n' +
        '![Figure — Confidential Safeguarding Incident Entry Form (DSL restricted)](../assets/screenshots/annotated/SS-D6-S024.png)\n' +
        '*Figure MM-3.3 — Confidential Safeguarding Incident Form*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Creating a Confidential Safeguarding Record](../assets/videos/SS-D6-V012.mp4)'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 23. master-manual/04-finance-billing-payments-journey.md
  // -------------------------------------------------------------
  updateDocument('master-manual/04-finance-billing-payments-journey.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S026.png')) {
      res = res.replace(
        '## 1. Overview of the Complete Financial Journey',
        '## 1. Overview of the Complete Financial Journey\n\n' +
        '![Figure — Executive Finance Dashboard showing collected fees, pending balances, and overdue totals](../assets/screenshots/annotated/SS-D6-S026.png)\n' +
        '*Figure MM-4.1 — Executive Finance Dashboard*'
      );
    }
    if (!res.includes('SS-D6-S027.png')) {
      res = res.replace(
        '## 2. Stage 1: Family Agreed-Fee Setup',
        '## 2. Stage 1: Family Agreed-Fee Setup\n\n' +
        '![Figure — Agreed-Fee Billing Setup Card with monthly rate, anchor day, and lead days](../assets/screenshots/annotated/SS-D6-S027.png)\n' +
        '*Figure MM-4.2 — Family Agreed-Fee Billing Config*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Setting up Agreed Monthly Family Tuition Fee](../assets/videos/SS-D6-V013.mp4)'
      );
    }
    if (!res.includes('SS-D6-S029.png')) {
      res = res.replace(
        '## 3. Stage 2: Invoice Generation & Duplicate Prevention',
        '## 3. Stage 2: Invoice Generation & Duplicate Prevention\n\n' +
        '![Figure — Monthly Invoice Batch Generation Run preview modal with total count and value](../assets/screenshots/annotated/SS-D6-S029.png)\n' +
        '*Figure MM-4.3 — Monthly Invoicing Batch Run Preview*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Executing Monthly Invoicing Batch Run](../assets/videos/SS-D6-V014.mp4)'
      );
    }
    if (!res.includes('SS-D6-S034.png')) {
      res = res.replace(
        '## 5. Stage 4: Multi-Channel Payment & Reconciliation',
        '## 5. Stage 4: Multi-Channel Payment & Reconciliation\n\n' +
        '![Figure — Voucher Reconciliation Queue showing pending vouchers against matching invoices](../assets/screenshots/annotated/SS-D6-S034.png)\n' +
        '*Figure MM-4.4 — Childcare Voucher & TFC Reconciliation Queue*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Reconciling Childcare Vouchers & TFC](../assets/videos/SS-D6-V017.mp4)'
      );
    }
    return res;
  });

  // -------------------------------------------------------------
  // 24. master-manual/05-administration-and-operations.md
  // -------------------------------------------------------------
  updateDocument('master-manual/05-administration-and-operations.md', (content) => {
    let res = content;
    if (!res.includes('SS-D6-S037.png')) {
      res = res.replace(
        '## 2. Organisation vs. Centre: Core Boundary',
        '## 2. Organisation vs. Centre: Core Boundary\n\n' +
        '![Figure — Multi-Centre Directory displaying active venue locations, addresses, and capacity](../assets/screenshots/annotated/SS-D6-S037.png)\n' +
        '*Figure MM-5.1 — Multi-Centre Venue Directory*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Creating & Setting Up a New Centre Venue](../assets/videos/SS-D6-V020.mp4)'
      );
    }
    if (!res.includes('SS-D6-S040.png')) {
      res = res.replace(
        '## 3. The 4 Staff Roles & Server-Side Permission Boundaries',
        '## 3. The 4 Staff Roles & Server-Side Permission Boundaries\n\n' +
        '![Figure — Staff Directory showing user names, email addresses, and role badges](../assets/screenshots/annotated/SS-D6-S040.png)\n' +
        '*Figure MM-5.2 — Staff Directory Roster*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Scoping Staff Access Across Specific Centres](../assets/videos/SS-D6-V024.mp4)'
      );
    }
    if (!res.includes('SS-D6-S044.png')) {
      res = res.replace(
        '## 5. Communications, Consent & Broadcasts',
        '## 5. Communications, Consent & Broadcasts\n\n' +
        '![Figure — Email Broadcast Composer with centre targeting and consented recipient counter](../assets/screenshots/annotated/SS-D6-S044.png)\n' +
        '*Figure MM-5.3 — Parent Email Broadcast Composer*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Broadcasting an Email to Consented Parents](../assets/videos/SS-D6-V027.mp4)'
      );
    }
    if (!res.includes('SS-D6-S045.png')) {
      res = res.replace(
        '## 6. Academic-Year Rollover & Data Retention',
        '## 6. Academic-Year Rollover & Data Retention\n\n' +
        '![Figure — Recovery Bin Roster showing archived records and days remaining](../assets/screenshots/annotated/SS-D6-S045.png)\n' +
        '*Figure MM-5.4 — Recovery Bin Soft-Deleted Records Roster*\n\n' +
        '📹 **Video Walkthrough:** [Watch: Irreversible Permanent GDPR Family Purge](../assets/videos/SS-D6-V030.mp4)'
      );
    }
    return res;
  });

  console.log('[INTEGRATION] All document integrations applied successfully.');
}
