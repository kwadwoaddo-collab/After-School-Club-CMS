# SprintScale CMS — Milestone D6D Batch 3 Video Production Log
**Produced Assets:** `SS-D6-V021` → `SS-D6-V030` (10 Essential Micro-Videos)
**Date:** 2026-08-30
**Milestone:** D6D Essential Training Video Production — Batch 3
**Environment:** Isolated Synthetic Training (`Oakridge Learning Club Ltd`)
**Resolution:** 1440 × 900 px (16:10 Desktop Viewport)
**Frame Rate:** 25 fps
**Audio:** Silent Instructional Video (0 Audio Streams)
**Security Guardrails:** `assertSafeTrainingEnvironment()` Verified | Production Mutations = 0 | Real PII = 0

---

## 1. Batch Asset Summary

| Video ID | Title | Module | Persona / Role | Starting Route | Duration | File Size | Video QA | Technical QA |
|---|---|---|---|---|---|---|---|---|
| `SS-D6-V021` | Managing Centre Bank Account Details | Centres / Billing | Eleanor Vance (Owner) | `/dashboard/centres/[id]/settings` | 11.44s | 711 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V022` | Inviting a New Staff Member via Email | Staff / Team | Eleanor Vance (Owner) | `/dashboard/staff/invite` | 12.72s | 895 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V023` | Accepting a Staff Email Invitation | Auth / Staff | Sophie Reed (Invited Staff) | `/accept-invite?token=[token]` | 19.64s | 1,490 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V024` | Scoping Staff Access Across Specific Centres | Staff / Team | Eleanor Vance (Owner) | `/dashboard/staff/[id]` | 14.72s | 956 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V025` | Updating Staff Role & Privileges | Staff / Team | Eleanor Vance (Owner) | `/dashboard/staff/[id]` | 12.36s | 931 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V026` | Safely Deactivating a Staff Member | Staff / Team | Eleanor Vance (Owner) | `/dashboard/staff/[id]` | 13.08s | 1,047 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V027` | Broadcasting an Email to Consented Parents | Communications | Marcus Sterling (Manager) | `/dashboard/communications` | 13.60s | 999 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V028` | Moving a Family to the 30-Day Recovery Bin | Parents / People | Chloe Bennett (Front Desk) | `/dashboard/parents/[id]` | 13.20s | 925 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V029` | Restoring an Archived Family from Bin | Parents / People | Chloe Bennett (Front Desk) | `/dashboard/parents/bin` | 13.00s | 749 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |
| `SS-D6-V030` | Irreversible Permanent GDPR Family Purge | Parents / People | Eleanor Vance (Owner) | `/dashboard/parents/bin` | 12.68s | 693 KB | **CERTIFIED** | **PASS** (1440×900, 25fps) |

---

## 2. Representative Frame Semantic Timestamps Table

All representative review frames are extracted at semantic timestamps tailored to the specific instructional sequence inside each video:

| Video ID | Title | Total Duration | Phase 1 (Start) | Phase 2 (Key Action) | Phase 3 (End State) |
|---|---|---|---|---|---|
| `SS-D6-V021` | Managing Centre Bank Account Details | 11.44s | `02.50s` | `07.00s` | `11.50s` |
| `SS-D6-V022` | Inviting a New Staff Member via Email | 12.72s | `02.50s` | `07.00s` | `12.00s` |
| `SS-D6-V023` | Accepting a Staff Email Invitation | 19.64s | `02.50s` | `06.50s` | `11.50s` |
| `SS-D6-V024` | Scoping Staff Access Across Specific Centres | 14.72s | `02.50s` | `07.00s` | `11.50s` |
| `SS-D6-V025` | Updating Staff Role & Privileges | 12.36s | `02.50s` | `07.00s` | `11.50s` |
| `SS-D6-V026` | Safely Deactivating a Staff Member | 13.08s | `02.50s` | `07.00s` | `11.50s` |
| `SS-D6-V027` | Broadcasting an Email to Consented Parents | 13.60s | `02.50s` | `07.50s` | `12.50s` |
| `SS-D6-V028` | Moving a Family to the 30-Day Recovery Bin | 13.20s | `03.00s` | `07.00s` | `12.00s` |
| `SS-D6-V029` | Restoring an Archived Family from Bin | 13.00s | `02.50s` | `06.50s` | `12.00s` |
| `SS-D6-V030` | Irreversible Permanent GDPR Family Purge | 12.68s | `02.50s` | `07.00s` | `12.50s` |

