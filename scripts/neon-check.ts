import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL!;
const sql = postgres(databaseUrl, { ssl: 'require' });

async function check() {
  const version = await sql`SELECT version();`;
  console.log('PostgreSQL Version:', version[0].version);

  const dbName = await sql`SELECT current_database();`;
  console.log('Current DB:', dbName[0].current_database);

  const orgCount = await sql`SELECT COUNT(*)::int as count FROM organisations;`;
  console.log('Organisation Count:', orgCount[0].count);

  await sql.end();
}

check().catch(console.error);
