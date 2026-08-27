# SprintScale CMS — Milestone D5 Final Freeze
## Authoritative Documentation, Training & Administration Baseline Freeze Before Visual Asset Production

**Document Type:** Milestone Completion & Final Baseline Freeze Report  
**Milestone:** D5 Final Freeze  
**Authoritative Starting SHA:** `5e7998e`  
**Branch:** `rebuild/cms-modernisation`  
**Phase-7 Reference Tag:** `cms-modernisation-phase7-complete` (`0c03442`)  
**Date:** 2026-08-27  
**Status:** **PASS — DOCUMENTATION BASELINE FROZEN — READY FOR D6**  

---

## 1. Executive Verdict

**PASS — DOCUMENTATION BASELINE FROZEN — READY FOR D6**

Milestone D5 Final Freeze has established that the application codebase and documentation produced through Milestones D0–D5.R are 100% internally consistent, technically verified against current server-side implementation, and fully prepared to serve as the immutable baseline for Milestone D6 visual asset production.

---

## 2. Authoritative Baseline & Repository Verification

- **Starting SHA:** `5e7998e`
- **Branch:** `rebuild/cms-modernisation`
- **Working-Tree Status:** Clean (`nothing to commit, working tree clean`)
- **Remote Synchronization:** Up to date with `origin/rebuild/cms-modernisation`
- **Push Status:** **NOT PUSHED** *(Strict local audit and freeze)*
- **Production Health:** **HTTP 200 `{"ok":true}`** *(Live verified at `https://app.sprintscaleit.co.uk/api/health`)*

---

## 3. D0–D5.R Documentation Inventory & Link Integrity

The entire `project-notes/documentation-training/` tree comprises **54 markdown documents**:

| Documentation Component | Files | Link Integrity Status | Current Status |
|---|---|---|---|
| **Root Index & Guide** | `README.md`, `d0-production-documentation-audit.md` | 100% Valid | Frozen |
| **Standards & Style** | `standards/documentation-style-guide.md` | 100% Valid | Frozen |
| **Master Manuals (Parts 1–5)** | `01-system-foundations.md` through `05-administration-and-operations.md` | 100% Valid | Frozen |
| **Role Guides** | `owner-guide.md`, `manager-guide.md`, `front-desk-guide.md`, `tutor-guide.md`, `parent-guide.md` | 100% Valid | Frozen |
| **Quick-Start Guides** | 4 role-specific quick-starts | 100% Valid | Frozen |
| **Functional User Manuals** | 10 specialized functional manuals | 100% Valid | Frozen |
| **Operational Rationales** | 4 rationale documents (13+ design rationales each) | 100% Valid | Frozen |
| **Video Production Scripts** | 4 module scripts (`d2` through `d5`) | 100% Valid | Frozen |
| **Screenshot Plans** | 4 module plans (`d2` through `d5`) | 100% Valid | Frozen |
| **Troubleshooting Handbooks** | 4 module handbooks (`d2` through `d5`) | 100% Valid | Frozen |
| **Milestone Reports** | `milestone-d1` through `milestone-d5`, `d5-final-freeze.md` | 100% Valid | Frozen |
| **D6 Production Manifest** | `d6-visual-production-manifest.md` | 100% Valid | Ready for D6 |

### Link Audit Summary:
- **Markdown Files Scanned:** 54
- **Internal Relative Links Scanned:** 50
- **Valid Internal Links:** 50
- **Broken / Orphan Links:** **0 (100% Integrity)**

---

## 4. Final Server-Side Role & Permissions Matrix

Re-derived from server-side source code (`src/` actions and route handlers):

