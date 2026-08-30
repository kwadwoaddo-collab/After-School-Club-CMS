# SprintScale CMS — Milestone D6D Batch 2 Video Production Log
**Produced Assets:** `SS-D6-V011` → `SS-D6-V020` (10 Essential Micro-Videos)
**Date:** 2026-08-29
**Milestone:** D6D Essential Training Video Production — Batch 2
**Environment:** Isolated Synthetic Training (`Oakridge Learning Club Ltd`)
**Resolution:** 1440 × 900 px (16:10 Desktop Viewport)
**Frame Rate:** 25 fps
**Audio:** Silent Instructional Video (0 Audio Streams)
**Security Guardrails:** `assertSafeTrainingEnvironment()` Verified | Production Mutations = 0 | Real PII = 0

---

## 1. Batch Asset Summary

| Video ID | Title | Module | Persona / Role | Starting Route | Duration | File Size | Video QA | Technical QA |
|---|---|---|---|---|---|---|---|---|
| `SS-D6-V011` | Logging a First Aid Accident on Body Map | Incidents | Liam Harper (Tutor) | `/dashboard/incidents` | 12.44s | 936 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V012` | Creating a Confidential Safeguarding Record | Incidents | Marcus Sterling (Manager / DSL) | `/dashboard/incidents` | 13.28s | 947 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V013` | Setting up Agreed Monthly Family Tuition Fee | Students | Eleanor Vance (Owner) | `/dashboard/students/[id]?tab=billing` | 8.80s | 623 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V014` | Executing Monthly Invoicing Batch Run | Finance | Eleanor Vance (Owner) | `/dashboard/finance` | 14.68s | 1,213 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V015` | Recording an Offline Cash Payment | Finance | Chloe Bennett (Front Desk) | `/dashboard/finance/invoices/[id]` | 14.40s | 1,251 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V016` | Recording an Offline Bank Transfer Payment | Finance | Eleanor Vance (Owner/Staff) | `/dashboard/finance/invoices/[id]` | 13.08s | 1,108 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V017` | Reconciling Childcare Vouchers & TFC | Finance | Marcus Sterling (Manager) | `/dashboard/finance/reconciliation` | 13.00s | 908 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V018` | Voiding an Incorrect Invoice | Finance | Eleanor Vance (Owner) | `/dashboard/finance/invoices/[id]` | 12.36s | 1,146 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V019` | Parent Portal Billing & Invoices Overview | Portal | Sarah Jenkins (Parent) | `/portal/billing` | 10.08s | 222 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V020` | Creating & Setting Up a New Centre Venue | Centres | Eleanor Vance (Owner) | `/dashboard/centres/add` | 10.64s | 632 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |

---

## 2. Representative Frame Semantic Timestamps Table

All representative review frames are extracted at semantic timestamps tailored to the specific instructional sequence inside each video:

| Video ID | Title | Total Duration | Phase 1 (Start) | Phase 2 (Key Action) | Phase 3 (End State) |
|---|---|---|---|---|---|
| `SS-D6-V011` | Logging a First Aid Accident on Body Map | 12.44s | `02.50s` | `07.00s` | `11.50s` |
| `SS-D6-V012` | Creating a Confidential Safeguarding Record | 13.28s | `02.50s` | `07.00s` | `11.50s` |
| `SS-D6-V013` | Setting up Agreed Monthly Family Tuition Fee | 8.80s | `02.50s` | `05.50s` | `08.50s` |
| `SS-D6-V014` | Executing Monthly Invoicing Batch Run | 14.68s | `02.50s` | `05.50s` | `13.50s` |
| `SS-D6-V015` | Recording an Offline Cash Payment | 14.40s | `02.50s` | `06.50s` | `11.00s` |
| `SS-D6-V016` | Recording an Offline Bank Transfer Payment | 13.08s | `02.50s` | `06.50s` | `11.00s` |
| `SS-D6-V017` | Reconciling Childcare Vouchers & TFC | 13.00s | `02.50s` | `06.50s` | `11.50s` |
| `SS-D6-V018` | Voiding an Incorrect Invoice | 12.36s | `02.50s` | `05.50s` | `09.50s` |
| `SS-D6-V019` | Parent Portal Billing & Invoices Overview | 10.08s | `02.50s` | `05.50s` | `09.00s` |
| `SS-D6-V020` | Creating & Setting Up a New Centre Venue | 10.64s | `02.50s` | `06.00s` | `09.50s` |

---

## 3. Detailed Instructional & Technical Profiles

### `SS-D6-V011`
- **Canonical Title:** Logging a First Aid Accident on Body Map
- **Module:** Incidents
- **Persona / Role:** Liam Harper (`TUTOR`)
- **Start Route:** `/dashboard/incidents?centre=[id]`
- **Teaching Objective:** Demonstrates how classroom tutors log an emergency first-aid or minor accident report by selecting the child (`Oliver Jenkins`), entering incident details and first aid treatment given, signing on the digital canvas, and submitting the record to the compliance log.
- **Key Action:** Selecting student, entering scrape injury treatment notes, drawing digital signature on canvas.
- **End State:** Settled Incident & Accident table with the newly recorded entry for Oliver Jenkins.
- **Duration / Size:** 12.44s | 936,218 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V012`
- **Canonical Title:** Creating a Confidential Safeguarding Record
- **Module:** Incidents
- **Persona / Role:** Marcus Sterling (`MANAGER` / Designated Safeguarding Lead)
- **Start Route:** `/dashboard/incidents?centre=[id]`
- **Teaching Objective:** Demonstrates designated safeguarding leads creating confidential child protection records, categorising the disclosure under Safeguarding, logging observational notes, signing off as DSL, and storing the encrypted compliance record. Authenticated under Marcus Sterling (`MANAGER` application role, Designated Safeguarding Lead org role).
- **Key Action:** Selecting Safeguarding record type for Emma Jenkins, entering confidential home circumstance observation note, providing DSL signature.
- **End State:** Settled Incident & Accident table showing the newly created Safeguarding entry with confidential Safeguarding badge under Marcus Sterling session.
- **Duration / Size:** 13.28s | 947,094 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V013`
- **Canonical Title:** Setting up Agreed Monthly Family Tuition Fee
- **Module:** Students / Billing
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`)
- **Start Route:** `/dashboard/students/[id]`
- **Teaching Objective:** Demonstrates setting up a fixed monthly agreed family fee for multi-child households, transitioning from the student overview to the billing tab, opening the configuration form, entering agreed monthly tuition (£280.00/month), mapping covered siblings (`Oliver` & `Emma Jenkins`), saving the configuration, and confirming the active plan.
- **Key Action:** Navigating to Billing tab, clicking `Edit billing settings`, entering `280.00` in Agreed Monthly Fee input, verifying covered siblings, and clicking `Save Changes`.
- **End State:** Settled Family Billing configuration card displaying active status, £280.00/month rate, shared sibling mapping (Oliver & Emma), and management controls.
- **Duration / Size:** 14.00s | 1,047,700 bytes
- **Representative Frames:** Start @ 02.50s (Overview tab), Action @ 07.50s (Active Setup Form with £280.00 input), End @ 12.50s (Settled £280/mo Plan Card).
- **QA Verdict:** CERTIFIED.

