import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  console.log('Loading database client...');
  const { client } = await import('../db');
  
  try {
    console.log('Restoring child_subjects primary key...');
    try {
      await client.unsafe(`ALTER TABLE child_subjects ADD PRIMARY KEY (id);`);
      console.log('✅ Primary key (id) restored.');
    } catch (e: any) {
      console.log('Primary key restoration notice:', e.message);
    }

    console.log('Dropping incorrect unique constraints...');
    try {
      await client.unsafe(`ALTER TABLE child_subjects DROP CONSTRAINT IF EXISTS "child_subjects_child_id_subject_unique";`);
      console.log('✅ Dropped child_subjects_child_id_subject_unique constraint.');
    } catch (e: any) {
      console.error('Failed to drop old unique constraint:', e);
    }

    try {
      await client.unsafe(`ALTER TABLE child_subjects DROP CONSTRAINT IF EXISTS "child_subjects_child_id_subject_custom_subject_key";`);
      console.log('✅ Dropped child_subjects_child_id_subject_custom_subject_key constraint.');
    } catch (e: any) {
      console.error('Failed to drop custom unique constraint:', e);
    }

    console.log('Adding new correct unique constraint on child_id, subject, custom_subject...');
    await client.unsafe(`
      ALTER TABLE child_subjects 
      ADD CONSTRAINT "child_subjects_child_id_subject_custom_subject_key" 
      UNIQUE("child_id", "subject", "custom_subject");
    `);
    console.log('✅ Correct new unique constraint added successfully.');
    
    // Log the current list of constraints to verify
    const result = await client.unsafe(`
      SELECT conname, contype 
      FROM pg_constraint 
      WHERE conrelid = 'child_subjects'::regclass;
    `);
    console.log('Current constraints on child_subjects:', result);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
