# SprintScale CMS — Micro-Video Training Scripts
## Milestone D5: Administration, Multi-Centre Settings, Staff Access & Data Maintenance

**Scope:** Authoritative recording scripts for Milestone D6 video production.  
**Video Target Duration:** 30 seconds – 2 minutes per focused administrative task.  
**Standard Production Rules:** British English narration, clean synthetic demo accounts only, zero real staff/parent/child PII, 1440×900 desktop viewport, synchronized captions (SRT/VTT).

---

## Master Video Script Index

| Video ID | Title | Primary Audience | Importance | Target Duration |
|---|---|---|---|---|
| **D5-V01** | Creating a New Centre / Venue | Owner / Manager | **ESSENTIAL** | 60 Seconds |
| **D5-V02** | Configuring Venue Settings & Session Slots | Owner / Manager | **ESSENTIAL** | 60 Seconds |
| **D5-V03** | Configuring Centre Bank & Billing Details | Owner (`ORG_OWNER`) | **ESSENTIAL** | 45 Seconds |
| **D5-V04** | Inviting a New Staff Member via Email | Owner (`ORG_OWNER`) | **ESSENTIAL** | 60 Seconds |
| **D5-V05** | Accepting a Staff Invitation & Day-One Login | All Invited Staff | **ESSENTIAL** | 45 Seconds |
| **D5-V06** | Assigning Staff Members to Centres | Owner (`ORG_OWNER`) | **ESSENTIAL** | 45 Seconds |
| **D5-V07** | Changing a Staff Member's Role | Owner (`ORG_OWNER`) | STANDARD | 45 Seconds |
| **D5-V08** | Safely Removing a Staff Member | Owner (`ORG_OWNER`) | STANDARD | 45 Seconds |
| **D5-V09** | Sending an Email Broadcast to Parents | Owner / Manager | **ESSENTIAL** | 60 Seconds |
| **D5-V10** | Checking In-App Header Notifications | Owner / Manager | STANDARD | 30 Seconds |
| **D5-V11** | Running a GDPR Organisation Data Export | Owner (`ORG_OWNER`) | STANDARD | 45 Seconds |
| **D5-V12** | Moving a Family to the Recovery Bin | Owner / Manager / Front Desk | **ESSENTIAL** | 45 Seconds |
| **D5-V13** | Restoring a Family from the Recovery Bin | Owner / Manager / Front Desk | **ESSENTIAL** | 45 Seconds |
| **D5-V14** | Understanding Academic-Year Rollover | All Staff | STANDARD | 45 Seconds |

---

## Detailed Script Specifications

### D5-V01: Creating a New Centre / Venue
- **Audience:** Organisation Owners, Centre Managers
- **Importance:** **ESSENTIAL** | **Duration:** 60s
- **Starting Screen:** `/dashboard/centres`
- **Synthetic Data:** Name "St. Jude's Primary Club", Address "12 Church Lane, London, SE1 7PB".
- **Timeline & Click Sequence:**
  - `00:00 - 00:10`: Title Card. "How to create a new centre or club venue."
  - `00:10 - 00:25`: Open `/dashboard/centres`. Click **+ Add Centre** in top right.
  - `00:25 - 00:45`: Enter Name "St. Jude's Primary Club". Enter Address. Click **Create Centre**.
  - `00:45 - 01:00`: Show automatic redirection to the new Centre Settings page with generated URL slug.

---

### D5-V04: Inviting a New Staff Member via Email
- **Audience:** Organisation Owners (`ORG_OWNER`)
- **Importance:** **ESSENTIAL** | **Duration:** 60s
- **Starting Screen:** `/dashboard/staff`
- **Synthetic Data:** Email `jordan.demo@example.com`, First Name "Jordan", Last Name "Taylor", Role `FRONT_DESK`.
- **Timeline & Click Sequence:**
  - `00:00 - 00:10`: Title Card. "Inviting a new staff member to your organisation."
  - `00:10 - 00:25`: Open `/dashboard/staff`. Click **+ Invite Staff Member**.
  - `00:25 - 00:45`: Enter Email `jordan.demo@example.com`, Name "Jordan Taylor", select Role `Front Desk`. Select initial assigned centre.
  - `00:45 - 01:00`: Click **Send Invitation**. Explain the 7-day secure token email dispatch and show the green success notification.

---

### D5-V09: Sending an Email Broadcast to Parents
- **Audience:** Organisation Owners, Centre Managers
- **Importance:** **ESSENTIAL** | **Duration:** 60s
- **Starting Screen:** `/dashboard/communications`
- **Synthetic Data:** Centre "All Centres", Subject "October Holiday Club Bookings Now Open", Message "Bookings for our autumn holiday club are now live."
- **Timeline & Click Sequence:**
  - `00:00 - 00:10`: Title Card. "Broadcasting announcements to consented parents."
  - `00:10 - 00:25`: Open `/dashboard/communications`. Select Centre filter and Audience.
  - `00:25 - 00:45`: Enter Subject and Message body. Highlight the server-side consent filter summary.
  - `00:45 - 01:00`: Click **Send Broadcast**. Show the item appear in Broadcast History with live delivery tallies.

---

### D5-V12: Moving a Family to the Recovery Bin
- **Audience:** Owners, Managers, Front Desk
- **Importance:** **ESSENTIAL** | **Duration:** 45s
- **Starting Screen:** `/dashboard/parents/[id]`
- **Synthetic Data:** Parent "Alex Example", Child "Jamie Example".
- **Timeline & Click Sequence:**
  - `00:00 - 00:10`: Title Card. "Safely archiving a family to the Recovery Bin."
  - `00:10 - 00:25`: Open parent profile. Scroll to bottom and click **Delete Family**.
  - `00:25 - 00:35`: Review 30-day recovery dialog. Click **Confirm Delete**.
  - `00:35 - 00:45`: Navigate to `/dashboard/parents/bin` and show the record listed with its 30-day expiration timer.
