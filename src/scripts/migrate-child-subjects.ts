import { logger } from '@/lib/logger';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  logger.info('Loading database client...');
  const { client } = await import('../db');
  
  try {
    logger.info('Restoring child_subjects primary key...');
    try {
      await client.unsafe(`ALTER TABLE child_subjects ADD PRIMARY KEY (id);`);
      logger.info('✅ Primary key (id) restored.');
    } catch (e) {
      logger.info('Primary key restoration notice:', e.message);
    }

    logger.info('Dropping incorrect unique constraints...');
    try {
      await client.unsafe(`ALTER TABLE child_subjects DROP CONSTRAINT IF EXISTS "child_subjects_child_id_subject_unique";`);
      logger.info('✅ Dropped child_subjects_child_id_subject_unique constraint.');
    } catch (e) {
      logger.error('Failed to drop old unique constraint:', e);
    }

    try {
      await client.unsafe(`ALTER TABLE child_subjects DROP CONSTRAINT IF EXISTS "child_subjects_child_id_subject_custom_subject_key";`);
      logger.info('✅ Dropped child_subjects_child_id_subject_custom_subject_key constraint.');
    } catch (e) {
      logger.error('Failed to drop custom unique constraint:', e);
    }

    logger.info('Adding new correct unique constraint on child_id, subject, custom_subject...');
    await client.unsafe(`
      ALTER TABLE child_subjects 
      ADD CONSTRAINT "child_subjects_child_id_subject_custom_subject_key" 
      UNIQUE("child_id", "subject", "custom_subject");
    `);
    logger.info('✅ Correct new unique constraint added successfully.');
    
    // Log the current list of constraints to verify
    const result = await client.unsafe(`
      SELECT conname, contype 
      FROM pg_constraint 
      WHERE conrelid = 'child_subjects'::regclass;
    `);
    logger.info('Current constraints on child_subjects:', result);

  } catch (error) {
    logger.error('Migration failed:', error);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
