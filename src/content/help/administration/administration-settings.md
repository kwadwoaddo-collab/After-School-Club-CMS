# SprintScale CMS — Functional Manual: Administration & Organisation Settings
## Organisation Settings, GDPR Data Export, Integration Surfaces & System Limits

---

## 1. What Organisation Settings Cover

The **Settings Module** (`/dashboard/settings`) provides organisation-level controls for your club network.

Key Capabilities:
- Managing organisation contact details (official email, phone, registered business address).
- Reviewing integrated communication and operational service statuses.
- Generating full GDPR subject-access data exports for compliance requests.
- Viewing organisation identifier metadata and tenant scoping rules.

---

## 2. Who Can Access Organisation Settings

| Role | Access Level | Description |
|---|---|---|
| **Organisation Owner (`ORG_OWNER`)** | **FULL ACCESS** | Can view/edit all organisation settings, branding colours/logos, configure billing defaults, run academic rollover, and execute full organisation GDPR data exports (JSON). |
| **Centre Manager (`MANAGER`)** | **OPERATIONAL SETTINGS** | Can access `/dashboard/settings` to view organisation overview, and manage Operating Hours, Finance & Pricing (for assigned centres), Registration Terms, and Discount Rules. Restricted from branding colours, danger zone actions (full organisation GDPR export, academic rollover), and editing organisation identity (name/slug). (Routine operational CSV exports remain accessible to Managers via Reports and Finance). |
| **Front Desk (`FRONT_DESK`)** | **NO ACCESS** | Redirected to `/dashboard`. |
| **Tutor (`TUTOR`)** | **NO ACCESS** | Redirected to `/dashboard`. |
| **Parent (`PARENT`)** | **NO ACCESS** | Scoped strictly to the Parent Portal (`/portal`). |

---

## 3. Step-by-Step Procedures

### Procedure 1: Viewing Organisation Information

![Figure — Organisation Profile Form with branding logo and contact email](/training/assets/screenshots/annotated/SS-D6-S054.png)
*Figure 16.1 — Organisation Profile & Branding Form*
**Who Can Do This:** Organisation Owner (`ORG_OWNER`) (Edit), Centre Manager (`MANAGER`) (View Only)

**Steps:**
1. Navigate to: `Sidebar → Settings` (`/dashboard/settings`).
2. Review the **Organisation Overview** card displaying:
   - Organisation Name
   - Slug Identifier (used in public registration URLs)
   - Registered Business Address
   - Primary Support Email & Phone Number
3. Organisation Owners can edit contact info and click **Save Changes**. For Centre Managers, organisation identity fields are read-only to preserve tenant governance.

---

### Procedure 2: Exporting Organisation Data for GDPR / SAR Requests

![Figure — Organisation Data JSON Export Action in system settings](/training/assets/screenshots/annotated/SS-D6-S055.png)
*Figure 16.2 — GDPR Organisation JSON Export Action*

📹 **Video Walkthrough:** [Watch: Exporting Organisation Data as JSON](/training/assets/videos/SS-D6-V032.mp4)
**Who Can Do This:** Organisation Owner (`ORG_OWNER`) Only

**Steps:**
1. Navigate to: `Sidebar → Settings` (`/dashboard/settings`).
2. Scroll to the **Data Privacy & GDPR Export** section in the Danger Zone.
3. Click **Export All Organisation Data (JSON)**.
4. The system triggers `exportOrganisationData`, aggregating all parents, students, emergency contacts, registrations, and bookings across the entire organisation into a structured JSON file.
5. The browser prompts to save the export file (e.g. `organisation-gdpr-export-YYYY-MM-DD.json`).

