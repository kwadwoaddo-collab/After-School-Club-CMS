import { db } from '../db';
import { organisations } from '../db/schema';

async function main() {
    const orgs = await db.select({ id: organisations.id, name: organisations.name, slug: organisations.slug }).from(organisations);
    console.log(JSON.stringify(orgs, null, 2));
    process.exit(0);
}
main().catch(console.error);
