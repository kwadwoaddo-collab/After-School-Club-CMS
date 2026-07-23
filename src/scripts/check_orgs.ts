import { logger } from '@/lib/logger';
import { db } from '../db';
import { organisations } from '../db/schema';
async function run() {
    const orgs = await db.select().from(organisations);
    logger.info(orgs);
    process.exit(0);
}
run();
