// Booking API diagnostic
// Run: node src/scripts/test-booking-api.mjs
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
let DATABASE_URL = '';
try {
  const env = readFileSync(envPath, 'utf8');
  DATABASE_URL = env.match(/DATABASE_URL=([^\n]+)/)?.[1]?.trim() ?? '';
} catch {}

if (!DATABASE_URL) { console.error('DATABASE_URL not found'); process.exit(1); }

let centreId = '';
try {
  const pg = (await import('pg')).default;
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  const result = await client.query("SELECT id FROM centres LIMIT 1");
  centreId = result.rows[0]?.id ?? '';
  await client.end();
} catch (e) { console.error('DB error:', e.message); process.exit(1); }

if (!centreId) { console.error('No centres'); process.exit(1); }
console.log('Centre ID:', centreId);

const payload = {
  parent: { firstName:'Test', lastName:'Diagnostics', email:`test.diag.${Date.now()}@example.com`, phone:'+44 7700 900999', preferredContact:'email' },
  children: [{ firstName:'TestChild', lastName:'Diag', schoolYear:'Y3', subjects:['Maths'], dateOfBirth:'2016-01-15', notes:'' }],
  appointment: { centreId, modality:'in_person', startAt: new Date(Date.now() + 7*24*60*60*1000).toISOString(), duration:45 },
  consent: { communications: true },
};

console.log('\nPOSTing to /api/bookings...');
const res = await fetch('http://localhost:3000/api/bookings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
const body = await res.json();
console.log('Status:', res.status);
console.log('Body:', JSON.stringify(body, null, 2));
if (body.debug) console.log('\n🔍 Debug:', body.debug);
