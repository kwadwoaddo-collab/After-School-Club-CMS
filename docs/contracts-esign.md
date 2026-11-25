# Parent e-contract signing

- Staff (Owner/Manager with centre access) click **Send contract** on the family billing area. One contract per family (`billing_configs`); childcare families only (`service_type = 'childcare'`).
- The parent gets a one-time link `/sign/<token>` (256-bit random token; only its SHA-256 is stored; expires after 14 days; single use; resend rotates the token; revocable). No login, rate limited, `noindex`, no-referrer.
- Values the parent sees are frozen into `contracts.snapshot` when the link is sent (parent, children, start date = billing anchor date, monthly amount, centre details, template version + hash). Signing only adds signer evidence and the PDF.
- On signing: signer name, drawn/typed signature, timestamp, IP and user agent are stored; the PDF is generated server-side (`@react-pdf/renderer`), stored in `contract_pdfs` (bytea, never listed), downloadable only via `/api/contracts/<id>/pdf` for Owners/Managers of the centre, and emailed to the signing parent.
- Changing the agreed amount after signing shows "Amount changed — new contract needed"; nothing is sent automatically.
- Per-centre details live in `contract_centre_settings` (falling back to the centre record). Sending is blocked while provider name, address, phone or Ofsted number is missing.

## Retention (UK GDPR)
Stored data is the minimum needed as evidence of the agreement: names, the agreed amount, signature, timestamp, IP and user agent. Suggested retention: keep for the life of the enrolment plus 6 years (contract limitation period), then delete the contract row and PDF. No automatic deletion job is included; deletion is a manual/ops decision made outside the app.

**Contracts are never deleted by the app.** Deleting a billing config detaches its contracts (`billing_config_id` becomes NULL; they stay listed by parent + centre). Permanently deleting a parent, centre or organisation that still has contracts is blocked by the database (`ON DELETE RESTRICT`), and the parent bin shows a clear message. Staff can **Archive** a signed, revoked or expired contract (Owner/Manager, audited as `contract_archived`): it leaves the family's current status, a new contract can then be sent, and it stays visible and downloadable under a collapsed "Archived contracts" list. A live link must be revoked before it can be archived.

**Authorised signatory.** Each centre has a signatory name (required before sending) and role in the centre contract details. The centre's signature image (`centres.signatureUrl`, https PNG/JPEG up to 200 KB) is fetched once at send time and frozen into the snapshot; if absent or unreadable, the signatory name is printed in italic script. Name, role and send date are printed beneath.

**Changed circumstances.** A signed contract is flagged "Amount changed — new contract needed" or "Children changed — new contract needed" (covered children compared with those recorded at send). Nothing is sent automatically. IP and user agent are evidential only and are never shown on the public page.
