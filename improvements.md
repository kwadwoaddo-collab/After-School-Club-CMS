

## [x] Task 70: HASC-Style PDF Generation (Invoice & Receipt)
- **Status:** Complete
- **Template:** Recreate the provided screenshots exactly.
- **Design:** Include the Blue Footer bar (logo/phone/address), the "CHILD CARE INVOICE" header, the period description, and the diagonal "HEATHWAY" watermark.
- **Receipt:** Ensure the Receipt (Image 2) displays the specific "Date of Payment" and "Amount Paid" in the table.

[x] Task 71: Family-Centric Invoicing
Status: Complete
Description: Refactored the invoice generator to a Parent-First model. Added a searchable parent dropdown and automatic sibling detection with multi-select checkboxes for combined invoices.

[x] Task 72: Legacy Onboarding Flow
Status: Complete
Description: Added a "Create New Family" flow within the invoice modal that instantly creates Parent and Children records in the database simultaneously with an invoice.

[x] Task 73: Family Ledger (Parent Profile)
Status: Complete
Location: /dashboard/parents/[id]
Description: Added a new Parent Profile page featuring a "Finance / Ledger" tab that displays consolidated family totals (Total Owed, Total Paid) and a unified transaction history. Added links to this profile from the Students list and Student profiles.

## [x] Task 74: Smart "Child-to-Parent" Search Logic
- **Status:** Complete
- **Location:** Finance -> Create Invoice
- **Feature:** Enhance the searchable dropdown to index both Student names and Parent names.
- **Logic:** 
  - If a **Child’s Name** is selected from the search results, the system must automatically resolve the link to their Parent and set that Parent as the "Billed To" entity.
  - Immediately populate the sibling checkbox list for that parent.
- **Goal:** Allow admins to find the correct billing account using only the child's name.

## [x] Task 75: Automatic Centre-Context Binding
- **Status:** Complete
- **Logic:** When a child (or family) is selected for an invoice, the system must retrieve the **Centre ID** associated with that child's registration.
- **Automation:** The invoice must automatically assign the branding, Ofsted registration, and Bank Details of **that specific centre** (Sydenham vs. Dagenham) to the generated PDF.
- **Goal:** Eliminate manual errors where a parent might be billed with the wrong centre's bank details.

## [x] Task 76: Multi-Centre Sibling Validation
- **Status:** Complete
- **Logic:** In the rare case that siblings are selected who attend different centres, the UI should prompt the Admin to select which Centre's invoice template/bank details should be used for the combined bill.

## [x] Task 77: Complete Centre Billing & Contact Details
- **Status:** Complete
- **Database:** Add `billing_phone` and `billing_email` fields to the `Centre` model.
- **Settings UI:** Update the 'Finance & Pricing' card to include input fields for:
  - Centre Billing Phone Number
  - Centre Billing Email Address
- **PDF Mapping:** Update the HASC PDF template (Invoice & Receipt) to:
  - Replace "Phone: —" with the dynamic `billing_phone`.
  - Replace "Email: —" with the dynamic `billing_email`.
  - Ensure **Ofsted No**, **Bank Details**, and **Manager Name** are correctly pulling from the database (currently showing N/A in the screenshot).
- **Goal:** Zero blank fields or "N/A" markers on generated documents.

## [x] Task 78: Sync "Year Group" Dropdown with Existing App Pattern
- **Status:** Complete
- **Location:** Invoice Creator -> Legacy Onboarding Form (Children section)
- **Fix:** Updated the "Year" dropdown placeholder from "Select..." to "Select year..." to match the existing pattern in BookingForm, register page, and EditRegistrationForm. Values (Reception, Y1–Y13) were already correct.
## [x] Task 79: Implement Invoice Deletion & Voiding
- **Status:** Complete
- **Location:** Invoice Details Page + Finance List
- **What was built:**
  - Created `ConfirmActionModal.tsx` — a polished, reusable confirmation modal with delete (red) and void (amber) variants, error display, and loading state
  - **Detail page** (`InvoiceDetailsClient.tsx`): replaced raw `window.confirm`/`alert` with `ConfirmActionModal`; Delete button now shows for all non-paid invoices (explains payment blocker in modal); Void button shows for all non-void invoices
  - **Finance list** (`FinanceDashboardClient.tsx`): added Void (amber) + Delete (red) icon buttons per row for Owners; wired to `ConfirmActionModal` with `router.refresh()` on success; also fixed void status badge display (`line-through` style)
- **Safety Logic:** Delete blocked (informational message) when payments exist; Void always allowed (preserves audit trail); both actions Owner-only (enforced server-side)

## [x] Task 80: Add Centre Filtering to Registrations Page
- **Status:** Complete
- **Location:** /dashboard/registrations
- **What was done:** The backend filtering was already fully implemented (server page reads `activeCentreId` via `resolveActiveCentreId`, which checks URL param then cookie; `RegistrationsFilters` already used `useCentreFilter` and included the centre in URL params; the stats counters already respected the filter). Added the missing **inline Centre dropdown** to `RegistrationsFilters.tsx`, matching the style of the Status filter — only shown when multiple centres exist. Selecting a centre updates `CentreFilterContext`, writes to cookie for persistence, and triggers `router.refresh()` so the server page re-renders with filtered results and an updated counter.

## [x] Task 81: Synchronize Centre Filtering on Bookings Page
- **Status:** Complete
- **Location:** /dashboard/bookings
- **Root cause:** `BookingsFilters` consumed `selectedCentreId` from `CentreFilterContext` and included it in `hasActiveFilters`/clear logic, but never rendered a centre `<select>` dropdown — so there was no in-page UI to switch centre.
- **Fix:** Added inline "All Centres / [Centre Name]" dropdown to `BookingsFilters.tsx` (between Search and Status), shown only when `centres.length > 1`. Selecting triggers `setSelectedCentreId` → writes `selected_centre_id` cookie → `router.refresh()` → server re-renders with `resolveActiveCentreId` picking up the new cookie → filtered table + updated counters.
- **Persistence:** Cookie-based via `CentreFilterContext`; switching from Bookings → Registrations and back retains the selected centre automatically.