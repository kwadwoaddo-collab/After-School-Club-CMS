import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function migrate() {
    try {
        console.log('Adding deleted_at to children...');
        await db.execute(sql`ALTER TABLE "children" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;`);
        
        console.log('Adding deleted_at to parents...');
        await db.execute(sql`ALTER TABLE "parents" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;`);
        
        console.log('Successfully added soft-delete columns.');
    } catch (err) {
        console.error('Error applying manual migration:', err);
    }
    process.exit(0);
}
migrate();
