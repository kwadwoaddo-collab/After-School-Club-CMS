import { db } from './src/db/index';
import * as schema from './src/db/schema';
import { eq, isNull, inArray, count } from 'drizzle-orm';

async function main() {
  try {
    const orgId = '8049f803-85e2-4bd1-bf19-49714251bea9';

    const centres = await db.select().from(schema.centres).where(eq(schema.centres.organisationId, orgId));
    const centreIds = centres.map(c => c.id);

    const tables = [
      { name: 'bookings', schema: schema.bookings, hasOrgId: false },
      { name: 'registrations', schema: schema.registrations, hasOrgId: true },
      { name: 'invoices', schema: schema.invoices, hasOrgId: true },
      { name: 'centres', schema: schema.centres, hasOrgId: true },
      { name: 'parents', schema: schema.parents, hasOrgId: true },
      { name: 'children', schema: schema.children, hasOrgId: false },
    ];

    for (const t of tables) {
      const [{ total }] = await db.select({ total: count() }).from(t.schema);
      
      let orgCount = 0;
      let nullOrgCount = 0;
      let centreCount = 0;

      if (t.hasOrgId) {
        const [{ org }] = await db.select({ org: count() }).from(t.schema).where(eq((t.schema as any).organisationId, orgId));
        orgCount = org;
        const [{ nullOrg }] = await db.select({ nullOrg: count() }).from(t.schema).where(isNull((t.schema as any).organisationId));
        nullOrgCount = nullOrg;
      }

      if ('centreId' in t.schema) {
        const [{ cent }] = await db.select({ cent: count() }).from(t.schema).where(inArray((t.schema as any).centreId, centreIds));
        centreCount = cent;
      }

      console.log(`Table: ${t.name}`);
      console.log(`  Total: ${total}`);
      if (t.hasOrgId) {
        console.log(`  Matching orgId: ${orgCount}`);
        console.log(`  Null orgId: ${nullOrgCount}`);
      }
      if ('centreId' in t.schema) {
        console.log(`  Matching centre filters: ${centreCount}`);
      }
      console.log('---');
    }
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
main();
