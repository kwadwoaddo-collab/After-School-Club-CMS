import { db } from '../db';
import { users } from '../db/schema';
import { ilike } from 'drizzle-orm';

async function main() {
    const result = await db.query.users.findMany({
        where: ilike(users.email, 'norbertagyei@gmail.com'),
        with: { organisation: true }
    });

    if (result.length === 0) {
        console.log('No user found with that email.');
    } else {
        console.log(JSON.stringify(result, null, 2));
    }
    process.exit(0);
}

main().catch(console.error);
