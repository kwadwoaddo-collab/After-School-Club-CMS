import { db } from './src/db';
import { organisations } from './src/db/schema';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    console.log('Fetching orgs...');
    try {
        const allOrgs = await db.select().from(organisations);
        console.log('Orgs:');
        console.log(allOrgs.map(o => o.slug).join(', '));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

main();
