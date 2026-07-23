import { logger } from '@/lib/logger';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

// Force load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.DATABASE_URL!;

async function run() {
    if (!connectionString) {
        logger.error('DATABASE_URL is not defined');
        process.exit(1);
    }

    logger.info('Connecting to database for manual sync...');
    const sql = postgres(connectionString);

    try {
        logger.info('Truncating invoices and payments to ensure clean state...');
        await sql`TRUNCATE TABLE payments CASCADE;`;
        await sql`TRUNCATE TABLE invoices CASCADE;`;

        logger.info('Attempting to add parent_id to invoices table...');
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES parents(id) ON DELETE CASCADE;`;
        
        await sql`ALTER TABLE invoices ALTER COLUMN parent_id SET NOT NULL;`;

        logger.info('Attempting to add fee columns to centres table...');
        await sql`ALTER TABLE centres ADD COLUMN IF NOT EXISTS fee_self_finance NUMERIC(10, 2);`;
        await sql`ALTER TABLE centres ADD COLUMN IF NOT EXISTS fee_assisted_finance NUMERIC(10, 2);`;
        
        logger.info('Successfully updated database schema.');
    } catch (err) {
        logger.error('Migration failed:', err);
    } finally {
        await sql.end();
        process.exit();
    }
}

run();