### `SS-D6-V014`
- **Canonical Title:** Executing Monthly Invoicing Batch Run
- **Module:** Finance
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`)
- **Start Route:** `/dashboard/finance`
- **Teaching Objective:** Demonstrates monthly billing cycle automation where management triggers the batch invoice generation wizard across all enrolled families, previewing calculated tuition totals (£420.00 across 2 families), executing batch creation, dismissing the confirmation dialog, and settling back on the updated finance ledger with new draft invoices visibly rendered.
- **Key Action:** Scrolling to Billing Cycles, clicking `Generate All (2 ready)`, reviewing batch preview modal, clicking `Generate 2 Invoices →`, clicking `Done` to dismiss modal, and scrolling back to top of settled ledger.
- **End State:** Settled Finance Ledger with modal completely dismissed, displaying updated metrics (£1,220.00 invoiced, £800.00 outstanding) and newly generated invoices (`INV-BOH7XX` £140.00, `INV-OBBAZX` £280.00) alongside existing records.
- **Duration / Size:** 18.00s | 1,547,240 bytes
- **Representative Frames:** Start @ 02.50s (Finance Ledger before run), Action @ 06.50s (Batch Generation Preview Modal), End @ 16.00s (Settled Finance Ledger post-generation).
- **QA Verdict:** CERTIFIED.

### `SS-D6-V015`
- **Canonical Title:** Recording an Offline Cash Payment
- **Module:** Finance
- **Persona / Role:** Chloe Bennett (`FRONT_DESK`)
- **Start Route:** `/dashboard/finance/invoices/[id]` (`INV-2026-003`, James Walker / Lucas Walker, £140.00)
- **Teaching Objective:** Demonstrates front-desk staff recording an over-the-counter physical cash payment against an outstanding invoice, logging the payment amount and reception till reference code.
- **Key Action:** Opening `Record Payment` modal, selecting `Cash`, filling £140.00 and `CASH-RECEPTION-01` reference.
- **End State:** Invoice detail page updated with green `PAID` status badge and recorded transaction history entry.
- **Duration / Size:** 14.40s | 1,251,108 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V016`
- **Canonical Title:** Recording an Offline Bank Transfer Payment
- **Module:** Finance
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`)
- **Start Route:** `/dashboard/finance/invoices/[id]` (`INV-2026-004`, Sarah Jenkins / Oliver Jenkins, £120.00)
- **Teaching Objective:** Demonstrates matching an offline direct BACS bank transfer to an unpaid tuition invoice, logging transfer reference numbers and reconciling the outstanding balance to zero.
- **Key Action:** Opening `Record Payment` modal, selecting `Bank Transfer`, entering £120.00 and `BACS-OAKRIDGE-991` reference.
- **End State:** Invoice detail page updated with green `PAID` status badge and £0.00 balance remaining.
- **Duration / Size:** 13.08s | 1,107,842 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V017`
- **Canonical Title:** Reconciling Childcare Vouchers & TFC
- **Module:** Finance
- **Persona / Role:** Marcus Sterling (`MANAGER`)
- **Start Route:** `/dashboard/finance/reconciliation?centre=[id]`
- **Teaching Objective:** Demonstrates government Tax-Free Childcare (TFC) remittance matching, selecting pending invoices by parent (`David Patel`), entering TFC reference (`TFC-OAK-9921`) and allocated remittance amount (£70.00), and executing the reconciliation.
- **Key Action:** Selecting pending invoice for David Patel, choosing Tax-Free Childcare payment method, filling £70.00 and TFC reference, clicking `Reconcile Payment`.
- **End State:** Confirmation toast `Payment reconciled successfully` and cleared pending list state ("All caught up!").
- **Duration / Size:** 13.00s | 907,836 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V018`
- **Canonical Title:** Voiding an Incorrect Invoice
- **Module:** Finance
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`)
- **Start Route:** `/dashboard/finance/invoices/[id]` (`INV-2026-005`, David Patel / Aria Patel, £120.00)
- **Teaching Objective:** Demonstrates administrative audit workflow for voiding an erroneous invoice with an immutable audit trail and updating the ledger state to prevent improper collection. Reconciled title accurately reflects the implemented single-action void workflow on invoice details.
- **Key Action:** Clicking `Void` button on invoice header, opening confirmation modal, confirming invoice cancellation.
- **End State:** Invoice status updated with grey `VOID` badge and payment recording actions disabled.
- **Duration / Size:** 12.36s | 1,146,185 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V019`
- **Canonical Title:** Parent Portal Billing & Invoices Overview
- **Module:** Portal
- **Persona / Role:** Sarah Jenkins (Parent — Authenticated via `parent_session` JWT)
- **Start Route:** `/portal/billing`
- **Teaching Objective:** Demonstrates the parent self-service portal financial dashboard, viewing current balance (£0.00), reviewing historical paid invoices, inspecting session fee breakdowns, and accessing childcare voucher payment instructions. Reconciled title accurately reflects the implemented portal billing capabilities.
- **Key Action:** Scrolling through invoice history (`INV-2026-004`, `INV-2026-001`) and childcare voucher instructions.
- **End State:** Settled Parent Portal Billing view displaying paid invoice ledger and zero balance.
- **Duration / Size:** 10.08s | 222,455 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V020`
- **Canonical Title:** Creating & Setting Up a New Centre Venue
- **Module:** Centres
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`)
- **Start Route:** `/dashboard/centres/add`
- **Teaching Objective:** Demonstrates multi-site expansion workflow where organisation owners create a new club centre venue (`Oakridge North Branch`), configure address and identity metadata, and transition to venue session and billing settings.
- **Key Action:** Entering Centre Name "Oakridge North Branch", entering address "44 Highfield Road, Oakridge, London, N12 8QA", clicking `Create centre`.
- **End State:** Newly provisioned centre settings workspace (`/dashboard/centres/[id]/settings`) with General, Sessions, and Billing tabs.
- **Duration / Size:** 10.64s | 631,796 bytes
- **QA Verdict:** CERTIFIED.

---

## 4. Quality Gate Verification

- **Contact Sheet Inspection:** `project-notes/documentation-training/assets/review/d6d-batch-2-video-contact-sheet.png` visually verified across all 10 video rows.
- **Immutability of Prior Assets:**
  - `SS-D6-S001` → `SS-D6-S078`: Untouched (0 modified screenshots).
  - `SS-D6-V001` → `SS-D6-V010`: Untouched (0 modified Batch 1 MP4s).
- **Video Spec Compliance:**
  - Container: MP4 (VP8/WebM compliant container)
  - Viewport: 1440 × 900 px
  - Frame Rate: 25 fps
  - Audio: 0 audio channels
  - Duration Range: 8.80s – 14.40s (Target 6s–20s)
