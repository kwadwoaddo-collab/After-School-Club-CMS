# WhatsApp Business Platform (Meta Cloud API) — Phase 2

Phase 1 (`wa.me` click-to-chat, `recordInvoiceWhatsAppHandoff`, `src/lib/whatsapp.ts`, Communications WhatsApp queue) is unchanged and is the automatic fallback.

## Behaviour
- **Flag `FF_WHATSAPP_API` defaults OFF.** Off = nothing in the UI changes and nothing is sent.
- **Per-centre numbers:** `whatsapp_centre_configs` (one row per centre: `phone_number_id`, `waba_id`, display number, `status`, `enabled`). No enabled+active row for the invoice's centre → Phase 1 `wa.me` flow.
- **Consent:** `whatsapp_consents` is append-only (opted_in/opted_out, source, who, when); newest row decides. No opt-in = no API send. A parent replying STOP/UNSUBSCRIBE/OPT OUT/CANCEL/END/QUIT is opted out automatically (audit `whatsapp_opt_out_reply`). Opt-in is only ever recorded by staff.
- **Sends:** staff click per invoice (never automatic). Approved utility templates only (below). Idempotency key per invoice+template (reminders: per UTC day) enforced by a unique index; a failed send may be retried. Rate limited. Audit event `invoice_whatsapp_api_send`.
- **Webhook** `/api/webhooks/whatsapp`: GET handshake (constant-time verify token); POST requires a valid `X-Hub-Signature-256` over the raw body (constant-time), else 401; 503 if no app secret. Updates sent → delivered → read / failed (never backwards). Public by design like `/api/webhooks/stripe-invoice`: `/api` already passes the proxy and the signature is the auth, so no gate was loosened.
- **Dry-run `WHATSAPP_DRY_RUN=true`:** logs the payload (phone masked) and records `dry_run`, no call to Meta.
- **Data minimisation:** no message body or inbound text stored; no child names, medical or safeguarding data in any parameter.
- Historic/paid invoices are untouched: new tables only, no backfill.

## Env vars (server-only)
`FF_WHATSAPP_API`, `WHATSAPP_DRY_RUN`, `WHATSAPP_ACCESS_TOKEN` (system-user token), `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, optional `WHATSAPP_GRAPH_VERSION` (default v21.0).

## Meta-side checklist (owner)
1. Meta Business Portfolio → complete **Business Verification**.
2. Create a Meta app (type Business) → add the **WhatsApp** product; note the **App Secret**.
3. Create/choose a WhatsApp Business Account (WABA). Add one phone number per centre. Each number must not be on personal WhatsApp/WhatsApp Business app (or be migrated) and must be able to receive an SMS/voice code. Note each **Phone number ID** and the WABA ID.
4. Set the display name per number (e.g. "Sydenham After School Club") and submit for approval.
5. Business Settings → System Users → create a system user, assign the app and WABA, generate a **permanent token** with `whatsapp_business_messaging` + `whatsapp_business_management` → `WHATSAPP_ACCESS_TOKEN`.
6. Webhooks → callback `https://app.sprintscaleit.co.uk/api/webhooks/whatsapp`, verify token = `WHATSAPP_VERIFY_TOKEN`; subscribe to **messages** for the WABA.
7. Submit the three templates below (category **Utility**, language **English (UK)** `en_GB`) and wait for approval.
8. Set a payment method on the WABA (utility messages outside the 24h window are charged per message).
9. Test with a Meta test number / staff phone only, with `WHATSAPP_DRY_RUN=true` first. Then enter each centre's Phone number ID in Communications → WhatsApp Business number and tick Enabled.

## Template texts (submit exactly; {{n}} = parameter order)
**invoice_issued_v1** — Utility, en_GB
> Hi {{1}}, your {{2}} invoice {{3}} from {{4}} for £{{5}} is due on {{6}}. You can view and pay it in the Parent Portal using the button below.
Footer: `Reply STOP to stop these messages.` Button: URL (static) `https://app.sprintscaleit.co.uk/portal/billing`, label "Open Parent Portal".

**payment_reminder_v1** — Utility, en_GB
> Hi {{1}}, a reminder that your {{2}} invoice {{3}} for £{{4}} from {{5}} was due on {{6}}. You can view and pay it in the Parent Portal using the button below.
Footer/button as above.

**payment_receipt_v1** — Utility, en_GB
> Hi {{1}}, thank you — we have received your payment of £{{2}} for invoice {{3}} with {{4}}. You can download your receipt from the Parent Portal using the button below.
Footer/button as above.

Sample values for Meta review: Ada / Childcare / INV-1042 / Sydenham After School Club / 240.00 / 01/12/2026.

Note: there is no public, unauthenticated receipt PDF URL in the app, so the receipt template links to the Parent Portal (where the PDF is downloadable) rather than attaching a PDF header.

## Migration / rollback
`drizzle/0040_whatsapp_business_platform.sql` (additive; journal convention unchanged — files go past 0034). Rollback: `DROP TABLE whatsapp_messages; DROP TABLE whatsapp_consents; DROP TABLE whatsapp_centre_configs;` (nothing else references them).
