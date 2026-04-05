import { db } from '../db';
import { organisations } from '../db/schema';
async function run() {
    const orgs = await db.select().from(organisations);
    console.log(orgs);
    process.exit(0);
}
run();
