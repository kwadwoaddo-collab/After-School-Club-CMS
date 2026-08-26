import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is missing');
  process.exit(1);
}

const sql = postgres(databaseUrl, { ssl: 'require' });

async function runAudit() {
  console.log('=== STAGE B: MIGRATIONS CHECK ===');
  const migrationTables = await sql`
    SELECT table_schema, table_name 
    FROM information_schema.tables 
    WHERE table_name LIKE '%drizzle%' OR table_name LIKE '%migration%';
  `;
  for (const t of migrationTables) {
    const rows = await sql.unsafe(`SELECT count(*)::int as count FROM "${t.table_schema}"."${t.table_name}"`);
    console.log(`Table ${t.table_schema}.${t.table_name} has ${rows[0].count} rows`);
  }

  console.log('\n=== STAGE C: GLOBAL PRE-CLEANUP CENSUS ===');
  const tables = [
    'organisations', 'centres', 'users', 'accounts', 'sessions',
    'org_memberships', 'centre_memberships', 'parents', 'children',
    'authorised_collectors', 'bookings', 'booking_attendees',
    'registrations', 'registration_parents', 'registration_children',
    'invoices', 'invoice_line_items', 'payments', 'student_notes',
    'notifications', 'portal_notifications', 'staff_invites',
    'audit_events', 'incidents', 'verification_tokens'
  ];

  for (const table of tables) {
    try {
      const res = await sql`SELECT COUNT(*)::int as count FROM ${sql(table)}`;
      console.log(`${table.padEnd(25)}: ${res[0].count}`);
    } catch (e: any) {
      console.log(`${table.padEnd(25)}: ERROR (${e.message})`);
    }
  }

  console.log('\n=== STAGE D & E: ALL PRODUCTION ORGANISATIONS AUDIT ===');
  const orgs = await sql`
    SELECT id, name, slug, created_at, updated_at
    FROM organisations
    ORDER BY created_at ASC;
  `;
  console.log(`Total Organisations Found: ${orgs.length}\n`);

  async function safeCount(queryStr: string) {
    try {
      const res = await sql.unsafe(queryStr);
      return res[0].count;
    } catch (e: any) {
      return `ERR: ${e.message}`;
    }
  }

  for (const org of orgs) {
    const orgId = org.id;
    console.log(`==================================================`);
    console.log(`Org: ${org.name} | ID: ${orgId}`);
    console.log(`Slug: ${org.slug} | Created: ${org.created_at}`);

    const users = await sql`
      SELECT u.id, u.email, u.name, u.role, om.role as membership_role
      FROM users u
      LEFT JOIN org_memberships om ON u.id = om.user_id AND om.organisation_id = ${orgId}
      WHERE u.organisation_id = ${orgId} OR om.organisation_id = ${orgId};
    `;
    console.log(`Associated Users (${users.length}):`);
    for (const u of users) {
      console.log(`  - User: ${u.email} (ID: ${u.id}, UserRole: ${u.role}, MemberRole: ${u.membership_role})`);
    }

    const centresCount = await safeCount(`SELECT COUNT(*)::int as count FROM centres WHERE organisation_id = '${orgId}'`);
    const orgMemCount = await safeCount(`SELECT COUNT(*)::int as count FROM org_memberships WHERE organisation_id = '${orgId}'`);
    const parentsCount = await safeCount(`SELECT COUNT(*)::int as count FROM parents WHERE organisation_id = '${orgId}'`);
    const childrenCount = await safeCount(`SELECT COUNT(*)::int as count FROM children WHERE organisation_id = '${orgId}'`);
    const bookingsCount = await safeCount(`SELECT COUNT(*)::int as count FROM bookings b JOIN centres c ON b.centre_id = c.id WHERE c.organisation_id = '${orgId}'`);
    const attendeesCount = await safeCount(`SELECT COUNT(*)::int as count FROM booking_attendees ba JOIN bookings b ON ba.booking_id = b.id JOIN centres c ON b.centre_id = c.id WHERE c.organisation_id = '${orgId}'`);
    const registrationsCount = await safeCount(`SELECT COUNT(*)::int as count FROM registrations WHERE organisation_id = '${orgId}'`);
    const invoicesCount = await safeCount(`SELECT COUNT(*)::int as count FROM invoices WHERE organisation_id = '${orgId}'`);
    const paymentsCount = await safeCount(`SELECT COUNT(*)::int as count FROM payments p JOIN invoices i ON p.invoice_id = i.id WHERE i.organisation_id = '${orgId}'`);
    const notesCount = await safeCount(`SELECT COUNT(*)::int as count FROM student_notes sn JOIN children c ON sn.child_id = c.id WHERE c.organisation_id = '${orgId}'`);
    const notificationsCount = await safeCount(`SELECT COUNT(*)::int as count FROM notifications WHERE organisation_id = '${orgId}'`);
    const staffInvitesCount = await safeCount(`SELECT COUNT(*)::int as count FROM staff_invites WHERE organisation_id = '${orgId}'`);
    const auditEventsCount = await safeCount(`SELECT COUNT(*)::int as count FROM audit_events WHERE organisation_id = '${orgId}'`);

    console.log(`Counts:`);
    console.log(`  Centres: ${centresCount}`);
    console.log(`  Org Memberships: ${orgMemCount}`);
    console.log(`  Parents: ${parentsCount}`);
    console.log(`  Children: ${childrenCount}`);
    console.log(`  Bookings: ${bookingsCount}`);
    console.log(`  Booking Attendees: ${attendeesCount}`);
    console.log(`  Registrations: ${registrationsCount}`);
    console.log(`  Invoices: ${invoicesCount}`);
    console.log(`  Payments: ${paymentsCount}`);
    console.log(`  Student Notes: ${notesCount}`);
    console.log(`  Notifications: ${notificationsCount}`);
    console.log(`  Staff Invites: ${staffInvitesCount}`);
    console.log(`  Audit Events: ${auditEventsCount}\n`);
  }

  console.log('=== STAGE G: SHARED IDENTITY ANALYSIS ===');
  const sharedUsers = await sql`
    SELECT user_id, COUNT(DISTINCT organisation_id)::int as org_count
    FROM org_memberships
    GROUP BY user_id
    HAVING COUNT(DISTINCT organisation_id) > 1;
  `;
  console.log(`Users with memberships in multiple organisations: ${sharedUsers.length}`);

  await sql.end();
}

runAudit().catch((err) => {
  console.error(err);
  process.exit(1);
});
