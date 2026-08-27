# SprintScale CMS — Parent Portal Guide
## Family User Manual: Access, Bookings, Medical Updates & Payments

---

## 1. What Is the SprintScale Parent Portal?

The **SprintScale Parent Portal** (`/portal`) is your dedicated online account for managing your family's after-school and holiday club care.

From any phone, tablet, or computer, you can:
- **View Your Children's Profiles:** Keep medical notes, allergies, GP details, and emergency contacts up to date.
- **Book Sessions:** Schedule upcoming after-school and holiday club sessions in a few clicks.
- **Manage Invoices & Payments:** View outstanding invoices, pay securely online with credit/debit card or Apple Pay, or submit your Tax-Free Childcare voucher reference.
- **Download Official Receipts:** Obtain payment receipts for tax credits, employer childcare schemes, or HMRC records.
- **Receive Club Alerts:** Stay informed with direct notifications and announcements from your club centre.

---

## 2. Passwordless Sign-In (Magic Links)

SprintScale uses secure, passwordless **Magic Link** authentication. You never have to create, remember, or reset a password.

```
┌─────────────────────────────────────────────────────────────┐
│                 HOW TO SIGN IN TO YOUR PORTAL               │
│                                                             │
│  1. Visit `/portal/login` on any web browser               │
│  2. Enter your registered email address                     │
│  3. Click "Send Magic Link"                                 │
│  4. Open your email inbox and tap the secure sign-in link    │
│  5. You are instantly logged in for 30 days                 │
└─────────────────────────────────────────────────────────────┘
```

> [!NOTE]
> Magic links expire automatically after **15 minutes** for your security. If your link expires, simply go to `/portal/login` and request a new one.

---

## 3. Keeping Your Child's Medical & Contact Details Updated

> [!IMPORTANT]
> Always ensure allergies, medication, dietary needs, and emergency numbers are accurate before your child attends a session.

### How to Update Medical Information:
1. Log into your portal at `/portal`.
2. On your dashboard, tap your child's profile card (or navigate to `Children → [Child Name]`).
3. Scroll to the **Medical & Dietary Information** section.
4. Tap **Edit Medical Notes** or **Add Note**.
5. Update allergy details, dietary requirements (e.g. Vegetarian, Halal, Nut-free), or GP doctor contact details.
6. Tap **Save Changes**. Your club tutors will see these updates immediately on the daily roll call.

---

## 4. Booking Club Sessions

### Booking from Within Your Portal:
1. Log in at `/portal` and tap **Book Sessions** (`/portal/book`).
2. Select which of your children will be attending.
3. Choose your club centre and the dates/times you require.
4. Review your session summary.
5. Tap **Confirm Booking**. You will receive an immediate email confirmation with your booking reference code.

---

## 5. Paying Invoices & Viewing Billing History

You can view your family's invoices and settle payments at any time from the **Billing** tab.

### Option A: Pay Online via Card or Apple Pay (Instant)
1. In your portal, navigate to: `Billing` (`/portal/billing`).
2. Under **Outstanding Invoices**, locate the invoice you wish to settle.
3. Tap **Pay with Card / Apple Pay**.
4. You will be taken to a secure, encrypted Stripe checkout page.
5. Enter your card details or use Apple Pay / Google Pay to complete the payment.
6. You will be returned to your portal with an immediate confirmation, and an official receipt will be available to download.

---

### Option B: Paying via Tax-Free Childcare (TFC) or Childcare Vouchers
If you pay using the UK Government Tax-Free Childcare scheme or an employer voucher provider (such as Edenred, Computershare, or Care-4):

1. Submit your payment through your Government Childcare Account or voucher provider portal using your club's registered Ofsted / venue reference number.
2. In your SprintScale portal, go to `Billing` (`/portal/billing`).
3. Under your outstanding invoice, locate the **Voucher / TFC Reference** field.
4. Enter your unique remittance reference (for example, your child's TFC identifier or voucher transaction code).
5. Tap **Submit Payment Reference**.
6. Once the club owner matches the bank remittance against your reference, your invoice will be marked as **Paid**.

---

## 6. Downloading Payment Receipts

1. Navigate to: `Billing` (`/portal/billing`).
2. Scroll to **Payment History**.
3. Find the paid invoice and tap **Download Receipt (PDF)**.
4. The official PDF contains the club's name, address, Ofsted registration number, VAT details, and payment confirmation stamp.

---

## 7. Frequently Asked Questions (FAQ)

| Question | Answer |
|---|---|
| **Why does the email link say "Invalid or Expired"?** | Magic links expire after 15 minutes or after being clicked once. Return to `/portal/login`, enter your email, and request a fresh link. |
| **Why can't I see my second child in the portal?** | If your children were registered under different email addresses, they will appear in separate accounts. Contact your club manager to link all siblings to your primary email. |
| **How do I change who is authorised to collect my child?** | Open your child's profile in the portal, tap **Authorised Collectors**, and add the collector's name and telephone number. You can also specify a collection password. |
| **Is my payment card stored on SprintScale?** | No. All card transactions are processed through Stripe, a PCI-DSS Level 1 certified payment provider. SprintScale never sees or stores your full card number. |
