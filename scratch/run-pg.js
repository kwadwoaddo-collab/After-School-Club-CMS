const { Client } = require('pg');

async function run() {
    const client = new Client({
        connectionString: 'postgresql://neondb_owner:npg_X0JSKshA5lzq@ep-noisy-salad-abnby98d-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require'
    });
    
    try {
        await client.connect();
        
        console.log('Adding deleted_at to children...');
        await client.query(`ALTER TABLE "children" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;`);
        
        console.log('Adding deleted_at to parents...');
        await client.query(`ALTER TABLE "parents" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;`);
        
        console.log('Successfully updated schema!');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}
run();
