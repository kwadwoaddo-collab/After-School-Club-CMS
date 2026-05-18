# Finance Dashboard & Reconciliation: Audit and Modernization Plan

## 1. System Audit

### 1. Current Invoice Lifecycle
*   **Draft**: Created manually by staff via the Finance Ledger UI (`createInvoice` server action).
*   **Sent**: Expected next state, but currently no automated email dispatch is implemented.
*   **Partially Paid / Paid**: Automatically calculated when manual payments are recorded.
*   **Void**: Can be voided by Org Owners. Preserves invoice and payments but removes it from active revenue.
*   **Deleted**: Only possible if no payments are attached.

### 2. Current Payment Lifecycle
*   Payments are **100% manual**.
*   Staff must receive funds externally (Bank, Stripe, Cash), find the invoice in the CMS, and click "Record Payment".
*   Payments append to the `payments` table and automatically update the parent invoice status.

### 3. Current Stripe Integration Flow
*   The codebase (`src/lib/services/stripe.ts`) currently only handles **Platform B2B Subscriptions** (Org Owners paying for the CMS).
*   There is **no Stripe checkout integration for parents** to pay invoices. When staff select "Stripe" as a payment method, it implies they manually verified a payment on the external Stripe dashboard.

### 4. How Receipts are Generated
*   Receipts are generated dynamically on the client using `@react-pdf/renderer` (`ReceiptTemplate.tsx`).
*   The "Receipt" button only appears after at least one payment is recorded against the invoice.

### 5. Existing Finance Pages/Components/Actions
*   `/dashboard/finance`: Ledger overview, high-level stats (Total Billed, Pending, Collections). Contains dummy buttons for CSV Export and Tax Summary.
*   `/dashboard/finance/invoices/[id]`: Detailed view, payment history, PDF generation.
*   Actions (`src/features/finance/actions.ts`): `createInvoice`, `recordPayment`, `voidInvoice`, `deleteInvoice`.

### 6. Current Reconciliation Process
*   Highly manual and disconnected. Staff must cross-reference external bank statements with the CMS ledger and manually record each payment. 
*   No automated statement matching.

### 7. Current Weaknesses & Bottlenecks
*   **Manual Data Entry**: High risk of human error when recording amounts or selecting invoices.
*   **Missing Features**: The "Export Ledger" and "Tax Summary" buttons on the dashboard are purely cosmetic and do not function.
*   **Lack of Automation**: No way for parents to self-serve payments via the portal.

### 8. Risks around Duplicate Invoices/Payments
*   No concurrency locks on `recordPayment`. Double-clicking could potentially record duplicate payments.
*   No system safeguards to prevent invoicing the same child twice for the same booking/period.
*   Overpayments are swallowed (if a parent pays £100 on a £80 invoice, it just marks it as `paid`, with no credit generated).

### 9. Missing Audit Trails
*   Although an `audit_events` table exists in the schema, the finance actions (`createInvoice`, `recordPayment`, `voidInvoice`) **do not write to it**. They only update the `updatedAt` timestamp. 

### 10. Multi-Centre Finance Limitations
*   The ledger aggregates all invoices for the Organisation. There is no UI filtering to view revenue or pending invoices by specific Centres.
*   Bank details are stored per-centre, but without Stripe Connect, multi-centre automated payment routing is impossible.

### 11. Parent Balance Handling
*   Non-existent. Balances are strictly tracked per-invoice. There is no concept of a "Parent Account Balance" or "Wallet" for handling credits, prepayments, or overpayments.

### 12. Refund/Cancellation Handling
*   No native refund workflow. 
*   If an invoice is voided, the associated payments are preserved "for audit purposes", but there is no mechanism to issue a refund or a credit note.

### 13. Reporting/Export Limitations
*   Reporting is limited to the three hardcoded stats cards on the dashboard. No date filtering, no CSV exports, no aging reports.

---

## 2. Phased Modernization Plan

The goal is to incrementally upgrade the finance engine without disrupting the existing manual workflows. 

### Phase F1: Foundation & Visibility (Safest First Steps)
*   **Audit Logging Integration**: Update `actions.ts` to log all creations, payments, and voids to the `audit_events` table.
*   **Functional Exports**: Implement the actual CSV Ledger Export utility.
*   **Reconciliation Helpers**: Add double-click prevention on payment submission and UI warnings for overpayments.
*   **Dashboard Filters**: Add simple Centre and Date-Range dropdowns to the Finance Dashboard.

### Phase F2: Reporting & Aging
*   **Invoice Aging Report**: Add a view to track 30/60/90 days overdue invoices.
*   **Parent Ledger View**: Aggregate a parent's total outstanding balance across all their invoices.
*   **Revenue KPIs**: Enhanced charts/graphs for collections over time.

### Phase F3: Operational Tooling & Credits
*   **Refund Workflow**: Create a `refundPayment` action that records a negative payment and updates the invoice.
*   **Credit Notes**: Introduce a mechanism to handle overpayments and credit them to future invoices.
*   **Audit UI**: Expose the `audit_events` history directly on the invoice detail page.

### Phase F4: Advanced Automation
*   **Parent Stripe Checkout**: Generate Stripe payment links for invoices that parents can pay directly from the Parent Portal.
*   **Stripe Webhooks**: Listen for `checkout.session.completed` (parent payments) and automatically trigger `recordPayment`.
*   **Automated Matching**: Reconcile automated payments against invoices instantly.

---

## 3. Safest First Implementation (Phase F1 Start)

**Objective:** Implement Audit Trails and the CSV Export tool.

**Why is it safe?**
*   It requires **zero schema changes** (the `audit_events` table already exists).
*   It does not alter the current invoicing or payment math.
*   It replaces dummy UI elements with real functionality.

**Files Likely Affected:**
*   `src/features/finance/actions.ts` (Inject `tx.insert(auditEvents)` into existing functions).
*   `src/app/dashboard/finance/page.tsx` (Wire up the Export CSV button).
*   `src/features/finance/components/FinanceDashboardClient.tsx` (Add client-side CSV generation or API call).

**Test Strategy:**
1.  **Unit Tests**: Verify that calling `recordPayment` creates exactly one `audit_event` with the correct `event_type`.
2.  **Integration**: Ensure the CSV export outputs the correct number of rows matching the DB state, with correct column headers (Invoice Number, Amount, Status, etc.).
3.  **Manual QA**: Perform a manual payment and verify the UI does not crash and the audit log is recorded in the DB.
