# SprintScale CMS — Functional Manual: Incidents & Safeguarding
## First Aid, Accident Logging, Medication Tracking & Restricted Safeguarding Records

---

## 1. What This Area Is For

The **Incidents & Safeguarding Module** (`/dashboard/incidents`) provides an internal record-keeping system for health, safety, and sensitive child concerns within your club organisation.

It supports two distinct operational record types:
1. **Standard Operational Incidents:** Playground accidents, first-aid treatments, medication administration logs, and general behavioral events.
2. **Restricted Safeguarding Records:** Child protection notes, observable injury descriptions, disclosures, and sensitive welfare logs.

> [!IMPORTANT]
> **CMS Access vs. Formal Safeguarding Designation:**
> **CMS permission does not itself appoint somebody as a Designated Safeguarding Lead (DSL).**
> In SprintScale CMS, access to restricted safeguarding records is granted technically to users with the **Manager** (`MANAGER`) or **Owner** (`ORG_OWNER`) role. However, formal appointments of DSLs, deputy DSLs, statutory child protection duties, and decisions regarding external referrals are governed strictly by your organisation's internal safeguarding policies and local statutory frameworks.

---

## 2. Fundamental Distinctions in Record Keeping

```
┌─────────────────────────────────────────────────────────────┐
│                 1. ORDINARY STUDENT NOTE                    │
│  • Academic progress, homework flags, positive behaviour    │
│  • Visible to: All on-duty Tutors, Front Desk & Managers    │
│  • Context: Daily classroom support & tutor handovers       │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                2. STANDARD INCIDENT (FIRST AID)             │
│  • Minor scrapes, bumps, ice packs, prescribed medication   │
│  • Visible to: Front Desk, Centre Managers & Owners         │
│  • Context: Internal health & safety logging                │
└──────────────────────────────┬──────────────────────────────┘
                               │  SOFTWARE-ENFORCED ACCESS GATE
┌──────────────────────────────▼──────────────────────────────┐
│             3. RESTRICTED SAFEGUARDING RECORD               │
│  • Disclosures, sensitive welfare concerns, injury marks    │
│  • Visible ONLY to: Managers & Organisation Owners          │
│  • Blocked from: Tutors & Front-Desk Staff                  │
│  • Context: Confidential internal safeguarding record       │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Role-Based Software Access & Permission Boundaries

SprintScale CMS enforces software-level access controls at both the route and server-action layers:

| Record / Incident Type | Owner (`ORG_OWNER`) | Manager (`MANAGER`) | Front Desk (`FRONT_DESK`) | Tutor (`TUTOR`) | Parent (`PARENT`) | Evidence Source |
|---|---|---|---|---|---|---|
| **Accident (First Aid)** | ✅ Read & Create | ✅ Read & Create | ✅ Read & Create | ❌ No Direct Access | ❌ Handover / Direct | `incidents/actions.ts` |
| **Incident (Behaviour/Event)**| ✅ Read & Create | ✅ Read & Create | ✅ Read & Create | ❌ No Direct Access | ❌ Handover / Direct | `incidents/actions.ts` |
| **Medication Administration**| ✅ Read & Create | ✅ Read & Create | ✅ Read & Create | ❌ No Direct Access | ❌ Handover / Direct | `incidents/actions.ts` |
| **Restricted Safeguarding** | ✅ Full Access | ✅ Full Access | ❌ Filtered Out | ❌ No Direct Access | ❌ Strictly Blocked | `requirePermission('MANAGER')` |

### Key Software Boundaries:
1. **Server-Side Filtering:** When fetching incidents (`getIncidents`), the system executes a permission check (`requirePermission('MANAGER')`). If the user does not hold `MANAGER` or `ORG_OWNER` permissions, any incident with `type = 'safeguarding'` is automatically stripped from the response.
2. **Creation Gate:** When creating an incident (`createIncident`), submitting `type = 'safeguarding'` enforces `requirePermission('MANAGER')`. Front Desk staff cannot submit safeguarding records through the API.
3. **Organisation & Centre Scoping:** All incident queries and mutations require that the target `centreId` and `childId` belong to the user's authenticated `organisationId`. Front Desk and Manager users are scoped to their assigned centres.
4. **Soft-Deleted Exclusion:** Incidents for soft-deleted children are automatically excluded from the active list (`isNull(children.deletedAt)`).

---

## 4. Step-by-Step Procedures

### Procedure 1: Logging a Standard First Aid Accident
**Who Can Do This:** Owner, Manager, Front Desk

**Steps:**
1. Navigate to: `Sidebar → Incidents → [+ Log Incident]` (`/dashboard/incidents`).
2. Select **Incident Type:** `Accident`.
3. Select the **Centre** and choose the **Child Name** from the dropdown.
4. Set the **Date & Time** of the incident.
5. **Description:** Enter a clear, objective summary of the event (e.g. "Child slipped on playground grass and scraped left knee").
6. **Treatment Provided:** Enter the first aid administered (e.g. "Cleaned scrape with sterile saline wipe; applied sterile adhesive dressing; cold compress applied for 5 minutes").
7. **Witnesses:** Enter names of staff or adult witnesses present.
8. **Staff Signature:** Provide a digital signature on the signature canvas.
9. Click **Save Incident Record**.

**Expected Result:**
The record is saved and timestamped in the centre's incident table.

> [!NOTE]
> SprintScale CMS does not automatically send incident notification emails to parents upon submission. Informing parents of first-aid events should follow your centre's operational pickup/handover procedures.

---

### Procedure 2: Logging Medication Administration
**Who Can Do This:** Owner, Manager, Front Desk

**Steps:**
1. Navigate to: `Sidebar → Incidents → [+ Log Incident]`.
2. Select **Incident Type:** `Medication`.
3. Select the Child Name and enter the Date and Time.
4. **Description:** Record the medication name, batch/prescribed details, and dosage administered (e.g. "Administered 2 puffs of Salbutamol inhaler as per pupil health plan").
5. **Treatment / Outcome:** Record observations following administration (e.g. "Breathing settled; child rested quietly for 10 minutes before returning to play").
6. Enter witness details and sign on the canvas.
7. Click **Save Incident Record**.

---

### Procedure 3: Recording a Restricted Safeguarding Concern
**Who Can Do This:** **Organisation Owner** (`ORG_OWNER`) or **Centre Manager** (`MANAGER`)

**Steps:**
1. Navigate to: `Sidebar → Incidents → [+ Log Incident]`.
2. Select **Incident Type:** `Safeguarding`.
3. Select the Child Name and set the Date and Time of the concern/disclosure.
4. **Factual Description:** Record objective, factual observations, verbatim quotes where a disclosure occurred, observable marks, and physical presentation.
   - *Best Practice:* Record verbatim statements in quotation marks. Avoid speculative interpretations or emotional commentary.
5. **Action Taken / Notes:** Record internal actions taken (e.g. "Informed appointed DSL; logged in internal records").
6. Sign on the digital signature canvas.
7. Click **Save Incident Record**.

**What Happens in the System:**
The record is saved with `type = 'safeguarding'` and is visible only to Manager and Owner accounts. It is completely hidden from Front Desk and Tutor users.

---

## 5. Current Limitation: `bodyMapCoordinates`

> [!NOTE]
> **Technical Limitation:**
> The database schema includes an optional `bodyMapCoordinates` column. In the current release, there is **no interactive visual body map canvas** in the user interface.
> Specific injury locations should be described in clear, factual text within the **Description** and **Treatment** fields (e.g. *"Small 1cm graze on anterior surface of right knee"*).

---

## 6. Staff Escalation Workflow

When classroom tutors or front-desk staff receive a child welfare disclosure or observe an injury concern:

1. **Immediate Safety:** Ensure the child is in a safe, supportive environment. Provide immediate first aid if physical treatment is required.
2. **Do Not Record in General Student Notes:** Never type sensitive safeguarding disclosures into ordinary student progress notes or public communication logs.
3. **Escalate to Appointed Staff:** Report the observation directly and in person to your centre's designated safeguarding lead or operational manager.
4. **CMS Recording:** An authorised Manager or Owner can then record the restricted safeguarding entry in `/dashboard/incidents`.
5. **External Referrals:** Follow your organisation's safeguarding policy and local escalation procedures regarding any statutory or external reporting.

---

## 7. Incidents & Safeguarding Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| **Safeguarding option does not appear in incident dropdown** | User is logged in with `FRONT_DESK` or `TUTOR` role. | In SprintScale CMS, safeguarding records can only be created by users with `MANAGER` or `ORG_OWNER` roles. Report the concern directly to an appointed Manager. |
| **Accidental safeguarding note saved as general accident** | Staff member selected `Accident` instead of `Safeguarding`. | A Manager must review the entry, create the correct restricted `Safeguarding` record, and resolve or remove the misplaced accident record. |
| **Parent asks to view a restricted safeguarding record** | Safeguarding records are restricted internal welfare files. | Follow your organisation's data protection and safeguarding policy. Do not disclose confidential child protection logs through standard operational channels. |
| **Incident list appears empty** | Active centre filter is set to a different venue, or the record belongs to an archived/soft-deleted child. | Verify the centre switcher in the top navigation bar. Note that soft-deleted children's records are automatically excluded from the active view. |
