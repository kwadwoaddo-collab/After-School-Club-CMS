# Finance Phase F2: Dashboard Audit & Design MVP

## 1. Current System Inspection

### 1. Current KPIs Available
*   **Total Billed**: Hard sum of all invoice amounts ever generated.
*   **Pending Invoices**: Raw count of invoices where status is not `paid`.
*   **Collections**: Hard sum of all manual payment amounts recorded.

### 2. Missing KPIs
*   Outstanding Balance (Total Billed minus Collections).
*   Overdue Invoices (Count & Amount).
*   Monthly Recurring Revenue / Payments this month.
*   Voided/Bad Debt totals.
*   Average Payment Delay (Days between invoice creation and full payment).
*   Revenue split by Centre.

### 3. Current Invoice States
*   `draft`, `sent`, `partially_paid`, `paid`, `void`.

### 4. Current Payment States
*   No states exist for payments. Because payments are recorded manually, they are implicitly assumed to be "successful" the moment they are inserted.

### 5. Current Overdue Handling
*   Non-existent. The schema supports a `dueDate` column on the `invoices` table, but the dashboard does not flag, highlight, or sort by overdue status.

### 6. Existing Filters/Search
*   **Client-Side Search**: A basic text search filters the 10 loaded `recentInvoices` by `invoiceNumber` or parent name.
*   **Filter Button**: The UI has a "Filter" button, but it is currently a dummy UI element.

### 7. Current Centre-Level Finance Visibility
*   Zero visibility. The dashboard queries `eq(invoices.organisationId, session.user.organisationId)`, aggregating data across all centres globally. 

### 8. Current Parent Balance Visibility
*   Zero visibility. Invoices are strictly independent objects. If a parent has 3 unpaid invoices, staff must manually add them up.

### 9. Current Ledger Limitations
*   The dashboard table only shows the 10 most recent invoices.
*   There is no pagination or "View All" page implemented yet.

### 10. Current Performance Risks (Critical Bottleneck)
*   The dashboard `page.tsx` fetches **every invoice and every payment ever created** into Node.js memory just to calculate three numbers:
    ```typescript
    const allInvoices = await db.query.invoices.findMany({ ... with: { payments: true } });
    ```
*   As the dataset grows (thousands of invoices), this will crash the Vercel serverless function due to memory limits and extreme latency.

---

## 2. Finance Dashboard MVP Design

### Recommended Dashboard Layout

**Row 1: Global Health (The "Big Numbers")**
*   **Total Outstanding**: `£X,XXX` (Primary focus, red if high)
*   **Overdue Amount**: `£X,XXX` (Secondary focus, dark red)
*   **Collections (30 Days)**: `£X,XXX` (Green)
*   **Total Billed (YTD)**: `£X,XXX` (Neutral)

**Row 2: Operational Widgets (Split 60/40)**
*   **Left (60%)**: *Actionable Tables* (Tabs: "Overdue Invoices", "Unpaid by Parent", "Recent Invoices").
*   **Right (40%)**: *Insights & Feeds* (Tabs: "Recent Payments Feed", "Aging Buckets (0-30, 31-60, 60+)").

**Row 3: Analytics (Bottom)**
*   Revenue by Centre (Simple bar chart or list).

### Phased Implementation Plan (F2)

#### Step 1: SQL Optimization & Core KPIs (Safest First Implementation)
*   **Goal**: Replace the dangerous `findMany` JS `reduce` with efficient Drizzle SQL `sum()` and `count()` queries.
*   **Add**: Outstanding Balance and Overdue Count.
*   **Risk**: Extremely low. Replaces slow code with fast code without changing the UI layout drastically.

#### Step 2: The Overdue Engine
*   **Goal**: Highlight invoices where `dueDate < NOW()` and status is not `paid`.
*   **Add**: "Overdue Invoices" specific table tab. Add visual red tags to overdue items in the ledger.

#### Step 3: Parent Balances & Aging
*   **Goal**: Group outstanding debt by parent.
*   **Add**: "Unpaid Balances by Parent" widget (groups invoices by `parentId` and sums `amount - paid`). Add Aging buckets.

#### Step 4: Centre Level Filtering
*   **Goal**: Allow managers to view the dashboard through a specific Centre's lens.
*   **Add**: URL-param based filtering (`?centreId=123`) that applies to all SQL aggregation queries.

### Query & Performance Considerations

*   **Avoid ORM Joins for Stats**: We must use raw or Drizzle SQL aggregations:
    ```typescript
    const totalBilled = await db.select({ value: sum(invoices.amount) })
                                .from(invoices)
                                .where(eq(invoices.organisationId, orgId));
    ```
*   **Caching Strategy**: 
    *   Since finance dashboards need to be relatively fresh, long-lived caching is risky.
    *   Instead, Next.js `unstable_cache` with a 60-second `revalidate` time for heavy aggregate stats (like Revenue by Centre or Total YTD) is recommended, while the "Overdue" list remains dynamic.

### Files Likely Affected
1.  `src/app/dashboard/finance/page.tsx` (Complete rewrite of the data fetching logic to use SQL aggregations).
2.  `src/features/finance/components/FinanceDashboardClient.tsx` (Updating the layout to support new KPI cards and Tabs).
3.  `src/features/finance/components/FinanceWidgets.tsx` (New file: To encapsulate the Overdue Table, Recent Payments Feed, etc.).
4.  `src/features/finance/queries.ts` (New file: To house complex Drizzle SQL aggregations cleanly out of the server component).

### Test Strategy
1.  **Data Mocking**: Seed the local database with 50 invoices (some paid, some drafted, some overdue by 40 days) to accurately test aging and outstanding calculations.
2.  **Performance Test**: Run the dashboard page locally with `NEXT_DEBUG=true` to verify that `allInvoices` is no longer fetching the entire table into memory.
3.  **UI Verification**: Ensure the "Overdue" flag only appears on invoices strictly past their `dueDate` and not on fully paid invoices.
