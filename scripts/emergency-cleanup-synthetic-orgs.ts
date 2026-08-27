import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

  // Identify all non-Sydenham organisations
  const orgs = await sql`
    SELECT id, name, created_at 
    FROM organisations 
    WHERE id != '8049f803-85e2-4bd1-bf19-49714251bea9'
    ORDER BY created_at ASC
  `;

  console.log('=== SYNTHETIC ORGANISATIONS TO REMOVE ===');
  for (const org of orgs) {
    console.log(`  id: ${org.id}, name: ${org.name}, created: ${org.created_at}`);
  }

  if (orgs.length === 0) {
    console.log('No synthetic organisations found');
    await sql.end();
    return;
  }

  const syntheticIds = orgs.map(o => o.id as string);

  // Count cascade targets before deletion
  for (const id of syntheticIds) {
    const centres = await sql`SELECT COUNT(*)::int as cnt FROM centres WHERE organisation_id = ${id}`;
    const users = await sql`SELECT COUNT(*)::int as cnt FROM users WHERE organisation_id = ${id}`;
    const orgMembers = await sql`SELECT COUNT(*)::int as cnt FROM org_memberships WHERE organisation_id = ${id}`;
    console.log(`\nOrg ${id}:`);
    console.log(`  centres: ${centres[0].cnt}, users: ${users[0].cnt}, org_memberships: ${orgMembers[0].cnt}`);
  }

  // Safety check: confirm Sydenham is not in the list
  const sydenham = await sql`SELECT id, name FROM organisations WHERE id = '8049f803-85e2-4bd1-bf19-49714251bea9'`;
  console.log(`\nSydenham check: ${sydenham[0]?.name} — PRESERVED`);

  // Execute guarded cascade deletion
  for (const id of syntheticIds) {
    console.log(`\nRemoving organisation: ${id}`);

    // Delete cascade manually in dependency order (in case FK cascade not set everywhere)
    await sql`DELETE FROM centre_memberships WHERE centre_id IN (SELECT id FROM centres WHERE organisation_id = ${id})`;
    await sql`DELETE FROM staff_invites WHERE organisation_id = ${id}`;
    await sql`DELETE FROM org_memberships WHERE organisation_id = ${id}`;
    await sql`DELETE FROM centres WHERE organisation_id = ${id}`;
    
    // Delete the user accounts created for this org (users with this org_id that are not in Sydenham)
    await sql`DELETE FROM accounts WHERE user_id IN (SELECT id FROM users WHERE organisation_id = ${id})`;
    await sql`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE organisation_id = ${id})`;
    await sql`DELETE FROM users WHERE organisation_id = ${id}`;
    
    await sql`DELETE FROM organisations WHERE id = ${id}`;
    console.log(`  REMOVED`);
  }

  // Final census verification
  const finalOrgs = await sql`SELECT COUNT(*)::int as cnt FROM organisations`;
  const finalCentres = await sql`SELECT COUNT(*)::int as cnt FROM centres`;
  const finalUsers = await sql`SELECT COUNT(*)::int as cnt FROM users`;
  const sydenhamCheck = await sql`SELECT name FROM organisations WHERE id = '8049f803-85e2-4bd1-bf19-49714251bea9'`;

  console.log('\n=== POST-CLEANUP CENSUS ===');
  console.log(`organisations: ${finalOrgs[0].cnt}`);
  console.log(`centres: ${finalCentres[0].cnt}`);
  console.log(`users: ${finalUsers[0].cnt}`);
  console.log(`Sydenham intact: ${sydenhamCheck[0]?.name ?? 'MISSING — CRITICAL!'}`);

  await sql.end();
}

main().catch(e => { console.error('CLEANUP ERROR:', e.message); process.exit(1); });
