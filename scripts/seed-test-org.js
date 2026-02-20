const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.vercel-prod') });

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });

async function main() {
    const { randomUUID } = require('crypto');

    const orgId = randomUUID();
    const userId = randomUUID();
    const slug = 'test-academy';

    // 1. Create the test organisation
    await sql`
        INSERT INTO organisations (id, name, slug, contact_email, created_at, updated_at)
        VALUES (${orgId}, 'Test Academy', ${slug}, 'sprintscaletester@gmail.com', NOW(), NOW())
    `;
    console.log('✅ Created org:', orgId);

    // 2. Create the ORG_OWNER user
    await sql`
        INSERT INTO users (id, email, name, role, organisation_id, created_at, updated_at)
        VALUES (${userId}, 'sprintscaletester@gmail.com', 'Test User', 'ORG_OWNER', ${orgId}, NOW(), NOW())
    `;
    console.log('✅ Created user:', userId);

    // 3. Verify
    const check = await sql`
        SELECT u.email, u.role, o.name AS org_name, o.slug
        FROM users u
        JOIN organisations o ON o.id = u.organisation_id
        WHERE u.email = 'sprintscaletester@gmail.com'
    `;
    console.log('✅ Verified:', JSON.stringify(check, null, 2));

    await sql.end();
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
