/* eslint-disable @typescript-eslint/no-explicit-any */
import { pgTable, uuid } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

// Minimal schema definitions to query
const studentRegistrations = pgTable('student_registrations', {
  id: uuid('id').primaryKey(),
});

const registrations = pgTable('registrations', {
  id: uuid('id').primaryKey(),
});

async function run() {
  try {
    const oldRegs = await db.select().from(studentRegistrations);
    const newRegs = await db.select().from(registrations);
    console.log(`Old registrations count: ${oldRegs.length}`);
    console.log(`New registrations count: ${newRegs.length}`);
  } catch (error: any) {
    console.error('Error running count:', error.message);
  } finally {
    await client.end();
  }
}

run();
