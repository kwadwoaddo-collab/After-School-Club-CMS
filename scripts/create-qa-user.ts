import { config } from 'dotenv';
import path from 'path';
config({ path: path.resolve(process.cwd(), '.env.local') });

import postgres from 'postgres';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });

async function main() {
  const orgs = await sql`SELECT id, name FROM organisations LIMIT 1`;
  if (!orgs.length) { console.error('❌ No organisations found.'); process.exit(1); }
  const org = orgs[0];
  console.log(`✅ Org: ${org.name} (${org.id})`);

  const email    = 'qa@test.local';
  const password = 'QaTest123!';
  const hash     = await bcrypt.hash(password, 10);

  const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;

  if (existing.length) {
    await sql`UPDATE users SET password_hash = ${hash} WHERE email = ${email}`;
    console.log('ℹ️  User exists — password updated');
  } else {
    const userId = uuidv4();
    await sql`
      INSERT INTO users (id, name, first_name, last_name, organisation_id, email, password_hash, role, email_verified, created_at, updated_at)
      VALUES (
        ${userId},
        'QA Tester',
        'QA',
        'Tester',
        ${org.id},
        ${email},
        ${hash},
        'ORG_OWNER',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;
    console.log(`✅ Created: ${email}`);
    try {
      await sql`
        INSERT INTO org_memberships (user_id, organisation_id, role)
        VALUES (${userId}, ${org.id}, 'ORG_OWNER')
        ON CONFLICT DO NOTHING
      `;
      console.log('✅ Membership created');
    } catch (e) { console.log('ℹ️  No org_memberships table, skipping'); }
  }

  console.log('\n🎉 QA credentials:');
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   URL:      http://localhost:3006/login`);
  await sql.end();
  process.exit(0);
}

main().catch(e => { console.error('❌', e?.message || e); process.exit(1); });
