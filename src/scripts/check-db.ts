

import dotenv from 'dotenv';
import path from 'path';

// Load .env.local explicitly
const envPath = path.resolve(process.cwd(), '.env.local');
console.log(`Loading environment from: ${envPath}`);
dotenv.config({ path: envPath });

import { db } from '../db';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';

async function checkDatabase() {
    console.log('--- Database Connection Check ---');

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('❌ ERROR: DATABASE_URL is not defined in environment.');
        process.exit(1);
    } else {
        // Mask password in logs
        const masked = connectionString.replace(/:([^@]+)@/, ':****@');
        console.log(`✅ Using DATABASE_URL: ${masked}`);
    }

    try {
        console.log('Connecting to database...');
        // Direct postgres connection test
        const sqlConnection = postgres(connectionString);
        const result = await sqlConnection`SELECT 1 as connected`;
        console.log('✅ Connected successfully!');
        console.log('Query Result:', result);

        // Check if tables exist
        const tables = await sqlConnection`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
        console.log('--- Found Tables (Schema) ---');
        if (tables.length === 0) {
            console.warn('⚠️ No tables found. Database might be empty. Did you run migrations?');
        } else {
            tables.forEach(t => console.log(`- ${t.table_name}`));
        }

        // Explicit checks for common NextAuth missing tables
        console.log('--- Testing Key Auth Tables (Exact Match) ---');
        const authTables = ['user', 'users', 'account', 'accounts', 'session', 'sessions', 'verification_token', 'verification_tokens'];
        for (const table of authTables) {
            try {
                await sqlConnection.unsafe(`SELECT 1 FROM "${table}" LIMIT 1`);
                console.log(`✅ Table '${table}' exists`);
            } catch (err: any) {
                if (err.code === '42P01') {
                    console.log(`❌ Table '${table}' DOES NOT exist`);
                } else {
                    console.log(`⚠️ Error checking '${table}': ${err.message}`);
                }
            }
        }

        await sqlConnection.end();
        process.exit(0);
    } catch (error: any) {
        console.error('❌ Connection Failed:', error.message);
        if (error.code) console.error('Error Code:', error.code);
        if (error.cause) console.error('Cause:', error.cause);
        process.exit(1);
    }
}

checkDatabase();
