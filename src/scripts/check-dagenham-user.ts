import 'dotenv/config';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

async function main() {
    const user = await db.query.users.findFirst({
        where: eq(users.email, 'dagenhamafterschoolclub@gmail.com'),
        with: { organisation: true }
    });
    console.log(JSON.stringify(user, null, 2));
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
