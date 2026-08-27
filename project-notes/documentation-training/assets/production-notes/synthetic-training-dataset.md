# SprintScale CMS — Synthetic Training Dataset Specification
## Canonical Fictional Organisation, Personas, Families, Attendance & Financial Fixtures

---

## 1. Purpose & Verification of the Synthetic Dataset

The synthetic training dataset provides a fully populated, reproducible environment for capturing all 130 visual assets in Phase D6 without any risk of exposing real student, parent, staff, or financial records.

- **Organisation Slug:** `oakridge-learning`
- **Seed Script:** `npm run training:seed` (`src/scripts/seed-training-data.ts`)
- **Reset Script:** `npm run training:reset` (`src/scripts/reset-training-data.ts`)
- **Safety Guard:** Verified via `src/lib/training-guard.ts` (`ALLOW_TRAINING_SEED=true`)

---

## 2. Organisation & Multi-Centre Structure

### Organisation Profile
- **Organisation Name:** `Oakridge Learning Club Ltd`
- **Slug Identifier:** `oakridge-learning`
- **Contact Email:** `support@oakridge-learning.example.test`
- **Contact Telephone:** `020 7946 0123`
- **Registered Address:** `12 High Street, Oakridge, London, SE1 1AA`
- **Brand Accent Color:** `#0284c7` (Sky Cyan)
- **Subscription Tier:** `professional`

### Centres / Venues
1. **Oakridge Central (Primary Multi-Session Venue):**
   - **Centre Slug:** `central`
   - **Address:** `Community Hall, 14 St. Mary's Road, London, SE1 2BB`
   - **Ofsted URN:** `EY123456`
   - **Bank Account (Owner-Managed):** `Oakridge Central Club`, Sort: `20-00-00`, Acc: `12345678`
   - **Manager Name:** `Marcus Sterling`
   - **Billing Email:** `billing@oakridge-learning.example.test`
   - **Operating Hours:** Mon–Fri 07:30 – 18:00
2. **Oakridge Riverside (Secondary Venue):**
   - **Centre Slug:** `riverside`
   - **Address:** `Riverside School Pavilion, London, SE1 3CC`
   - **Ofsted URN:** `EY654321`
   - **Manager Name:** `Marcus Sterling`
   - **Operating Hours:** Mon–Fri 15:30 – 18:00

---

## 3. Staff Personas & Login Credentials

All synthetic staff accounts use the standardized training password: `Password123!`

| Persona Name | Email Address | CMS Role | Venue Access | Primary Capture Function |
|---|---|---|---|---|
| **Eleanor Vance** | `eleanor.vance@example.test` | `ORG_OWNER` | All Centres (`central`, `riverside`) | Club Principal; settings, staff invites, voiding, permanent purge. |
| **Marcus Sterling** | `marcus.sterling@example.test` | `MANAGER` | `Oakridge Central` & `Oakridge Riverside` | Centre Lead & DSL; registrations, broadcasts, restricted safeguarding. |
| **Chloe Bennett** | `chloe.bennett@example.test` | `FRONT_DESK` | `Oakridge Central` | Administrator; check-in/out, walk-ins, offline cash payment, bin restore. |
| **Liam Harper** | `liam.harper@example.test` | `TUTOR` | `Oakridge Central` | Activity Leader; live roll call, kiosk mode, student notes, first aid accident. |

---

## 4. Family & Pupil Personas

### Family 1: Sarah Jenkins (Standard Multi-Child, Consented)
- **Parent:** `Sarah Jenkins` (`sarah.jenkins@example.test`, Tel: `07700 900111`)
- **Magic Link Token:** `magic-token-sarah-jenkins-oakridge`
- **Address:** `10 Elm Road, London, SE1 2AA`
- **Authorised Collectors:**
  1. `Sarah Jenkins` (Mother, phone `07700 900111`)
  2. `Rose Jenkins` (Grandmother, phone `07700 900999`, Collector PIN: `4821`)
