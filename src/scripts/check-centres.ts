import { db } from '../db';
import { centres, organisations } from '../db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    const rows = await db
        .select({ id: centres.id, name: centres.name, slug: centres.slug, orgId: centres.organisationId, orgName: organisations.name })
        .from(centres)
        .innerJoin(organisations, eq(centres.organisationId, organisations.id));
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
}
main().catch(console.error);
