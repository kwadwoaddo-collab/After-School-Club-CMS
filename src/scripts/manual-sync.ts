import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

// Force load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.DATABASE_URL!;

async function run() {
    if (!connectionString) {
        console.error('DATABASE_URL is not defined');
        process.exit(1);
    }

    console.log('Connecting to database for manual sync...');
    const sql = postgres(connectionString);

    try {
        console.log('Truncating invoices and payments to ensure clean state...');
        await sql`TRUNCATE TABLE payments CASCADE;`;
        await sql`TRUNCATE TABLE invoices CASCADE;`;

        console.log('Attempting to add parent_id to invoices table...');
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES parents(id) ON DELETE CASCADE;`;
        
        await sql`ALTER TABLE invoices ALTER COLUMN parent_id SET NOT NULL;`;

        console.log('Attempting to add fee columns to centres table...');
        await sql`ALTER TABLE centres ADD COLUMN IF NOT EXISTS fee_self_finance NUMERIC(10, 2);`;
        await sql`ALTER TABLE centres ADD COLUMN IF NOT EXISTS fee_assisted_finance NUMERIC(10, 2);`;
        
        console.log('Successfully updated database schema.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await sql.end();
        process.exit();
    }
}

run();
