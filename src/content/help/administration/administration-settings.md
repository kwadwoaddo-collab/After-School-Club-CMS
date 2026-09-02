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
| **Organisation Owner (`ORG_OWNER`)** | **FULL ACCESS** | Can view/edit all organisation settings, configure billing defaults, and run GDPR exports. |
| **Centre Manager (`MANAGER`)** | **RESTRICTED** | Cannot access global organisation settings; restricted to assigned Centre Settings (`/dashboard/centres/[id]/settings`). |
| **Front Desk (`FRONT_DESK`)** | **NO ACCESS** | Redirected to `/dashboard`. |
| **Tutor (`TUTOR`)** | **NO ACCESS** | Redirected to `/dashboard`. |
| **Parent (`PARENT`)** | **NO ACCESS** | Scoped strictly to the Parent Portal (`/portal`). |

---

## 3. Step-by-Step Procedures

### Procedure 1: Viewing Organisation Information

![Figure — Organisation Profile Form with branding logo and contact email](/training/assets/screenshots/annotated/SS-D6-S054.png)
*Figure 16.1 — Organisation Profile & Branding Form*
**Who Can Do This:** Organisation Owner (`ORG_OWNER`)

**Steps:**
1. Navigate to: `Sidebar → Settings` (`/dashboard/settings`).
2. Review the **Organisation Overview** card displaying:
   - Organisation Name
   - Slug Identifier (used in public registration URLs)
   - Registered Business Address
   - Primary Support Email & Phone Number
3. Click **Save Changes** after editing any organisation contact information.

---

### Procedure 2: Exporting Organisation Data for GDPR / SAR Requests

![Figure — Organisation Data JSON Export Action in system settings](/training/assets/screenshots/annotated/SS-D6-S055.png)
*Figure 16.2 — GDPR Organisation JSON Export Action*

📹 **Video Walkthrough:** [Watch: Exporting Organisation Data as JSON](/training/assets/videos/SS-D6-V032.mp4)
**Who Can Do This:** Organisation Owner (`ORG_OWNER`) Only

**Steps:**
1. Navigate to: `Sidebar → Settings` (`/dashboard/settings`).
2. Scroll to the **Data Privacy & GDPR Export** section.
3. Click **Export All Organisation Data (JSON)**.
4. The system triggers `exportOrganisationData`, aggregating all parents, students, emergency contacts, registrations, and bookings into a structured JSON file.
5. The browser prompts to save the export file (e.g. `organisation-gdpr-export-YYYY-MM-DD.json`).

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