- **Children:**
  1. **Oliver Jenkins:** DOB: `14/05/2017` (Year 3), Allergies: `['Peanuts (Severe)']`, Medical: `Severe Peanut Allergy (EpiPen in Main Office)`, Dietary: `Nut-free`.
  2. **Emma Jenkins:** DOB: `02/09/2020` (Reception), Dietary: `Vegetarian`.
- **Agreed Monthly Fee:** £280.00 / month (Anchor: 1st of month).
- **Communications Consent:** `true` (Consented).

### Family 2: David Patel (Single Child, Withdrawn Consent)
- **Parent:** `David Patel` (`david.patel@example.test`, Tel: `07700 900222`)
- **Magic Link Token:** `magic-token-david-patel-oakridge`
- **Address:** `25 Maple Street, London, SE1 3BB`
- **Child:** **Aria Patel:** DOB: `11/11/2015` (Year 5), Medical: `Mild Asthma (Inhaler with child)`, Dietary: `Halal`.
- **Agreed Monthly Fee:** £140.00 / month.
- **Communications Consent:** `false` (Withdrawn on latest booking).

### Family 3: Rachel Taylor (Recovery Bin Staged Family)
- **Parent:** `Rachel Taylor` (`rachel.taylor@example.test`, Tel: `07700 900333`)
- **Child:** **Noah Taylor:** DOB: `19/03/2018` (Year 2).
- **Record State:** Soft-deleted (`deletedAt = NOW() - INTERVAL '5 days'`). Staged in Recovery Bin (`/dashboard/parents/bin`).

### Family 4: James Walker (Public Registration Queue Intake)
- **Parent:** `James Walker` (`james.walker@example.test`, Tel: `07700 900444`)
- **Child:** **Lucas Walker:** DOB: `22/01/2020` (Year 1), SEN: `Speech & Language support indicator`.
- **Record State:** Public registration submission `status: awaiting_confirmation` with emergency contact `Mark Walker` (`07700 900555`) and digital signature.

---

## 5. Financial & Invoicing Fixtures

1. **Invoice `INV-2026-001` (Jenkins Family):**
   - Amount: £280.00 | Status: `paid` | Period: `01/09/2026 - 30/09/2026`
   - Payment 1: £280.00 via `bank_transfer` (Status: `verified`, Ref: `BACS-JENK-0926`).
2. **Invoice `INV-2026-002` (Patel Family):**
   - Amount: £140.00 | Status: `partially_paid` | Period: `01/09/2026 - 30/09/2026`
   - Payment 1: £70.00 via `cash` (Status: `verified`, Ref: `CASH-REC-01`).
   - Payment 2: £70.00 via `tax_free_childcare` (Status: `pending`, Ref: `TFC-PATEL-889`).
   - Outstanding Balance: £70.00.
3. **Invoice `INV-2026-003` (Walker Family):**
   - Amount: £140.00 | Status: `sent` | Outstanding: £140.00.

---

## 6. Attendance & Classroom Fixtures

- **Live Session:** `Oakridge Central — After School Club` (`15:30 - 18:00`)
- **Roster Entries:**
  - `Oliver Jenkins`: Status `present` (Checked in at 15:35 by Liam Harper).
  - `Emma Jenkins`: Status `present` (Checked in at 15:35 by Liam Harper).
  - `Aria Patel`: Status `absent` (Reason: `illness`, Forgiven: `true` on Session Credit Ledger with note *"Absence forgiven as per doctor notification."*).
  - `Lucas Walker`: Status `present` (Walk-In registration logged at Kiosk at 15:42 by Chloe Bennett).

---

## 7. Incidents & Generic Safeguarding Content

- **First Aid Entry:** `Oliver Jenkins` (Minor knee graze in playground; body-map right knee coordinates `(x: 48, y: 72)`; sterile dressing applied; staff signature `Liam Harper`).
- **Restricted Safeguarding Placeholder:** `Aria Patel` (Type: `safeguarding`, Description: *"Observation recorded for training demonstration purposes. Follow local authority escalation procedure."*, Access: Owner & Manager only).
