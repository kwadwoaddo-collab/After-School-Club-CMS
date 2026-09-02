# SprintScale CMS — Functional Manual: Children & Students
## Comprehensive Pupil 360°, Medical Profiles, Consents & Academic Records

---

## 1. What This Module Is For

The **Children & Students Module** (`/dashboard/students`) is the central student information management hub for your club organisation.

It enables staff to:
- Maintain full 360° pupil profiles (demographics, year group, school attended).
- Monitor life-saving medical disclosures, severe allergies, dietary requirements, and GP details.
- Record parental consents (Photography, Sun Cream, First Aid emergency treatment).
- Maintain verified **Authorised Collectors** with secure collection passwords.
- Set live operational classroom flags (Homework, Behaviour, Flag Notes).
- Track student progress timelines and assessment scorecards.
- Enforce strict separation between everyday educational notes and confidential **Safeguarding** files.

---

## 2. Canonical Terminology: "Child" vs. "Student"

In SprintScale CMS, these terms are used contextually for the same underlying entity:
- **Child:** Used in administrative, family, medical, and registration contexts (e.g. "Add Child", "Parent & Child Link", "Child Medical Notes").
- **Student:** Used in classroom, attendance, academic, and progress contexts (e.g. "Student Directory", "Student Notes", "Student Roll Call").

---

## 3. Who Can Use It (Role Permissions)

| User Role | View Directory (`/dashboard/students`) | View Full Profile (`/dashboard/students/[id]`) | Add / Edit Student | Bulk CSV Import (`/dashboard/students/import`) | Roll Call Attendance Card View |
|---|---|---|---|---|---|
| **Owner** (`ORG_OWNER`) | ✅ Full (All Centres) | ✅ Full Access | ✅ Full Access | ✅ Full Access | ✅ Full Access |
| **Manager** (`MANAGER`) | ✅ Centre-Scoped | ✅ Centre-Scoped | ✅ Centre-Scoped | ✅ Centre-Scoped | ✅ Centre-Scoped |
| **Front Desk** (`FRONT_DESK`)| ✅ Centre-Scoped | ✅ Centre-Scoped | ✅ Centre-Scoped | ✅ Centre-Scoped | ✅ Centre-Scoped |
| **Tutor** (`TUTOR`) | ❌ No Access | ❌ No Access | ❌ No Access | ❌ No Access | ✅ Card View Only |
| **Parent** (Consumer Auth) | ❌ No Access | ❌ No Access | ❌ No Access | ❌ No Access | ✅ Own Children Only |

> [!NOTE]
> Tutors do not access the full administrative Student Directory (`/dashboard/students`). Tutors see operational student data (medical badges, allergies, emergency flags, and notes) directly on the **Roll Call Attendance Register** (`/dashboard/attendance`) and **Tablet Kiosk** (`/dashboard/kiosk`).

---

## 4. Student Profile 360° Anatomy

![Figure — Student Profile Card displaying medical conditions, allergies, and GP contact info](/training/assets/screenshots/annotated/SS-D6-S006.png)
*Figure 3.1 — Student Profile Card*

📹 **Video Walkthrough:** [Watch: Updating Pupil Medical & Allergy Profiles](/training/assets/videos/SS-D6-V036.mp4)

