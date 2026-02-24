import { db } from './src/db';
import { eq } from 'drizzle-orm';
import { centres } from './src/db/schema';

async function main() {
  try {
    const allCentres = await db.query.centres.findMany({
      orderBy: (centres, { asc }) => [asc(centres.name)],
    });

    console.log("Centres length:", allCentres.length);
  } catch (err) {
    console.error("DIAGNOSE ERROR:", err);
  } finally {
    process.exit();
  }
}
main();
