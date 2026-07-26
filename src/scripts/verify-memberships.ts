import { db } from '../db';
import { orgMemberships } from '../db/schema';

async function main() {
    const rows = await db.select().from(orgMemberships).limit(5);
    console.log(`✅ org_memberships table has ${rows.length}+ rows. Sample:`);
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
