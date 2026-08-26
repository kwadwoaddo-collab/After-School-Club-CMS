import postgres from 'postgres';
import fs from 'fs';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  process.exit(1);
}

const sql = postgres(databaseUrl, { ssl: 'require' });

async function run() {
  const orgs = await sql`
    SELECT id, name, slug, created_at, updated_at
    FROM organisations
    ORDER BY created_at ASC;
  `;

  const results: any[] = [];

  for (const org of orgs) {
    const orgId = org.id;

    const users = await sql`
      SELECT u.id, u.email, u.name, u.role, om.role as membership_role
      FROM users u
      LEFT JOIN org_memberships om ON u.id = om.user_id AND om.organisation_id = ${orgId}
      WHERE u.organisation_id = ${orgId} OR om.organisation_id = ${orgId};
    `;

    const centres = await sql`SELECT id, name, slug FROM centres WHERE organisation_id = ${orgId}`;
    const parentsCount = await sql`SELECT COUNT(*)::int as count FROM parents WHERE organisation_id = ${orgId}`;
    const childrenCount = await sql`SELECT COUNT(*)::int as count FROM children WHERE organisation_id = ${orgId}`;
    const bookingsCount = await sql`SELECT COUNT(*)::int as count FROM bookings b JOIN centres c ON b.centre_id = c.id WHERE c.organisation_id = ${orgId}`;
    const registrationsCount = await sql`SELECT COUNT(*)::int as count FROM registrations WHERE organisation_id = ${orgId}`;
    const invoicesCount = await sql`SELECT COUNT(*)::int as count FROM invoices WHERE organisation_id = ${orgId}`;
    const paymentsCount = await sql`SELECT COUNT(*)::int as count FROM payments p JOIN invoices i ON p.invoice_id = i.id WHERE i.organisation_id = ${orgId}`;

    results.push({
      id: orgId,
      name: org.name,
      slug: org.slug,
      created_at: org.created_at,
      users: users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, membershipRole: u.membership_role })),
      centres: centres.map(c => ({ id: c.id, name: c.name, slug: c.slug })),
      counts: {
        parents: parentsCount[0].count,
        children: childrenCount[0].count,
        bookings: bookingsCount[0].count,
        registrations: registrationsCount[0].count,
        invoices: invoicesCount[0].count,
        payments: paymentsCount[0].count,
      }
    });
  }

  fs.writeFileSync('scripts/census_output.json', JSON.stringify(results, null, 2));
  console.log('Written to scripts/census_output.json');
  await sql.end();
}

run().catch(console.error);
