import { db } from '../db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function main() {
    const migrationPath = path.join(process.cwd(), 'drizzle/0023_add_subdomains.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    console.log('Running migration: 0023_add_subdomains...');
    // Run each statement separately
    const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
    for (const stmt of statements) {
        await db.execute(sql.raw(stmt));
    }
    console.log('✅ Migration complete!');

    // Verify
    const centres = await db.execute(sql`SELECT name, subdomain FROM centres WHERE subdomain IS NOT NULL`);
    console.log('Centres with subdomains:', centres);
    process.exit(0);
}
main().catch((e) => { console.error('Migration failed:', e); process.exit(1); });
