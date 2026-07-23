import { logger } from '@/lib/logger';

import 'dotenv/config';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

async function checkUser() {
    const email = 'kaddo@sydenahmasc.co.uk';
    logger.info(`Checking for user: ${email}`);

    const user = await db.query.users.findFirst({
        where: eq(users.email, email),
        with: {
            organisation: true,
        }
    });

    if (user) {
        logger.info('User FOUND.');
        logger.info(`ID: ${user.id}`);
        logger.info(`Role: ${user.role}`);
        logger.info(`Organisation ID: ${user.organisationId}`);
        if (user.organisation) {
            logger.info(`Organisation Name: ${user.organisation.name}`);
        } else {
            logger.info('No Organisation linked.');
        }
    } else {
        logger.info('User NOT FOUND.');
    }

    process.exit(0);
}

checkUser().catch((err) => {
    logger.error('Error checking user:', err);
    process.exit(1);
});