---

## 3. Detailed Instructional & Technical Profiles

### `SS-D6-V021`
- **Canonical Title:** Managing Centre Bank Account Details
- **Module:** Centres / Billing
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`)
- **Start Route:** `/dashboard/centres/[id]/settings`
- **Teaching Objective:** Demonstrates how organisation owners configure centre-level banking information for parent tuition payments, navigating to the Billing & Financial tab, entering sort code and account number, triggering the dirty state notification bar, and persisting the financial settings.
- **Key Action:** Entering Sort Code (`20-04-01`) and Account Number (`83920194`), clicking `Save changes` in the sticky action bar.
- **End State:** Financial configuration saved, "Unsaved changes" bar dismissed, updated bank details visible.
- **Duration / Size:** 11.44s | 727,889 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V022`
- **Canonical Title:** Inviting a New Staff Member via Email
- **Module:** Staff / Team
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`)
- **Start Route:** `/dashboard/staff/invite`
- **Teaching Objective:** Demonstrates inviting a new team member by filling in their full name, email, assigning initial centre access, selecting their role privileges (Front Desk), and dispatching the cryptographic email invite.
- **Key Action:** Filling `sophia.williams@example.test`, first name `Sophia`, last name `Williams`, selecting Front Desk role, and clicking `Send invitation`.
- **End State:** Form submitted, redirected to Staff Management directory on Pending Invites tab with `sophia.williams@example.test` rendered in pending list.
- **Duration / Size:** 12.72s | 915,941 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V023`
- **Canonical Title:** Accepting a Staff Email Invitation
- **Module:** Auth / Staff
- **Persona / Role:** Sophie Reed (Invited Staff Member)
- **Start Route:** `/accept-invite?token=[token]`
- **Teaching Objective:** Demonstrates the new staff onboarding journey, opening a secure cryptographic invitation link, verifying assigned organisation and role details, clicking Join Team, generating the session, and landing directly in the authenticated Staff Dashboard.
- **Key Action:** Clicking `Join Team` / `Enter Dashboard` on the invitation card.
- **End State:** Authenticated landing on the Staff Dashboard view showing active session and club overview.
- **Duration / Size:** 19.64s | 1,525,553 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V024`
- **Canonical Title:** Scoping Staff Access Across Specific Centres
- **Module:** Staff / Team
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`)
- **Start Route:** `/dashboard/staff/[id]` (Chloe Bennett)
- **Teaching Objective:** Demonstrates multi-site access governance by granting staff permission across specific operating venues without elevating overall role privileges.
- **Key Action:** Checking `Oakridge Riverside` centre assignment checkbox in Chloe Bennett's profile and clicking `Save changes`.
- **End State:** Profile updated, banner confirms changes saved, header badge reflects multi-centre assignment (2 centres).
- **Duration / Size:** 14.72s | 979,379 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V025`
- **Canonical Title:** Updating Staff Role & Privileges
- **Module:** Staff / Team
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`)
- **Start Route:** `/dashboard/staff/[id]` (Liam Harper)
- **Teaching Objective:** Demonstrates promoting or adjusting staff authorization levels, switching role from Tutor to Front Desk, verifying updated permission scopes, and saving the profile.
- **Key Action:** Clicking `Front Desk` role card in StaffRoleSelector, verifying updated capability list, and clicking `Save changes`.
- **End State:** Profile updated, green confirmation banner displayed, role badge updated to Front Desk.
- **Duration / Size:** 12.36s | 953,293 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V026`
- **Canonical Title:** Safely Deactivating a Staff Member
- **Module:** Staff / Team
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`)
- **Start Route:** `/dashboard/staff/[id]` (Alex Morgan)
- **Teaching Objective:** Demonstrates the secure deactivation workflow for departing employees, reviewing active session revocation warnings, confirming removal via modal, and verifying immediate exclusion from the active staff directory.
- **Key Action:** Clicking `Remove from organisation`, reviewing deactivation impact modal, and clicking `Yes, remove access`.
- **End State:** Staff member deactivated, redirected to active Staff list with Alex Morgan removed.
- **Duration / Size:** 13.08s | 1,071,795 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V027`
- **Canonical Title:** Broadcasting an Email to Consented Parents
- **Module:** Communications
- **Persona / Role:** Marcus Sterling (`MANAGER`)
- **Start Route:** `/dashboard/communications`
- **Teaching Objective:** Demonstrates composing and dispatching multi-recipient announcements to parents who have opted in under GDPR communication consent rules, reviewing recipient counts, and verifying the audit log history.
- **Key Action:** Typing broadcast Subject and Message Body, verifying consented recipient counter, and clicking `Send Broadcast`.
- **End State:** Broadcast queued successfully, transitioned to History & Audit Log tab displaying dispatched communication.
- **Duration / Size:** 13.60s | 1,023,327 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V028`
- **Canonical Title:** Moving a Family to the 30-Day Recovery Bin
- **Module:** Parents / People
- **Persona / Role:** Chloe Bennett (`FRONT_DESK`)
- **Start Route:** `/dashboard/parents/[id]` (James Walker)
- **Teaching Objective:** Demonstrates soft-deleting a family record into the 30-day safety retention bin, explaining that bookings and children are safely archived rather than destroyed, and confirming the action.
- **Key Action:** Clicking `Delete family`, reading the 30-day retention notice dialog, and clicking `Move to bin`.
- **End State:** Family soft-deleted, redirected to Parents directory with green confirmation banner (`Parent deleted successfully`) and James Walker excluded from active listing.
- **Duration / Size:** 13.20s | 947,306 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V029`
- **Canonical Title:** Restoring an Archived Family from Bin
- **Module:** Parents / People
- **Persona / Role:** Chloe Bennett (`FRONT_DESK`)
- **Start Route:** `/dashboard/parents/bin`
- **Teaching Objective:** Demonstrates navigating to the Recovery Bin, locating a soft-deleted family (`Rachel Taylor`), reviewing expiration timelines, clicking Restore, and returning the family to active rosters.
- **Key Action:** Locating Rachel Taylor in Recovery Bin table, clicking `Restore`, and confirming `Yes, restore` in the modal dialog.
- **End State:** Confirmation modal closes, Recovery Bin table updates with Rachel Taylor removed and restored to active records.
- **Duration / Size:** 13.00s | 767,064 bytes
- **QA Verdict:** CERTIFIED.

### `SS-D6-V030`
- **Canonical Title:** Irreversible Permanent GDPR Family Purge
- **Module:** Parents / People
- **Persona / Role:** Eleanor Vance (`ORG_OWNER`)
- **Start Route:** `/dashboard/parents/bin`
- **Teaching Objective:** Demonstrates the owner-only Right-to-Erasure permanent deletion workflow under GDPR, locating an archived record in the Recovery Bin (`Hannah Scott`), clicking the destructive purge icon, confirming irreversible destruction, and executing the hard purge.
- **Key Action:** Clicking `Delete forever` trash icon on Hannah Scott's row, reading the red irreversible destruction warning modal, and clicking `Delete forever`.
- **End State:** Confirmation modal dismissed, Hannah Scott permanently erased and purged from database and Recovery Bin view.
- **Duration / Size:** 12.68s | 709,093 bytes
- **QA Verdict:** CERTIFIED.

---

## 4. Contact Sheet & Storyboard Artifact

- **Contact Sheet Path:** `project-notes/documentation-training/assets/review/d6d-batch-3-video-contact-sheet.png`
- **Extracted Frames Directory:** `project-notes/documentation-training/assets/review/d6d-batch-3-frames/` (30 high-resolution PNG frames)
- **Total Production Video Size (Batch 3):** 9.77 MB across 10 MP4 videos
