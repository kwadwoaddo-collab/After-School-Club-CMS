# SprintScale CMS — Functional Manual: Incidents & Safeguarding
## First Aid, Accident Logging, Medication Tracking & Confidential DSL Records

---

## 1. What This Area Is For

The **Incidents & Safeguarding Module** (`/dashboard/incidents`) is the authoritative safety, first aid, and child protection tracking system for your club organisation.

It manages two fundamentally different operational streams:
1. **Standard Operational Incidents:** Minor playground accidents, first-aid administrations, medication tracking, and minor behavioral events.
2. **Confidential Safeguarding Records:** Formal child protection concerns, neglect observations, physical injury marks, disclosures, and external agency referrals.

---

## 2. Fundamental Distinctions

```
┌─────────────────────────────────────────────────────────────┐
│                 1. ORDINARY STUDENT NOTE                    │
│  • Academic progress, homework flags, positive behaviour    │
│  • Visible to: All on-duty Tutors, Front Desk & Managers    │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                2. STANDARD INCIDENT (FIRST AID)             │
│  • Scraped knees, minor bumps, cold compress, prescribed med│
│  • Visible to: Front Desk, Centre Managers & Owners         │
│  • Authorised by: Front Desk, Managers & Owners             │
└──────────────────────────────┬──────────────────────────────┘
                               │  STRICT LEGAL ISOLATION GATE
┌──────────────────────────────▼──────────────────────────────┐
│               3. CONFIDENTIAL SAFEGUARDING FILE             │
│  • Suspected abuse, neglect, physical injury marks, disclosures│
│  • Visible ONLY to: Designated Safeguarding Leads (DSL)     │
│  • Authorised ONLY by: Centre Managers & Organisation Owners│
│  • Completely invisible to: Tutors & Front-Desk Staff       │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Role-Based Access & DSL Security Boundaries

| Incident Type | Owner (`ORG_OWNER`) | Manager (`MANAGER`) | Front Desk (`FRONT_DESK`) | Tutor (`TUTOR`) | Parent (`PARENT`) |
|---|---|---|---|---|---|
| **Accident (First Aid)** | ✅ Read & Create | ✅ Read & Create | ✅ Read & Create | ❌ No Access (Report) | ❌ In-Person / Email |
| **Incident (Behaviour/Event)**| ✅ Read & Create | ✅ Read & Create | ✅ Read & Create | ❌ No Access (Report) | ❌ Discretionary |
| **Medication Log** | ✅ Read & Create | ✅ Read & Create | ✅ Read & Create | ❌ No Access (Report) | ❌ Prior Written Consent |
| **Safeguarding Record** | ✅ **Full DSL Access**| ✅ **Full DSL Access**| ❌ **ACCESS BLOCKED** | ❌ **ACCESS BLOCKED** | ❌ **STRICTLY CONFIDENTIAL** |

> [!SAFEGUARDING]
> **LEGAL ACCESS GATEWAY:**
> Server-side security enforces `requirePermission('MANAGER')` on all safeguarding records. Even if a Front Desk staff member or Tutor attempts to query safeguarding endpoints, the system automatically filters out safeguarding files from the response.

---

## 4. Step-by-Step Procedures

### Procedure 1: Logging a Standard First Aid Accident
**Who Can Do This:** Owner, Manager, Front Desk

**Steps:**
1. Navigate to: `Sidebar → Incidents → [+ Log Incident]` (`/dashboard/incidents`).
2. Select **Incident Type:** `Accident`.
3. Select the **Centre** and the **Child Name** from the searchable dropdown.
4. Set the **Date & Time** of the incident.
5. **Description:** Enter an objective, factual summary of the event (e.g. "Child tripped over football cone on playground and scraped right knee").
6. **Treatment Provided:** Enter first aid administered (e.g. "Cleaned scrape with sterile saline wipe, applied sterile dry plaster, cold compress for 5 minutes").
7. **Witnesses:** Enter names of staff or adults present (e.g. "Tutor Sarah J., Coach Mike").
8. **Staff Signature:** Sign your digital signature on the signature canvas.
9. Click **Save Incident Record**.

**Expected Result:**
The incident is timestamped and saved into the centre's permanent health and safety log.

---

### Procedure 2: Logging Medication Administration
**Who Can Do This:** Owner, Manager, Front Desk

**Steps:**
1. Navigate to: `Sidebar → Incidents → [+ Log Incident]`.
2. Select **Incident Type:** `Medication`.
3. Select the Child Name.
4. **Description:** Record the prescribed medication name and dosage (e.g. "Administered 2 puffs of Salbutamol inhaler as per asthma care plan").
5. **Treatment / Outcome:** Record observations following administration (e.g. "Breathing returned to normal within 3 minutes; child returned to calm play").
6. Enter witness names and provide your staff digital signature.
7. Click **Save Incident Record**.

---

### Procedure 3: Logging a Confidential Safeguarding Concern (DSL Only)
> [!SAFEGUARDING]
> Only qualified Designated Safeguarding Leads (Centre Managers and Organisation Owners) are authorized to create or view safeguarding records in SprintScale CMS.

**Who Can Do This:** **Organisation Owner** (`ORG_OWNER`) or **Centre Manager** (`MANAGER`)

**Steps:**
1. Navigate to: `Sidebar → Incidents → [+ Log Incident]`.
2. Select **Incident Type:** `Safeguarding`.
3. Select the Child Name.
4. **Factual Description:** Record verbatim quotes, direct observations, body mark locations, emotional presentation, and dates/times reported.
   - *Guideline:* Use objective, non-judgmental language. State what the child said in quotation marks. Do not state personal opinions or speculate on intent.
5. **Action Taken / Referrals:** Note whether local authority children's services (MASH/LADO) or emergency services were contacted.
6. Provide your staff digital signature.
7. Click **Save Incident Record**.

**What Happens in the System:**
The record is encrypted and saved into the isolated safeguarding audit store. It is permanently invisible to front-desk staff and tutors.

---

## 5. Current Limitation: `bodyMapCoordinates`

> [!NOTE]
> **Current System Status:**
> The database schema includes a `bodyMapCoordinates` column intended for recording injury coordinates on an anatomical diagram. 
> In the current production release, **injury locations are documented as factual text within the Description and Treatment fields**. An interactive visual body map canvas is deferred for a future release. Staff must enter specific anatomical locations in text (e.g. *"2cm circular bruise on left upper arm, posterior aspect"*).

---

## 6. Tutor & Front Desk Escalation Protocol

If a classroom tutor or front-desk staff member observes a child protection issue or receives a disclosure:

1. **Listen & Reassure:** Listen calmly to the child without asking leading questions or promising to keep secrets.
2. **Ensure Physical Safety:** Provide immediate first aid if physical injury is present.
3. **DO NOT Type in Ordinary Notes:** Never enter the disclosure into general student notes or public communication logs.
4. **Report In Person Immediately:** Escalate the report verbally in private to the on-duty **Centre Manager (Designated Safeguarding Lead)**.
5. The Centre Manager will log the formal report in `/dashboard/incidents` under the `Safeguarding` category.

---

## 7. Incidents & Safeguarding Troubleshooting

| Issue | Root Cause | Solution |
|---|---|---|
| **Safeguarding option is missing from incident dropdown** | User is logged in as Front Desk or Tutor. | Only Managers and Owners have access to the Safeguarding incident category. Escalate to your Centre Manager / DSL. |
| **Parent asks for a copy of a confidential safeguarding file** | Safeguarding files are legally privileged child protection records. | **Do NOT release safeguarding records to parents.** Refer the request immediately to the Organisation Owner and your local authority safeguarding advisor. |
| **Accidental safeguarding note saved as general accident** | Staff member selected `Accident` instead of `Safeguarding`. | Centre Manager must open the incident, review the content, reclassify or delete the accident record, and author the official report under `Safeguarding`. |
| **Incident list is empty for active centre** | Centre selector is set to a different venue, or incidents belong to soft-deleted children. | Verify the active centre in the top bar. Note that soft-deleted children's incidents are automatically archived. |
