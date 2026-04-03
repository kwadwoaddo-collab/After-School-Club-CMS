import { db } from './src/db';
import { users, parents, children, bookings, registrations } from './src/db/schema';
import { eq, sql } from 'drizzle-orm';

async function check() {
  const orgId = '8049f803-85e2-4bd1-bf19-49714251bea9';
  console.log('Org ID:', orgId);

  try {
      const studentKpis = await db.select({ 
          total: sql<number>`count(distinct ${children.id})::int`,
      })
          .from(children)
          .innerJoin(parents, eq(children.parentId, parents.id))
          .where(eq(parents.organisationId, orgId));
      
      console.log('Student KPIs:', studentKpis);

      const registrationKpis = await db.select({
          total: sql<number>`count(*)::int`,
      }).from(registrations).where(eq(registrations.organisationId, orgId));

      console.log('Registration KPIs:', registrationKpis);
  } catch (e) {
      console.error('Error fetching KPIs:', e);
  }
  
  process.exit(0);
}
check();
