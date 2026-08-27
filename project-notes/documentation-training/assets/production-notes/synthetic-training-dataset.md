# SprintScale CMS — Synthetic Training Dataset Specification
## Canonical Fictional Organisation, Personas, Families, Attendance & Financial Fixtures

---

## 1. Purpose of the Synthetic Dataset

To guarantee 100% data privacy and eliminate any risk of exposing real children, parents, staff, or financial records, all visual assets in Milestone D6 must be captured against this canonical synthetic training dataset.

---

## 2. Organisation & Multi-Centre Structure

### Organisation Profile
- **Organisation Name:** `Oakridge Learning Club Ltd`
- **Slug Identifier:** `oakridge-learning`
- **Official Contact Email:** `support@oakridge-learning.example.test`
- **Contact Telephone:** `020 7946 0123`
- **Registered Address:** `12 High Street, Oakridge, London, SE1 1AA`
- **Default Timezone:** `Europe/London`

### Centres / Venues
1. **Oakridge Central (Primary Multi-Session Venue):**
   - **Centre Slug:** `central`
   - **Address:** `Community Hall, 14 St. Mary's Road, SE1 2BB`
   - **Ofsted URN:** `EY123456`
   - **Operating Sessions:**
     - Breakfast Club: 07:30 – 08:45 (Capacity: 30)
     - After-School Club: 15:30 – 18:00 (Capacity: 45)
     - Holiday Club: 08:30 – 17:30 (Capacity: 40)
   - **Bank Account (Owner-Managed):** `Oakridge Central Club`, Sort: `20-00-00`, Acc: `12345678`
2. **Oakridge Riverside (Secondary Venue):**
   - **Centre Slug:** `riverside`
   - **Address:** `Riverside School Pavilion, SE1 3CC`
   - **Ofsted URN:** `EY654321`
   - **Operating Sessions:**
     - After-School Club: 15:30 – 18:00 (Capacity: 30)

---

## 3. Staff Personas & Access Roles

| Persona Name | Email Address | CMS Role | Venue Access | Primary Function in Training |
|---|---|---|---|---|
| **Eleanor Vance** | `eleanor.vance@example.test` | `ORG_OWNER` | All Centres | Club Principal; demonstrates settings, billing runs, staff invites, voiding, permanent purge. |
| **Marcus Sterling** | `marcus.sterling@example.test` | `MANAGER` | `Oakridge Central` | Centre Lead & Designated Safeguarding Lead; demonstrates registrations, broadcasts, restricted safeguarding. |
| **Chloe Bennett** | `chloe.bennett@example.test` | `FRONT_DESK` | `Oakridge Central` | Club Administrator; demonstrates daily check-in/out, walk-in registration, offline cash payment, bin restore. |
| **Liam Harper** | `liam.harper@example.test` | `TUTOR` | `Oakridge Central` | Activity Leader; demonstrates classroom roll call, kiosk mode, student notes, first aid injury logging. |

---

## 4. Family & Pupil Personas

### Family 1: Sarah Jenkins (Standard Multi-Child, Consented)
- **Parent:** `Sarah Jenkins` (`sarah.jenkins@example.test`, Tel: `07700 900111`)
- **Emergency Contact:** `Mark Jenkins` (Father, Tel: `07700 900112`)
- **Authorised Collectors:** `Sarah Jenkins` (Mother), `Grandmother Rose Jenkins` (Collector PIN: `4821`)
- **Children:**
  1. **Oliver Jenkins:** DOB: `14/05/2017` (Year 3), Medical Flag: `Severe Peanut Allergy (EpiPen in Main Office)`, Dietary: `Nut-free`.
  2. **Emma Jenkins:** DOB: `02/09/2020` (Reception), Medical Flag: `None`, Dietary: `Vegetarian`.
- **Agreed Monthly Fee:** £280.00 / month (Anchor: 1st of month).
- **Communications Consent:** `true` (Consented).

### Family 2: David Patel (Single Child, Withdrawn Consent)
- **Parent:** `David Patel` (`david.patel@example.test`, Tel: `07700 900222`)
- **Child:** **Aria Patel:** DOB: `11/11/2015` (Year 5), Medical Flag: `Mild Asthma (Inhaler with child)`, Dietary: `Halal`.
- **Agreed Monthly Fee:** £140.00 / month.
- **Communications Consent:** `false` (Withdrawn on latest booking to demonstrate consent filtering).

### Family 3: Rachel Taylor (Recovery Bin Staged Family)
- **Parent:** `Rachel Taylor` (`rachel.taylor@example.test`)
- **Child:** **Noah Taylor:** DOB: `19/03/2018` (Year 2).
- **Record State:** Soft-deleted (`deletedAt = NOW() - INTERVAL '5 days'`). Used to demonstrate Recovery Bin restore & purge procedures.

### Family 4: James Walker (Public Registration Queue Intake)
- **Parent:** `James Walker` (`james.walker@example.test`, Tel: `07700 900444`)
- **Child:** **Lucas Walker:** DOB: `22/01/2020` (Year 1), SEN Flag: `Speech & Language support indicator`.
- **Record State:** Registration submission status: `awaiting_confirmation` with signed digital signature pad data URL.

---

## 5. Financial & Billing Fixtures

1. **Invoice `INV-2026-001` (Jenkins Family):**
   - Amount: £280.00 | Status: `paid` | Period: `01/09/2026 - 30/09/2026`
   - Payment 1: £280.00 via `bank_transfer` (Status: `verified`, Ref: `BACS-JENK-0926`).
2. **Invoice `INV-2026-002` (Patel Family):**
   - Amount: £140.00 | Status: `partially_paid` | Period: `01/09/2026 - 30/09/2026`
   - Payment 1: £70.00 via `cash` (Status: `verified`, Ref: `CASH-REC-01`).
   - Payment 2: £70.00 via `tax_free_childcare` (Status: `pending`, Ref: `TFC-PATEL-889`).
   - Outstanding Balance: £70.00 (Pending voucher does not mark invoice paid).
3. **Invoice `INV-2026-003` (Walker Family):**
   - Amount: £140.00 | Status: `sent` | Outstanding: £140.00.

---

## 6. Attendance & Classroom Fixtures

- **Live Session:** `Oakridge Central — After School Club` (`Today, 15:30 - 18:00`)
- **Roster Entries:**
  - `Oliver Jenkins`: Status `present` (Checked in at 15:35 by Liam Harper).
  - `Emma Jenkins`: Status `present` (Checked in at 15:35 by Liam Harper).
  - `Aria Patel`: Status `absent` (Reason: `illness`, Forgiven: `true` on Session Credit Ledger).
  - `Lucas Walker`: Status `present` (Walk-In registration logged at Kiosk at 15:42).

---

## 7. Incident & Safeguarding Generic Policy

- **First Aid Entry:** `Oliver Jenkins` (Minor knee graze in playground; body-map right knee coordinates `(x: 48, y: 72)`; cleaned and sterile dressing applied; staff signature `Liam Harper`).
- **Restricted Safeguarding Placeholder:** `Aria Patel` (Type: `safeguarding`, Description: *"Observation logged for training demonstration purposes. Follow local authority escalation procedure."*, Access: Owner & Manager only).