| System Capability | Owner (`ORG_OWNER`) | Manager (`MANAGER`) | Front Desk (`FRONT_DESK`) | Tutor (`TUTOR`) | Parent (`PARENT`) | Server Enforcement Location |
|---|---|---|---|---|---|---|
| **Global Settings (`/settings`)** | FULL | BLOCKED | BLOCKED | BLOCKED | NOT AVAILABLE | `src/app/dashboard/settings/page.tsx` |
| **GDPR JSON Export** | FULL | BLOCKED | BLOCKED | BLOCKED | NOT AVAILABLE | `exportOrganisationData` |
| **Create New Centre Venue** | FULL | FULL | BLOCKED | BLOCKED | NOT AVAILABLE | `createCentre` |
| **Edit Centre General Settings** | FULL | ASSIGNED CENTRES | BLOCKED | BLOCKED | NOT AVAILABLE | `updateCentreAction` |
| **Edit Centre Bank Details** | FULL (Owner Only) | BLOCKED | BLOCKED | BLOCKED | NOT AVAILABLE | `updateCentreAction` (`isUpdatingBankDetails`) |
| **Staff Directory (`/staff`)** | FULL | VIEW ONLY | BLOCKED | BLOCKED | NOT AVAILABLE | `src/app/dashboard/staff/page.tsx` |
| **Invite Staff (`/staff/invite`)** | FULL (Owner Only) | BLOCKED | BLOCKED | BLOCKED | NOT AVAILABLE | `/api/staff/invite` |
| **Change Staff Role / Remove** | FULL (Owner Only) | BLOCKED | BLOCKED | BLOCKED | NOT AVAILABLE | `updateStaffRole` / `/api/staff/remove` |
| **Send Parent Broadcasts** | FULL | ASSIGNED CENTRES | BLOCKED | BLOCKED | NOT AVAILABLE | `sendBroadcast` |
| **Daily Register & Kiosk** | FULL | ASSIGNED CENTRES | ASSIGNED CENTRES | ASSIGNED (Live) | NOT AVAILABLE | `src/features/attendance/actions.ts` |
| **Restricted Safeguarding Records** | FULL | ASSIGNED CENTRES | BLOCKED | BLOCKED | NOT AVAILABLE | `src/features/incidents/actions.ts` |
| **Global Finance Dashboard** | FULL | BLOCKED | BLOCKED | BLOCKED | NOT AVAILABLE | `src/app/dashboard/finance/page.tsx` |
| **Agreed Monthly Fee Billing** | FULL | ASSIGNED CENTRES | BLOCKED | BLOCKED | NOT AVAILABLE | `billingConfigs` |
| **Record Offline Payments** | FULL | ASSIGNED CENTRES | ASSIGNED CENTRES | BLOCKED | NOT AVAILABLE | `recordPayment` |
| **Void / Delete Invoices** | FULL (Owner Only) | BLOCKED | BLOCKED | BLOCKED | NOT AVAILABLE | `voidInvoice` / `deleteInvoice` |
| **Recovery Bin View & Restore** | FULL | FULL | FULL | BLOCKED | NOT AVAILABLE | `restoreParent` (`bin.actions.ts`) |
| **Permanent GDPR Purge** | FULL (Owner Only) | BLOCKED | BLOCKED | BLOCKED | NOT AVAILABLE | `hardDeleteParent` (`bin.actions.ts`) |
| **Parent Portal (`/portal`)** | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | OWN FAMILY ONLY | `src/app/portal/` |

---

## 5. D5.R Remediations Verification

### 1. Permanent Purge Authorization
- **Status:** **VERIFIED**
- `hardDeleteParent` in `src/app/dashboard/parents/bin.actions.ts` enforces `requireApiAuth({ roles: ['ORG_OWNER'] })`.
- Managers and Front Desk receive `Unauthorized` / 403 server-side, and client UI hides the permanent delete button via `canHardDelete={isOwner}`.
- `restoreParent` and `softDeleteParent` remain safely accessible to Owner, Manager, and Front Desk.

### 2. Academic-Year Rollover Idempotency & Concurrency
- **Status:** **VERIFIED**
- `/api/cron/school-year-roll` executes inside a PostgreSQL transaction protected by an advisory lock: `pg_try_advisory_xact_lock(hashtext('school_year_roll_' || rolloverYear))`.
- Checks `auditEvents` table for prior execution (`school_year_rollover_completed` with `rolloverYear`).
- Subsequent or duplicate invocations safely return `{ success: true, skipped: true, rolledCount: 0 }`.

### 3. Communications Consent Truth
- **Status:** **VERIFIED**
- `sendBroadcast` and `getParentsForCentre` in `src/features/communications/actions.ts` evaluate the parent's **latest booking** ordered by `createdAt DESC, id DESC`.
- Historical `true` consent does not override a subsequent `false` preference (withdrawal).
- Transactional messages (invoices, magic links, receipts) remain operational and exempt from promotional consent filters.

---

## 6. Financial & Safeguarding Boundaries

