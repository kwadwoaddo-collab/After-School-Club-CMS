import { db } from './src/db';
import { users, organisations, parents, children, bookings, registrations } from './src/db/schema';
import { eq, ilike } from 'drizzle-orm';

async function check() {
  const allUsers2 = await db.select().from(users).where(ilike(users.name, 'Kojo%'));
  console.log('Kojo Users:', allUsers2.map(u => ({ id: u.id, name: u.name, orgId: u.organisationId })));

  const orgId = allUsers2[0]?.organisationId;
  console.log('User Org ID:', orgId);
  if (!orgId) return process.exit(0);

  const orgParents = await db.select().from(parents).where(eq(parents.organisationId, orgId));
  console.log('Parent Count:', orgParents.length);

  const orgChildren = await db.select().from(children)
    .innerJoin(parents, eq(children.parentId, parents.id))
    .where(eq(parents.organisationId, orgId));
  console.log('Child Count:', orgChildren.length);

  const orgRegistrations = await db.select().from(registrations).where(eq(registrations.organisationId, orgId));
  console.log('Registration Count:', orgRegistrations.length);
  
  process.exit(0);
}
check();
