[x] Task 39: Fix Visibility on Registration Link Page
Status: Complete
Location: /dashboard/registration-link (Image 1)
Issue: The header "Registration Link & Embed Code" and the descriptive text below it are too dark and illegible.
Fix: Update these text elements to High-Contrast White (#FFFFFF) to match the professional dark theme.
[x] Task 40: Re-order Registration Funnel Logic
Status: Complete
Location: Public Registration Flow
Current Flow: Link -> Fees (Image 2) -> Centre Selection (Image 3) -> Step 1 (Image 4).
New Required Flow:
Select a Centre: (The very first screen the parent sees).
Fees & Payment Information: (The parent sees the prices for the centre they just picked).
Registration Form: (Proceed to Step 1).
Goal: Ensure parents know which location they are registering for before they review financial terms.
[ ] Task 41: Implement Dynamic Centre Pricing (Settings)
Status: Pending
Location: Backend (Centre Model) & Settings Dashboard (Image 6)
Backend: Add two new fields to the Centre database model: fee_self_finance and fee_assisted_finance.
Settings UI: Add a new card in the Settings area titled "Finance & Pricing".
Functionality: This card should allow the Admin to select a centre and set the specific "Self Finance" and "Tax Credit/Universal Credit" amounts for that location.
[ ] Task 42: Display Dynamic Fees in Registration Flow
Status: Pending
Location: Fees & Payment Page (Image 5)
Logic: Replace the hardcoded £20 and £30 values with dynamic variables pulled from the database based on the Centre selected in Step 1.
Display Format:
Self Finance: £{centre.fee_self_finance} per session
Tax Credit / Universal Credit / Student Finance: £{centre.fee_assisted_finance} per session