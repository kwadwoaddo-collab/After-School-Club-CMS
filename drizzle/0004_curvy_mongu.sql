-- Step 1: Convert status column to text so we can drop the old enum
ALTER TABLE "bookings" ALTER COLUMN "status" SET DATA TYPE text;-->statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'booked'::text;-->statement-breakpoint

-- Step 2: Rename existing values in the text column BEFORE creating the new enum
UPDATE "bookings" SET "status" = 'booked' WHERE "status" = 'confirmed';-->statement-breakpoint
UPDATE "bookings" SET "status" = 'attended' WHERE "status" = 'completed';-->statement-breakpoint

-- Step 3: Drop old enum and create new one
DROP TYPE IF EXISTS "public"."booking_status";-->statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('booked', 'cancelled', 'rescheduled', 'attended', 'pending', 'signed_up');-->statement-breakpoint

-- Step 4: Cast text back to new enum
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'booked'::"public"."booking_status";-->statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" SET DATA TYPE "public"."booking_status" USING "status"::"public"."booking_status";-->statement-breakpoint

-- Step 5: Add fee columns to centres
ALTER TABLE "centres" ADD COLUMN IF NOT EXISTS "fees_self_finance" integer DEFAULT 4000;-->statement-breakpoint
ALTER TABLE "centres" ADD COLUMN IF NOT EXISTS "fees_assisted_finance" integer DEFAULT 800;