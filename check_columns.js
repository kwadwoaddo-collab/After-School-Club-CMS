const { Client } = require('pg');

async function checkColumns() {
  const dbUrl = 'postgresql://neondb_owner:npg_X0JSKshA5lzq@ep-noisy-salad-abnby98d-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require';
  
  const client = new Client({
    connectionString: dbUrl,
  });

  try {
    await client.connect();
    console.log('Connected to DB');

    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'booking_attendees';
    `);

    const columns = result.rows.map(r => r.column_name);
    
    console.log('Columns in booking_attendees:');
    const colsToCheck = [
      'attendance_status',
      'attendance_note',
      'attendance_marked_at',
      'attendance_marked_by'
    ];

    let missing = false;
    for (const col of colsToCheck) {
      if (columns.includes(col)) {
        console.log(`✅ ${col} EXISTS`);
      } else {
        console.log(`❌ ${col} IS MISSING`);
        missing = true;
      }
    }

  } catch (err) {
    console.error('Error connecting to DB:', err);
  } finally {
    await client.end();
  }
}

checkColumns();
