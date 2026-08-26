import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

  const r = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM children c LEFT JOIN parents p ON c.parent_id = p.id WHERE p.id IS NULL AND c.parent_id IS NOT NULL) as orphan_children,
      (SELECT COUNT(*)::int FROM booking_attendees ba LEFT JOIN bookings b ON ba.booking_id = b.id WHERE b.id IS NULL) as orphan_booking_attendees,
      (SELECT COUNT(*)::int FROM booking_attendees ba LEFT JOIN children c ON ba.child_id = c.id WHERE c.id IS NULL) as attendees_without_child,
      (SELECT COUNT(*)::int FROM bookings b LEFT JOIN parents p ON b.parent_id = p.id WHERE p.id IS NULL AND b.parent_id IS NOT NULL) as bookings_without_parent,
      (SELECT COUNT(*)::int FROM invoices i LEFT JOIN parents p ON i.parent_id = p.id WHERE p.id IS NULL) as orphan_invoices,
      (SELECT COUNT(*)::int FROM payments pay LEFT JOIN invoices i ON pay.invoice_id = i.id WHERE i.id IS NULL) as orphan_payments,
      (SELECT COUNT(*)::int FROM children c JOIN parents p ON c.parent_id = p.id WHERE p.organisation_id != c.organisation_id AND c.parent_id IS NOT NULL) as cross_tenant_children,
      (SELECT COUNT(*)::int FROM bookings b JOIN parents p ON b.parent_id = p.id JOIN centres ce ON b.centre_id = ce.id WHERE p.organisation_id != ce.organisation_id AND b.centre_id IS NOT NULL) as cross_tenant_bookings,
      (SELECT COUNT(*)::int FROM (SELECT user_id, organisation_id FROM org_memberships GROUP BY user_id, organisation_id HAVING COUNT(*) > 1) dups) as duplicate_memberships,
      (SELECT COALESCE(SUM(amount::numeric),0) FROM invoices) as invoices_total_amount,
      (SELECT COALESCE(SUM(amount::numeric),0) FROM payments) as payments_total_amount
  `;

  const row = r[0];
  console.log('=== STAGE R — RELATIONAL INTEGRITY AUDIT ===');
  for (const [k, v] of Object.entries(row)) {
    console.log(`${k}: ${v}`);
  }

  await sql.end();
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
