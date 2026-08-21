import { db } from '../db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function main() {
    const migrationPath = path.join(process.cwd(), 'drizzle/0022_add_org_memberships.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('Running migration: 0022_add_org_memberships...');
    await db.execute(sql.raw(migrationSQL));
    console.log('✅ Migration complete!');
    
    // Verify
    const result = await db.execute(sql`SELECT COUNT(*) as count FROM org_memberships`);
    console.log(`✅ org_memberships table created with ${result[0].count} rows seeded`);
    process.exit(0);
}

main().catch((e) => { console.error('Migration failed:', e); process.exit(1); });
