# Responsive payment history

The invoice's payment history presents each payment as labelled facts, followed by a separate action row spanning the available width. Date, method, reference, status and amount use two columns on narrow screens and three columns on large screens. The action row wraps below those facts rather than competing for space in a narrow table cell.

The controls retain their existing purpose and permission checks:

- **Correct payment details** opens the date/reference correction form for eligible methods. It preserves the paid balance and records the correction history.
- **Send receipt by email** opens the deliberate sending confirmation. Opening payment history, issuing an invoice, recording a payment or making a correction does not send an email. Sending still requires the separate confirmation.
- **Reverse payment entry** opens the reason and confirmation flow. Reversing an entry changes verified paid totals and can reopen the invoice; it does not refund money. Date/reference corrections should use Correct payment details instead.
- Pending payment verification and rejection retain their existing actions.

This change adjusts presentation and discoverability. The same action handlers, correction dialog, receipt confirmation and payment reversal flow remain in use; it does not introduce a new financial workflow or automatic communication.

## Visual evidence and consistency

Reviewed `src/features/finance/components/PaymentHistoryList.tsx` and `/private/tmp/ledger-responsive-evidence/mobile.png`. The mobile capture contains clearly labelled fictional data and states that email sending is stubbed. It shows payment facts above three readable, vertically wrapping actions inside the payment record, with no narrow action column or horizontal clipping.

The implementation preserves the finance interface's existing card, border, foreground, secondary and muted tokens, typography, rounded record container and Lucide icons. It reuses the existing receipt and correction components. No shared visual tokens or design-system files were changed. This documentation comparison covers the supplied mobile evidence; independent finish review and production verification remain separate release checks.
