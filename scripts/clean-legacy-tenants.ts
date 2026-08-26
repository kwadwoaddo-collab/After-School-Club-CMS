import postgres from 'postgres';

/**
 * Guarded Legacy Tenant Cleanup Tooling
 *
 * CAUTION: TOUCHES PRODUCTION DATABASE.
 * Defaults to DRY-RUN mode. Pass --execute to execute transaction.
 */

const SYDENHAM_ORG_ID = '8049f803-85e2-4bd1-bf19-49714251bea9';

const SYNTHETIC_ORG_IDS = [
  '0f585840-19ef-4804-9c7c-16262112914c', // Demo Tuition Centre
  '21b44940-d5ec-4883-96aa-0efb6428560e', // Bright Star Academy
  '205238b2-42be-4b45-8a35-d7ab2cd19ab1', // AmaliDrive
  '54ffcae0-8ed6-400f-82f9-78122f081437', // Amalitech Academy
  '7d5bfd27-f5d6-4d43-a2c6-a1ebad70f367', // Right Bridge
  '0f00f390-e1ee-42a5-afe5-30eb137b77c0', // Test Academy
  'c048b267-6340-408a-a229-07e69abcb2e5', // Blank Stars
  'b2c11346-fdd1-4215-ae96-84d187651612', // Norby biz
  'e0b25874-912d-4c01-b94d-473827acad65', // SprintScale Test Org
  'fcc70db4-64d7-4cd0-8f95-1692f00e6643', // Test Org
  '5dfc4dbe-71b2-47c6-8211-d884c38ef8f2', // Test OrgJetski Test Org
  '0a259d63-beab-4f5b-9fa7-51ff15e8e0be', // Test Org Regression 123
  '87b4625e-faea-4893-832e-e20ea119a456', // Grey Research Tuition A
  '67ca953c-804c-4830-9c12-68e3b4ff1512', // Grey Research Tuition B
];

// Explicitly protected user emails (MUST NOT be deleted)
const PROTECTED_USER_EMAILS = [
  'kaddo@sydenhamasc.co.uk',
  'kwadwoaddo@gmail.com',
  'kwadwoaddo@googlemail.com',
  'brakatuaddo@gmail.com',
  'dagenhamafterschoolclub@gmail.com',
  'shafaw@sydenhamasc.co.uk',
  'norbertagyei@gmail.com',
  'ampadumargaret121@gmail.com',
  'fmorafa@sydenhamasc.co.uk',
  'brakatuoaddo@gmail.com',
  'margaret.lewishamasc@gmail.com',
];

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is missing');
  process.exit(1);
}

const isExecuteMode = process.argv.includes('--execute');
const sql = postgres(databaseUrl, { ssl: 'require' });

async function getSydenhamFingerprint(tx: any) {
  const centres = await tx`SELECT COUNT(*)::int as c FROM centres WHERE organisation_id = ${SYDENHAM_ORG_ID}`;
  const users = await tx`SELECT COUNT(*)::int as c FROM users WHERE organisation_id = ${SYDENHAM_ORG_ID}`;
  const orgMem = await tx`SELECT COUNT(*)::int as c FROM org_memberships WHERE organisation_id = ${SYDENHAM_ORG_ID}`;
  const parents = await tx`SELECT COUNT(*)::int as c FROM parents WHERE organisation_id = ${SYDENHAM_ORG_ID}`;
  const children = await tx`SELECT COUNT(*)::int as c FROM children WHERE organisation_id = ${SYDENHAM_ORG_ID}`;
  const bookings = await tx`SELECT COUNT(*)::int as c FROM bookings b JOIN centres c ON b.centre_id = c.id WHERE c.organisation_id = ${SYDENHAM_ORG_ID}`;
  const reg = await tx`SELECT COUNT(*)::int as c FROM registrations WHERE organisation_id = ${SYDENHAM_ORG_ID}`;
  const inv = await tx`SELECT COUNT(*)::int as c FROM invoices WHERE organisation_id = ${SYDENHAM_ORG_ID}`;
  const pay = await tx`SELECT COUNT(*)::int as c FROM payments p JOIN invoices i ON p.invoice_id = i.id WHERE i.organisation_id = ${SYDENHAM_ORG_ID}`;
  const notes = await tx`SELECT COUNT(*)::int as c FROM student_notes sn JOIN children c ON sn.child_id = c.id WHERE c.organisation_id = ${SYDENHAM_ORG_ID}`;
  const notif = await tx`SELECT COUNT(*)::int as c FROM notifications WHERE organisation_id = ${SYDENHAM_ORG_ID}`;
  const invites = await tx`SELECT COUNT(*)::int as c FROM staff_invites WHERE organisation_id = ${SYDENHAM_ORG_ID}`;
  const audit = await tx`SELECT COUNT(*)::int as c FROM audit_events WHERE organisation_id = ${SYDENHAM_ORG_ID}`;

  return {
    centres: centres[0].c,
    users: users[0].c,
    orgMem: orgMem[0].c,
    parents: parents[0].c,
    children: children[0].c,
    bookings: bookings[0].c,
    registrations: reg[0].c,
    invoices: inv[0].c,
    payments: pay[0].c,
    notes: notes[0].c,
    notifications: notif[0].c,
    invites: invites[0].c,
    auditEvents: audit[0].c,
  };
}

