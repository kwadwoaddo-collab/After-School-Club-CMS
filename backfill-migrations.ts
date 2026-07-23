import { db } from './src/db';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import fs from 'fs';

async function backfillMigrations() {
  try {
    // Make sure the drizzle schema exists
    await db.execute(sql.raw('CREATE SCHEMA IF NOT EXISTS drizzle;'));
    
    // Create migrations table if not exists (in case it doesn't)
    await db.execute(sql.raw(
      "CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (" +
      "  id SERIAL PRIMARY KEY," +
      "  hash text NOT NULL," +
      "  created_at bigint" +
      ");"
    ));

    const journalRaw = fs.readFileSync('drizzle/meta/_journal.json', 'utf8');
    const journal = JSON.parse(journalRaw);
    
    for (const entry of journal.entries) {
      if (entry.idx <= 11) {
        const fileContent = fs.readFileSync('drizzle/' + entry.tag + '.sql', 'utf8');
        const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
        
        await db.execute(sql.raw(
          "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) " +
          "SELECT '" + hash + "', " + entry.when + " " +
          "WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = '" + hash + "');"
        ));
        console.log('Inserted migration ' + entry.tag + ' with hash ' + hash);
      }
    }
    console.log('Successfully backfilled migrations 0000 to 0011.');
    process.exit(0);
  } catch (err) {
    console.error('Error backfilling migrations:', err);
    process.exit(1);
  }
}

backfillMigrations();
