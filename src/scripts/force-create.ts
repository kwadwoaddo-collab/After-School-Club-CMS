import postgres from 'postgres';
import * as dotenv from 'dotenv';

async function run() {
  dotenv.config({ path: '.env.local' });
  const client = postgres(process.env.DATABASE_URL!);
  
  console.log('Running quick DB fix...');
  
  try {
    await client`
      CREATE TABLE IF NOT EXISTS "student_notes" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "child_id" uuid NOT NULL,
          "user_id" uuid,
          "content" text NOT NULL,
          "author_name" varchar(255) NOT NULL,
          "category" varchar(50) DEFAULT 'General' NOT NULL,
          "pinned_at" timestamp,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `;
    
    // Explicitly add missing columns in case of table already existing
    await client`ALTER TABLE "student_notes" ADD COLUMN IF NOT EXISTS "pinned_at" timestamp;`;
    
    try {
      await client`ALTER TABLE "student_notes" ADD COLUMN IF NOT EXISTS "category" varchar(50) DEFAULT 'General' NOT NULL;`;
    } catch (e: any) { console.log('Category column error:', e.message); }
    
    try {
      await client`ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;`;
    } catch (e: any) { console.log('Child FK exists or error:', e.message); }

    try {
      await client`ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;`;
    } catch (e: any) { console.log('User FK exists or error:', e.message); }
    // Migration 0009 — progress tracking columns on student_notes
    try {
      await client`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'progress_rating') THEN
            CREATE TYPE "progress_rating" AS ENUM ('excellent', 'good', 'satisfactory', 'needs_improvement', 'unsatisfactory');
          END IF;
        END $$;
      `;
    } catch (e: any) { console.log('progress_rating type:', e.message); }

    try {
      await client`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'note_type') THEN
            CREATE TYPE "note_type" AS ENUM ('general', 'progress', 'behaviour', 'subject_feedback', 'attendance_concern', 'medical');
          END IF;
        END $$;
      `;
    } catch (e: any) { console.log('note_type type:', e.message); }

    try {
      await client`ALTER TABLE "student_notes" ADD COLUMN IF NOT EXISTS "note_type" "note_type" DEFAULT 'general';`
    } catch (e: any) { console.log('note_type column:', e.message); }

    try {
      await client`ALTER TABLE "student_notes" ADD COLUMN IF NOT EXISTS "subject" varchar(100);`
    } catch (e: any) { console.log('subject column:', e.message); }

    try {
      await client`ALTER TABLE "student_notes" ADD COLUMN IF NOT EXISTS "rating" "progress_rating";`
    } catch (e: any) { console.log('rating column:', e.message); }
  } catch (e: any) {
    console.log('Error creating student_notes:', e.message);
  }

  // Discount Engine columns (Feature 2)
  try {
    await client`ALTER TABLE organisations ADD COLUMN IF NOT EXISTS discount_rules jsonb DEFAULT '[]'::jsonb;`;
    console.log('discount_rules column ready.');
  } catch (e: any) { console.log('discount_rules column:', e.message); }

  try {
    await client`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) DEFAULT 0;`;
    console.log('discount_amount column ready.');
  } catch (e: any) { console.log('discount_amount column:', e.message); }
  // Migration 0008 — payment_status enum + payments.status column
  try {
    await client`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
          CREATE TYPE "payment_status" AS ENUM('pending', 'verified', 'failed');
        END IF;
      END $$;
    `;
    console.log('payment_status enum ready.');
  } catch (e: any) { console.log('payment_status enum:', e.message); }

  try {
    await client`ALTER TABLE payments ADD COLUMN IF NOT EXISTS status "payment_status" DEFAULT 'verified' NOT NULL;`;
    console.log('payments.status column ready.');
  } catch (e: any) { console.log('payments.status column:', e.message); }

  console.log('Done resolving DB schema.');
  process.exit(0);
}

run();