async function runCleanup() {
  console.log(`=== MILESTONE 7D CLEANUP RUNNER ===`);
  console.log(`Mode: ${isExecuteMode ? 'EXECUTE (REAL MUTATION)' : 'DRY-RUN (SIMULATION ONLY)'}`);

  await sql.begin(async (tx) => {
    // 1. Verify Sydenham Pre-Cleanup Fingerprint
    const preFingerprint = await getSydenhamFingerprint(tx);
    console.log('\n--- Pre-Cleanup Sydenham Fingerprint ---');
    console.dir(preFingerprint);

    if (preFingerprint.parents === 0 || preFingerprint.children === 0) {
      throw new Error('FATAL: Sydenham fingerprint invalid or missing!');
    }

    // 2. Perform Child-First Deletions for Synthetic Orgs
    console.log('\n--- Deleting Synthetic Dependent Records ---');

    const delAttendees = await tx`
      DELETE FROM booking_attendees
      WHERE booking_id IN (
        SELECT b.id FROM bookings b
        JOIN centres c ON b.centre_id = c.id
        WHERE c.organisation_id = ANY(${SYNTHETIC_ORG_IDS})
      );
    `;
    console.log(`Deleted booking_attendees: ${delAttendees.count}`);

    const delBookings = await tx`
      DELETE FROM bookings
      WHERE centre_id IN (
        SELECT id FROM centres WHERE organisation_id = ANY(${SYNTHETIC_ORG_IDS})
      );
    `;
    console.log(`Deleted bookings: ${delBookings.count}`);

    const delPayments = await tx`
      DELETE FROM payments
      WHERE invoice_id IN (
        SELECT id FROM invoices WHERE organisation_id = ANY(${SYNTHETIC_ORG_IDS})
      );
    `;
    console.log(`Deleted payments: ${delPayments.count}`);

    const delInvoices = await tx`
      DELETE FROM invoices
      WHERE organisation_id = ANY(${SYNTHETIC_ORG_IDS});
    `;
    console.log(`Deleted invoices: ${delInvoices.count}`);

    const delRegParents = await tx`
      DELETE FROM registration_parents
      WHERE registration_id IN (
        SELECT id FROM registrations WHERE organisation_id = ANY(${SYNTHETIC_ORG_IDS})
      );
    `;
    console.log(`Deleted registration_parents: ${delRegParents.count}`);

    const delRegChildren = await tx`
      DELETE FROM registration_children
      WHERE registration_id IN (
        SELECT id FROM registrations WHERE organisation_id = ANY(${SYNTHETIC_ORG_IDS})
      );
    `;
    console.log(`Deleted registration_children: ${delRegChildren.count}`);

    const delRegistrations = await tx`
      DELETE FROM registrations
      WHERE organisation_id = ANY(${SYNTHETIC_ORG_IDS});
    `;
    console.log(`Deleted registrations: ${delRegistrations.count}`);

    const delNotes = await tx`
      DELETE FROM student_notes
      WHERE child_id IN (
        SELECT id FROM children
        WHERE organisation_id = ANY(${SYNTHETIC_ORG_IDS})
        OR centre_id IN (SELECT id FROM centres WHERE organisation_id = ANY(${SYNTHETIC_ORG_IDS}))
      );
    `;
    console.log(`Deleted student_notes: ${delNotes.count}`);

    const delCollectors = await tx`
      DELETE FROM authorised_collectors
      WHERE child_id IN (
        SELECT id FROM children
        WHERE organisation_id = ANY(${SYNTHETIC_ORG_IDS})
        OR centre_id IN (SELECT id FROM centres WHERE organisation_id = ANY(${SYNTHETIC_ORG_IDS}))
      );
    `;
    console.log(`Deleted authorised_collectors: ${delCollectors.count}`);

    const delChildren = await tx`
      DELETE FROM children
      WHERE organisation_id = ANY(${SYNTHETIC_ORG_IDS})
      OR centre_id IN (SELECT id FROM centres WHERE organisation_id = ANY(${SYNTHETIC_ORG_IDS}));
    `;
    console.log(`Deleted children: ${delChildren.count}`);

    const delParents = await tx`
      DELETE FROM parents
      WHERE organisation_id = ANY(${SYNTHETIC_ORG_IDS});
    `;
    console.log(`Deleted parents: ${delParents.count}`);

    const delCentreMem = await tx`
      DELETE FROM centre_memberships
      WHERE centre_id IN (
        SELECT id FROM centres WHERE organisation_id = ANY(${SYNTHETIC_ORG_IDS})
      );
    `;
    console.log(`Deleted centre_memberships: ${delCentreMem.count}`);

    const delCentres = await tx`
      DELETE FROM centres
      WHERE organisation_id = ANY(${SYNTHETIC_ORG_IDS});
    `;
    console.log(`Deleted centres: ${delCentres.count}`);

    const delOrgMem = await tx`
      DELETE FROM org_memberships
      WHERE organisation_id = ANY(${SYNTHETIC_ORG_IDS});
    `;
    console.log(`Deleted org_memberships: ${delOrgMem.count}`);

    const delInvites = await tx`
      DELETE FROM staff_invites
      WHERE organisation_id = ANY(${SYNTHETIC_ORG_IDS});
    `;
    console.log(`Deleted staff_invites: ${delInvites.count}`);

    const delNotif = await tx`
      DELETE FROM notifications
      WHERE organisation_id = ANY(${SYNTHETIC_ORG_IDS});
    `;
    console.log(`Deleted notifications: ${delNotif.count}`);

    // Delete users associated ONLY with synthetic orgs (excluding protected emails)
    const delUsers = await tx`
      DELETE FROM users
      WHERE organisation_id = ANY(${SYNTHETIC_ORG_IDS})
      AND email NOT IN (${PROTECTED_USER_EMAILS});
    `;
    console.log(`Deleted synthetic users: ${delUsers.count}`);

    // Delete synthetic organisations
    const delOrgs = await tx`
      DELETE FROM organisations
      WHERE id = ANY(${SYNTHETIC_ORG_IDS});
    `;
    console.log(`Deleted organisations: ${delOrgs.count}`);

    // 3. Verify Post-Cleanup Sydenham Fingerprint
    const postFingerprint = await getSydenhamFingerprint(tx);
    console.log('\n--- Post-Cleanup Sydenham Fingerprint ---');
    console.dir(postFingerprint);

    // 4. Assert Sydenham Zero-Delta
    for (const key of Object.keys(preFingerprint) as (keyof typeof preFingerprint)[]) {
      if (preFingerprint[key] !== postFingerprint[key]) {
        throw new Error(`SAFETY ASSERTION FAILED: Sydenham metric '${key}' changed from ${preFingerprint[key]} to ${postFingerprint[key]}!`);
      }
    }
    console.log('\nSUCCESS: Sydenham Fingerprint ZERO DELTA VERIFIED!');

    // 5. Assert Remaining Organisations Count = 1
    const remOrgs = await tx`SELECT COUNT(*)::int as count FROM organisations;`;
    console.log(`Remaining Organisations in DB: ${remOrgs[0].count}`);
    if (remOrgs[0].count !== 1) {
      throw new Error(`SAFETY ASSERTION FAILED: Expected 1 remaining organisation, found ${remOrgs[0].count}!`);
    }

    if (!isExecuteMode) {
      console.log('\n--- DRY-RUN COMPLETE: Rolling back transaction (No changes made) ---');
      throw new Error('DRY_RUN_ROLLBACK');
    }

    console.log('\n--- EXECUTE MODE: COMMITTING TRANSACTION TO PRODUCTION DB ---');
  });
}

runCleanup()
  .then(() => {
    console.log('Milestone 7D Controlled Cleanup Execution Completed Successfully!');
    process.exit(0);
  })
  .catch((err) => {
    if (err.message === 'DRY_RUN_ROLLBACK') {
      console.log('Dry run finished cleanly.');
      process.exit(0);
    }
    console.error('CLEANUP ERROR / ROLLBACK EXECUTED:', err);
    process.exit(1);
  });
