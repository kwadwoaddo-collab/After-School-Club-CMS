# SprintScale CMS — Milestone D6B Batch 5 Production Log
**Batch Identifier:** D6B-BATCH-005 (Final Essential Screenshots)  
**Date:** 2026-08-28  
**Author:** SprintScale Visual Production Agent  
**Environment:** Oakridge Learning Trust Training Environment (`TRAINING_ENVIRONMENT=oakridge`)  
**Target Neon DB:** `ep-aged-morning-abr2278f.eu-west-2.aws.neon.tech` (`neondb`)  
**Viewport:** 1440 × 900 px  
**Annotation Style:** 3px dashed `#2563EB`, 4% fill tint, 14px numbered badge `#2563EB` with white text  

---

## 1. Batch Summary

Batch 5 represents the final production batch of canonical essential screenshots (`SS-D6-S041` through `SS-D6-S046`) for Milestone D6B. All 6 assets capture live UI views with verified synthetic data from the Oakridge Learning Trust seed dataset.

| Asset ID | Canonical Title | Route / View State | Authenticated Persona | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SS-D6-S041** | Staff Invitation Modal & Role Selection | `/dashboard/staff/invite` | Eleanor Vance (`ORG_OWNER`) | **CAPTURED — QA VERIFIED** |
| **SS-D6-S042** | Staff Centre Membership Assignment | `/dashboard/staff/[userId]` (Chloe Bennett) | Eleanor Vance (`ORG_OWNER`) | **CAPTURED — QA VERIFIED** |
| **SS-D6-S043** | Staff Deactivation Warning Modal | `/dashboard/staff/[userId]` (Liam Harper deactivation) | Eleanor Vance (`ORG_OWNER`) | **CAPTURED — QA VERIFIED** |
| **SS-D6-S044** | Parent Email Broadcast Composer | `/dashboard/communications` | Eleanor Vance (`ORG_OWNER`) | **CAPTURED — QA VERIFIED** |
| **SS-D6-S045** | Recovery Bin Soft-Deleted Families List | `/dashboard/parents/bin` | Eleanor Vance (`ORG_OWNER`) | **CAPTURED — QA VERIFIED** |
| **SS-D6-S046** | Permanent GDPR Purge Owner-Only Warning | `/dashboard/parents/bin` (Hard delete modal) | Eleanor Vance (`ORG_OWNER`) | **CAPTURED — QA VERIFIED** |

---

## 2. Asset Details & Annotation Semantics

### SS-D6-S041: Staff Invitation Modal & Role Selection
- **Source File:** `project-notes/documentation-training/assets/screenshots/source/SS-D6-S041-source.png`
- **Annotated File:** `project-notes/documentation-training/assets/screenshots/annotated/SS-D6-S041.png`
- **Description:** Form used by Organisation Owners to invite new staff members, configure their name and email, and choose their initial role tier.
- **Annotations:**
  - `①` **Role Selection Options:** Selectable role cards for Manager, Front Desk, and Tutor.
  - `②` **Staff Identity Fields:** Email Address input, First Name, and Last Name fields.
  - `③` **Centre-Level Access Notice:** Information banner explaining that centre assignment takes place as the immediate next step.

### SS-D6-S042: Staff Centre Membership Assignment
- **Source File:** `project-notes/documentation-training/assets/screenshots/source/SS-D6-S042-source.png`
- **Annotated File:** `project-notes/documentation-training/assets/screenshots/annotated/SS-D6-S042.png`
- **Description:** Detailed staff profile view for Chloe Bennett (`FRONT_DESK`), illustrating role management and centre assignment checkboxes.
- **Annotations:**
  - `①` **Staff Profile Summary Card:** Header displaying staff name, email, avatar, role pill, centres count, and join date.
  - `②` **Role & Access Matrix:** Full role configuration grid showing available permission tiers.
  - `③` **Centre Assignments Card:** Multi-centre checkboxes allowing granular scoping to Oakridge Central and/or Oakridge Riverside.

### SS-D6-S043: Staff Deactivation Warning Modal
- **Source File:** `project-notes/documentation-training/assets/screenshots/source/SS-D6-S043-source.png`
- **Annotated File:** `project-notes/documentation-training/assets/screenshots/annotated/SS-D6-S043.png`
- **Description:** High-risk deactivation confirmation modal dialog when removing access for a staff member (Liam Harper).
- **Annotations:**
  - `①` **Deactivation Confirmation Dialog:** Modal card titled "Remove Liam Harper?".
  - `②` **Deactivation Warning Text:** Notice explaining that account access is revoked immediately upon next page load while historical records remain intact.
  - `③` **Destructive Confirmation Button:** "Yes, remove access" action button.

### SS-D6-S044: Parent Email Broadcast Composer
- **Source File:** `project-notes/documentation-training/assets/screenshots/source/SS-D6-S044-source.png`
- **Annotated File:** `project-notes/documentation-training/assets/screenshots/annotated/SS-D6-S044.png`
- **Description:** Outbound parent broadcast interface allowing centre staff to draft announcements respecting GDPR communication consents.
- **Annotations:**
  - `①` **Compose Message Card:** Rich message drafting area containing Subject and Message Body.
  - `②` **Recipient Picker:** Target audience filter and GDPR recipient count display.
  - `③` **Send Broadcast Button:** Primary action trigger for outbound transmission.

### SS-D6-S045: Recovery Bin Soft-Deleted Families List
- **Source File:** `project-notes/documentation-training/assets/screenshots/source/SS-D6-S045-source.png`
- **Annotated File:** `project-notes/documentation-training/assets/screenshots/annotated/SS-D6-S045.png`
- **Description:** Recovery bin listing soft-deleted parent accounts under the 30-day retention policy prior to automated purging.
- **Annotations:**
  - `①` **Table Column Headers:** Header defining Family, Children, Deleted On, Expires In, and Actions columns.
  - `②` **Soft-Deleted Record Row:** Rachel Taylor record row showing 1 child and deletion date.
  - `③` **Expiry Countdown & Actions:** "25 days" retention countdown pill along with Restore and Hard Delete actions.

### SS-D6-S046: Permanent GDPR Purge Owner-Only Warning
- **Source File:** `project-notes/documentation-training/assets/screenshots/source/SS-D6-S046-source.png`
- **Annotated File:** `project-notes/documentation-training/assets/screenshots/annotated/SS-D6-S046.png`
- **Description:** Owner-only hard delete confirmation dialog enforcing GDPR irreversible data destruction.
- **Annotations:**
  - `①` **Permanent Deletion Dialog:** Confirmation modal titled "Permanently delete?".
  - `②` **GDPR Purge Warning:** Explicit warning stating that the record for Rachel Taylor and their children will be permanently destroyed and cannot be undone.
  - `③` **Destructive Action Notice / Trigger:** Red warning trigger and confirmation boundary.

---

## 3. Review Contact Sheet
The composite 6-up contact sheet has been generated at:
`project-notes/documentation-training/assets/review/d6b-batch-5-contact-sheet.png`