> [!IMPORTANT]
> **Full Organisation GDPR Export vs. Routine Operational Exports:**
> - **Full Organisation GDPR Export (JSON):** Restricted strictly to **Organisation Owners** (`ORG_OWNER`) in the Settings Danger Zone. Generates a comprehensive JSON archive across all venues for statutory GDPR data portability and Subject Access Requests (SAR).
> - **Routine Operational Exports (CSV):** Centre Managers and Organisation Owners can export operational CSV reports (Session Bookings CSV, Student Roster CSV, Daily Registers, and Finance Ledger CSV) under `Sidebar → Reports` (`/dashboard/reports`) and `Sidebar → Finance` (`/api/export/finance`). Managers' operational CSV exports are scoped to their assigned centres.
> - **Permanent Deletion vs. Export:** Exporting data does not delete records. Permanent deletion of soft-deleted families (`hardDeleteParent`) from the 30-day Recovery Bin is also an Owner-only capability located at `Sidebar → Parents → Recovery Bin` (`/dashboard/parents/bin`). Front Desk and Centre Managers can view and restore records from the bin, but cannot permanently purge them.

---

### Procedure 3: Configuring Registration Terms & Discount Rules
**Who Can Do This:** Organisation Owner (`ORG_OWNER`), Centre Manager (`MANAGER`)

**Steps:**
1. Navigate to: `Sidebar → Settings` (`/dashboard/settings`).
2. To update terms: Select the **Registration Form** tab, edit the registration terms and conditions text, and click **Save Terms**. Parents must review and digitally sign these terms before submitting applications.
3. To update discount rules: Select the **Discount Rules** tab, configure sibling or promotional discount percentages, and save changes. Discount rules are automatically applied during billing calculations.

---

## 4. Integration Settings & Service Classifications

![Figure — External Integrations Card showing school sync status and last connection time](/training/assets/screenshots/annotated/SS-D6-S078.png)
*Figure 16.3 — External Integration Statuses Card*

SprintScale CMS connects with external providers for communications, error monitoring, and payments. Below is the authoritative evidence-backed classification of all integrated services:

| Integration / Service | Operational Status | Function in SprintScale | Administrator Guidance |
|---|---|---|---|
| **Resend** | **LIVE / REQUIRED** | Dispatches all transactional emails, magic login links, staff invitations, and parent broadcasts. | Configured via environment variables (`RESEND_API_KEY`, `EMAIL_FROM`). |
| **Twilio** | **READY TO ACTIVATE / DEFERRED** | SMS broadcast and emergency notification capability. | Currently unconfigured/deferred in production; fallback to email. |
| **Wonde (School MIS)** | **NOT REQUIRED / PARTIALLY IMPLEMENTED** | School MIS roster synchronisation. | **Not required for standalone business use.** The business operates SprintScale as a standalone CMS platform without school MIS sync. |
| **Google Calendar** | **DEFERRED** | Optional two-way calendar sync for room bookings. | Unconfigured/deferred in production. |
| **Stripe** | **CODE COMPLETE / DEFERRED** | Online parent credit/debit card checkout. | Architecture code-complete; production card payments deferred by business decision. |
| **GoCardless** | **CODE COMPLETE / DEFERRED** | Direct Debit mandate collection. | Architecture code-complete; production Direct Debit deferred by business decision. |
| **Sentry** | **CONFIGURED & SDK DELIVERY VERIFIED** | Application runtime error tracking and monitoring. | Configured on client and server. (Controlled event verified via local Node process using Production DSN). |
| **UptimeRobot** | **LIVE & EXTERNALLY VERIFIED** | Synthetic uptime and health endpoint monitoring. | External monitor pinging `/api/health`. |

---

## 5. Architectural Boundaries & System Limits

- **No Self-Service Organisation Deletion:** To prevent catastrophic data loss, SprintScale does not offer a self-service "Delete Organisation" button in the UI.
- **No Self-Service Ownership Transfer:** Organisation ownership cannot be transferred automatically from the UI.
- **Multi-Tenant Isolation:** All database queries enforce `organisationId` checks, preventing cross-tenant data leakage.