```
┌─────────────────────────────────────────────────────────────┐
│                   STUDENT PROFILE ANATOMY                   │
├─────────────────────────────────────────────────────────────┤
│  • Demographics: First Name, Last Name, DOB, School Year    │
│  • Centre & School: Assigned Club Centre, Enrolled School   │
│  • Family Link: Primary Parent Contact, Address, Phone      │
│  • Medical Alert Banner: Severe Allergies, Asthma, EpiPen   │
│  • Dietary Needs: Vegetarian, Halal, Nut-Free, Dairy-Free   │
│  • Doctor Details: GP Name, GP Surgery Phone Number         │
│  • Special Needs (SEN): Special Educational Needs Summary   │
│  • Consents: Photo Consent, Sun Cream, Emergency First Aid  │
│  • Authorised Collectors: Named Adults & Pickup Passwords   │
│  • Operational Flags: Homework flag, Behaviour flag, Notes  │
│  • Academic Progress: Assessment Scorecards, Progress Notes │
│  • Attendance History: Statutory check-in/out timestamps    │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Adding a Student Manually

**Who Can Do This:** Owner, Manager, Front Desk

**Steps:**
1. Navigate to: `Sidebar → Students → [+ Add Student]` (`/dashboard/students/add`).
2. **Section 1: Child Demographics**
   - Enter **First Name** and **Last Name** (Required).
   - Enter **Date of Birth** (e.g. `2018-05-14`).
   - Select **School Year** (e.g. `Year 1`, `Year 2`, `Reception`).
   - Select the assigned **Centre**.
3. **Section 2: Parent / Guardian Link**
   - Select an existing parent from the search dropdown, or toggle **Create New Parent** to enter parent contact details simultaneously.
4. **Section 3: Medical & Dietary Disclosures**
   - Check any known **Allergies** (e.g. *Peanuts*, *Dairy*, *Eggs*, *Latex*, *Bee Stings*).
   - Enter **Medical Conditions** (e.g. *Asthma — Inhaler in bag*).
   - Enter **Dietary Requirements** (e.g. *Halal only*).
   - Enter **GP Name** and **GP Phone Number**.
5. **Section 4: Parental Consents**
   - Toggle **Photo Consent**, **Sun Cream Consent**, and **First Aid Treatment Consent**.
6. **Section 5: Authorised Collectors**
   - Add adult pickup names, relationships, and emergency contact numbers.
   - Enter an optional **Collection Password** (e.g. *Dolphin22*).
7. Click **Save Student**.

**Expected Result:**
The student profile is created, linked to the parent, and instantly available for bookings and daily roll-call registers.

---

## 6. Bulk Importing Students via CSV

**Who Can Do This:** Owner, Manager, Front Desk

**Steps:**
1. Navigate to: `Sidebar → Students → [Import CSV]` (`/dashboard/students/import`).
2. Download the provided CSV template file.
3. Prepare your spreadsheet with columns:
   `firstName`, `lastName`, `dateOfBirth`, `schoolYear`, `parentFirstName`, `parentLastName`, `parentEmail`, `parentPhone`, `allergies`, `dietaryRequirements`, `emergencyContactName`, `emergencyContactPhone`.
4. Upload the completed CSV file.
5. Review the pre-import preview table to verify column mapping and validate zero formatting errors.
6. Click **Confirm & Import Students**.

---

## 7. Managing Medical Alerts & Severe Allergies

![Figure — Student Directory showing high-visibility allergy and dietary warning badges](/training/assets/screenshots/annotated/SS-D6-S005.png)
*Figure 3.2 — Student Directory Allergy Badges*

> [!SAFEGUARDING]
> Medical alerts are life-safety items. Whenever a medical condition is entered or modified, it immediately reflects across all live roll-call registers and kiosk interfaces with high-contrast alert badges.

### How Medical Badges Display in SprintScale:
- 🔴 **Red Alert Badge (Medical / Severe Allergy):** Appears next to the student's name on attendance registers if the student has severe allergies (e.g. *Nut Allergy*), requires an EpiPen, has asthma, or has recorded medical conditions.
- 🟡 **Yellow Alert Badge (Dietary):** Appears if the student has special dietary requirements (e.g. *Gluten-Free*, *Vegetarian*).
- 🔵 **Blue Alert Badge (SEN):** Appears if the student has Special Educational Needs support notes.

---

## 8. Authorised Collectors & Pickup Passwords

To prevent unauthorised child collection:
1. Open: `Sidebar → Students → [Select Student]`.
2. Scroll to the **Authorised Collectors** section.
3. Click **+ Add Collector**.
4. Enter the collector's full name, relationship to child (e.g. *Grandmother*, *Aunt*, *Neighbour*), and contact phone number.
5. Set a **Collection Password**.
6. When an unfamiliar adult arrives at pickup time, front-desk staff ask for the password and verify it against this profile before tapping **Check Out**.

---

## 9. Operational Flags vs. Confidential Safeguarding Files

SprintScale enforces strict separation between classroom notes and child protection records:

```
┌─────────────────────────────────────────────────────────────┐
│                 CLASSROOM NOTES & OPERATIONAL FLAGS         │
│  • Homework Flag & Behaviour Flag (Toggled by Tutors)       │
│  • Progress Notes & Scorecards (Viewable by All Staff)      │
│  • General Classroom Activity Observations                  │
└──────────────────────────────┬──────────────────────────────┘
                               │  STRICT SECURITY BOUNDARY
┌──────────────────────────────▼──────────────────────────────┐
│                CONFIDENTIAL SAFEGUARDING FILES              │
│  • Authorised ONLY in `/dashboard/incidents`                │
│  • Visible ONLY to Managers and Owners (DSLs)               │
│  • Encrypted Audit Log — Completely hidden from Tutors       │
└─────────────────────────────────────────────────────────────┘
```

> [!SAFEGUARDING]
> **Never enter child protection disclosures into student general notes.** All safeguarding concerns must be escalated to the Centre Manager and recorded under the confidential **Safeguarding** category in `/dashboard/incidents`.

---

## 10. Archiving, Recovery & Permanent Purge

- **Archiving a Student:** Click **Archive Student** on the student profile. The student is moved to the Recovery Bin and removed from active roll calls.
- **Restoring a Student:** Open `Sidebar → Parents → Recovery Bin`, locate the record, and click **Restore**.
- **Permanent Purge:** Soft-deleted student records are permanently erased when the parent record is purged by the Organisation Owner.

---

## 11. Troubleshooting Student Profiles

| Problem | Cause | Resolution |
|---|---|---|
| **Student missing from today's attendance register** | Student is not booked for today's session, or is assigned to a different centre. | Check `Sidebar → Bookings` to schedule a session, or check the student's assigned centre. |
| **Allergy badge not appearing on roll call** | Allergy was entered as freeform text in general notes rather than in the Allergies field. | Open student profile, click **Edit**, add the allergy into the **Allergies** tag field, and save. |
| **Collector password not recognized** | Parent updated password in Parent Portal without informing collecting relative. | Verify parent contact details, call the primary parent on their registered number to verify identity. |