- **Outstanding Balance Formula:** `Outstanding Balance = Invoice Amount - Sum(VERIFIED Payments)`. Pending vouchers and failed payments do not reduce outstanding balance.
- **No Monetary Credit Ledger:** Confirmed that excess payments are stored on the specific payment row; the CMS contains no global family credit account.
- **Invoice Duplicate Protection:** Enforced at application level via `billingRuns` pre-check `(billingConfigId, periodStart)`.
- **Safeguarding Software Boundary:** Documentation strictly distinguishes software access permissions (Owner/Manager restricted records) from formal statutory DSL appointment. Generic synthetic narratives only.

---

## 7. External Integration Classifications

| Integration | Frozen Classification | Operational Guidance |
|---|---|---|
| **Resend** | **LIVE / REQUIRED** | Dispatches transactional emails, magic links, staff invitations, and parent broadcasts. |
| **UptimeRobot** | **LIVE AND EXTERNALLY VERIFIED** | Synthetic health ping monitoring `/api/health`. |
| **Sentry** | **CONFIGURED AND SDK DELIVERY VERIFIED** | Configured on client and server. (Local process delivery verified; real Vercel runtime exception not empirically captured). |
| **Twilio** | **READY TO ACTIVATE / DEFERRED** | SMS broadcast capability code-complete; unconfigured/deferred in production. |
| **Wonde** | **NOT REQUIRED FOR STANDALONE USE / PARTIALLY IMPLEMENTED** | Standalone CMS operations do not require School MIS sync. |
| **Google Calendar** | **DEFERRED** | Calendar event synchronization unconfigured in production. |
| **Stripe** | **CODE COMPLETE / DEFERRED** | Online parent card checkout deferred by business decision. |
| **GoCardless** | **CODE COMPLETE / DEFERRED** | Direct Debit mandate collection deferred by business decision. |

---

## 8. Quality Gates & Application Health

| Quality Gate | Requirement | Executed Status | Verdict |
|---|---|---|---|
| **TypeScript Compiler** | `npx tsc --noEmit` | Clean (0 errors) | **PASS** |
| **ESLint** | `npm run lint` | Clean (0 errors, 0 warnings) | **PASS** |
| **Vitest Test Suite** | `npm test -- --run` | **610 passed across 65 test files** | **PASS (100%)** |
| **Next.js Production Build** | `npx next build` | **Compiled 93 routes successfully** | **PASS** |
| **Production Health** | `GET /api/health` | **HTTP 200 `{"ok":true}`** | **PASS** |
| **Production DB Mutations** | Zero mutations | **0 INSERTs, 0 UPDATEs, 0 DELETEs** | **SAFE** |
| **Staging DB Mutations** | Zero mutations | **0 mutations** | **SAFE** |
| **External API Calls** | Zero calls | **0 provider calls** | **SAFE** |

---

## 9. 50-Question Adversarial Matrix

