import { logger } from '@/lib/logger';


import dotenv from 'dotenv';
import path from 'path';

// Load .env.local explicitly
const envPath = path.resolve(process.cwd(), '.env.local');
logger.info(`Loading environment from: ${envPath}`);
dotenv.config({ path: envPath });

import { db } from '../db';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';

async function checkDatabase() {
    logger.info('--- Database Connection Check ---');

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        logger.error('❌ ERROR: DATABASE_URL is not defined in environment.');
        process.exit(1);
    } else {
        // Mask password in logs
        const masked = connectionString.replace(/:([^@]+)@/, ':****@');
        logger.info(`✅ Using DATABASE_URL: ${masked}`);
    }

    try {
        logger.info('Connecting to database...');
        // Direct postgres connection test
        const sqlConnection = postgres(connectionString);
        const result = await sqlConnection`SELECT 1 as connected`;
        logger.info('✅ Connected successfully!');
        logger.info('Query Result:', result);

        // Check if tables exist
        const tables = await sqlConnection`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
        logger.info('--- Found Tables (Schema) ---');
        if (tables.length === 0) {
            logger.warn('⚠️ No tables found. Database might be empty. Did you run migrations?');
        } else {
            tables.forEach(t => logger.info(`- ${t.table_name}`));
        }

        // Explicit checks for common NextAuth missing tables
        logger.info('--- Testing Key Auth Tables (Exact Match) ---');
        const authTables = ['user', 'users', 'account', 'accounts', 'session', 'sessions', 'verification_token', 'verification_tokens'];
        for (const table of authTables) {
            try {
                await sqlConnection.unsafe(`SELECT 1 FROM "${table}" LIMIT 1`);
                logger.info(`✅ Table '${table}' exists`);
            } catch (err) {
                if (err.code === '42P01') {
                    logger.info(`❌ Table '${table}' DOES NOT exist`);
                } else {
                    logger.info(`⚠️ Error checking '${table}': ${err.message}`);
                }
            }
        }

        await sqlConnection.end();
        process.exit(0);
    } catch (error) {
        logger.error('❌ Connection Failed:', error.message);
        if (error.code) logger.error('Error Code:', error.code);
        if (error.cause) logger.error('Cause:', error.cause);
        process.exit(1);
    }
}

checkDatabase();
