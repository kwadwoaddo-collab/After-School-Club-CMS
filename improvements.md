

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
- **Status:** Pending
- **Location:** Finance -> Create Invoice
- **Feature:** Enhance the searchable dropdown to index both Student names and Parent names.
- **Logic:** 
  - If a **Child’s Name** is selected from the search results, the system must automatically resolve the link to their Parent and set that Parent as the "Billed To" entity.
  - Immediately populate the sibling checkbox list for that parent.
- **Goal:** Allow admins to find the correct billing account using only the child's name.

## [x] Task 75: Automatic Centre-Context Binding
- **Status:** Pending
- **Logic:** When a child (or family) is selected for an invoice, the system must retrieve the **Centre ID** associated with that child's registration.
- **Automation:** The invoice must automatically assign the branding, Ofsted registration, and Bank Details of **that specific centre** (Sydenham vs. Dagenham) to the generated PDF.
- **Goal:** Eliminate manual errors where a parent might be billed with the wrong centre's bank details.

## [x] Task 76: Multi-Centre Sibling Validation
- **Status:** Pending
- **Logic:** In the rare case that siblings are selected who attend different centres, the UI should prompt the Admin to select which Centre's invoice template/bank details should be used for the combined bill.

## [x] Task 77: Complete Centre Billing & Contact Details
- **Status:** Pending
- **Database:** Add `billing_phone` and `billing_email` fields to the `Centre` model.
- **Settings UI:** Update the 'Finance & Pricing' card to include input fields for:
  - Centre Billing Phone Number
  - Centre Billing Email Address
- **PDF Mapping:** Update the HASC PDF template (Invoice & Receipt) to:
  - Replace "Phone: —" with the dynamic `billing_phone`.
  - Replace "Email: —" with the dynamic `billing_email`.
  - Ensure **Ofsted No**, **Bank Details**, and **Manager Name** are correctly pulling from the database (currently showing N/A in the screenshot).
- **Goal:** Zero blank fields or "N/A" markers on generated documents.

## [ ] Task 78: Sync "Year Group" Dropdown with Existing App Pattern
- **Status:** Pending
- **Location:** Invoice Creator -> Legacy Onboarding Form (Children section)
- **Fix:** Update the "Year" dropdown to match the existing registration pattern exactly.
- **Labels:** 
  - Select year...
  - Reception
  - Y1, Y2, Y3, Y4, Y5, Y6, Y7, Y8, Y9, Y10, Y11, Y12, Y13
- **Goal:** Zero discrepancies between manual entry and automated registration data.
## [ ] Task 79: Implement Invoice Deletion & Voiding
- **Status:** Pending
- **Location:** Invoice Details Page / Finance List
- **Feature:** Add a "Delete" or "Void" action to existing invoices.
- **Safety Logic:** 
  - **Unpaid Invoices:** Can be permanently deleted from the database.
  - **Paid/Partially Paid Invoices:** If payments are attached, the system should ask to "Delete Payments first" or allow you to "Void" the invoice (status change only) to keep the financial history.
- **Security:** Ensure only the 'Owner' role can perform this action.
- **Goal:** Allow admins to correct mistakes or remove accidental duplicate invoices.

## [ ] Task 80: Add Centre Filtering to Registrations Page
- **Status:** Pending
- **Location:** /dashboard/registrations (Image 1)
- **UI (Stitch):** Add a filter bar to the top of the Registrations page, identical in style to the Bookings page.
- **Logic:** 
  - Add a dropdown to select a specific Centre (Sydenham, Dagenham, etc.).
  - When a centre is selected, the list of registrations must update to show ONLY that centre's submissions.
  - The "13 total submissions" counter must update to reflect the filtered count.

## [ ] Task 81: Synchronize Centre Filtering on Bookings Page
- **Status:** Pending
- **Location:** /dashboard/bookings (Image 2)
- **Logic:** Ensure the existing "All Centres" filter is fully functional. 
- **Requirement:** Selecting a centre must filter the table results on the backend and update the "Result Counter" (Task 62) immediately.
- **Persistence:** If I switch from Bookings to Registrations, consider "remembering" the selected centre so I don't have to filter again.