| # | Question | Verdict | Evidence / Details |
|---|---|---|---|
| 1 | Are all D0–D5.R documentation files present? | **SAFE** | 54 markdown files indexed and verified. |
| 2 | Are all internal links valid? | **SAFE** | 50/50 internal links resolve (0 broken). |
| 3 | Are any manuals orphaned? | **SAFE** | 100% reached from README navigation index. |
| 4 | Is canonical terminology consistent? | **SAFE** | Standardized via D1 style guide. |
| 5 | Do quick-start guides match the current UI? | **SAFE** | Verified against current UI routes. |
| 6 | Do role guides match current permissions? | **SAFE** | Mapped against server-side authorization. |
| 7 | Do functional manuals match current source? | **SAFE** | Reconciled across D0–D5.R. |
| 8 | Are master manuals internally consistent? | **SAFE** | Parts 1–5 flow coherently as one narrative. |
| 9 | Can Manager permanently purge a family? | **SAFE** | Blocked server-side (`Unauthorized`). |
| 10 | Can Front Desk permanently purge a family? | **SAFE** | Blocked server-side (`Unauthorized`). |
| 11 | Can Tutor permanently purge a family? | **SAFE** | Blocked across all bin actions. |
| 12 | Can Owner permanently purge a family? | **SAFE** | Allowed server-side and UI enabled. |
| 13 | Can unauthorized users bypass purge via server action? | **SAFE** | Guarded by `requireApiAuth({ roles: ['ORG_OWNER'] })`. |
| 14 | Is cross-tenant purge blocked? | **SAFE** | Scoped to session `organisationId`. |
| 15 | Are restore and purge permissions correctly distinguished? | **SAFE** | Restore = Owner/Manager/FrontDesk; Purge = Owner only. |
| 16 | Does documentation distinguish CMS permissions from formal DSL status? | **SAFE** | Clear boundary established in D3/D5. |
| 17 | Are Tutors prevented from restricted safeguarding records? | **SAFE** | Blocked server-side and hidden in UI. |
| 18 | Is Front Desk prevented from restricted safeguarding records? | **SAFE** | Blocked server-side and hidden in UI. |
| 19 | Are parent users isolated from internal safeguarding files? | **SAFE** | Scoped strictly to `/portal`. |
| 20 | Are external referral claims appropriately bounded? | **SAFE** | Framed as internal recordkeeping. |
| 21 | Are video/screenshot safeguarding examples synthetic and generic? | **SAFE** | Standardized generic scenarios only. |
| 22 | Is verified-payment arithmetic accurate? | **SAFE** | Outstanding = Amount - Verified Payments. |
| 23 | Are pending payments excluded from balance reduction? | **SAFE** | Pending vouchers do not mark invoice paid. |
| 24 | Is the absence of monetary overpayment credit documented? | **SAFE** | Overpayment stored on payment row only. |
| 25 | Are nonexistent payment-edit/reversal functions avoided? | **SAFE** | Void/reissue documented as correction path. |
| 26 | Is invoice duplicate protection described accurately? | **SAFE** | Application `billingRuns` pre-check documented. |
| 27 | Is parent financial isolation documented correctly? | **SAFE** | Parents view only their own invoices. |
| 28 | Is staff invite authority documented correctly? | **SAFE** | Owner-only 7-day cryptographic tokens. |
| 29 | Is role-change authority documented correctly? | **SAFE** | Owner-only with self-demotion blocked. |
| 30 | Is centre membership isolation documented correctly? | **SAFE** | Scoped via `centreMemberships`. |
| 31 | Is staff deactivation behaviour documented correctly? | **SAFE** | `organisationId = null`, memberships deleted. |
| 32 | Is historical attribution preserved in documentation? | **SAFE** | Past marks, notes, and audits retain user ID. |
| 33 | Is annual rollover authentication documented? | **SAFE** | Guarded by `CRON_SECRET`. |
| 34 | Is concurrency protection documented? | **SAFE** | PostgreSQL transaction advisory lock. |
| 35 | Is yearly idempotency documented? | **SAFE** | `auditEvents` completion check. |
| 36 | Is Year 13 -> Graduated documented? | **SAFE** | Progression rule verified. |
| 37 | Is Graduated stability documented? | **SAFE** | Stable terminal state. |
| 38 | Does latest consent override historical consent? | **SAFE** | Correlated subquery selects latest booking. |
| 39 | Does withdrawal exclude promotional broadcasts? | **SAFE** | Withdrawn consent (`false`) excluded. |
| 40 | Does re-opt-in restore eligibility? | **SAFE** | Re-opt-in (`true`) included. |
| 41 | Does no consent default to excluded? | **SAFE** | `COALESCE` defaults to `false`. |
| 42 | Is broadcast delivery durability described accurately? | **SAFE** | Documented as in-process async Promise. |
| 43 | Does every essential P0/P1 workflow have planned visual support? | **SAFE** | 46 essential screenshots, 32 essential videos. |
| 44 | Are all planned captures safe from real PII? | **SAFE** | 100% synthetic personas defined. |
| 45 | Is a coherent synthetic dataset specified? | **SAFE** | `Oakridge Learning Club` dataset specified. |
| 46 | Can screenshots be captured without production data? | **SAFE** | Local/synthetic capture protocol defined. |
| 47 | Can videos be recorded without production mutations? | **SAFE** | Zero production execution required. |
| 48 | Do all application quality gates pass? | **SAFE** | TypeScript, ESLint, Vitest (610/610), Build (93 routes). |
| 49 | Is production health currently good? | **SAFE** | HTTP 200 `{"ok":true}`. |
| 50 | Are all remaining debts explicitly recorded rather than hidden? | **SAFE** | Fully indexed in final debt register. |

#### Adversarial Arithmetic
- **SAFE:** **50 / 50 (100%)**
- **DEBT:** **0**
- **DEFECT:** **0**
- **BLOCKED:** **0**
- **NOT APPLICABLE:** **0**

---

## 10. Final Recommendation

**PASS — DOCUMENTATION BASELINE FROZEN — READY FOR D6**
