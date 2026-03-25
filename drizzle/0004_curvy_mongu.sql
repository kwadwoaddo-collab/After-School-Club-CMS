ALTER TABLE "bookings" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'booked'::text;--> statement-breakpoint
DROP TYPE "public"."booking_status";--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('booked', 'cancelled', 'rescheduled', 'attended', 'pending', 'signed_up');--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'booked'::"public"."booking_status";--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "status" SET DATA TYPE "public"."booking_status" USING "status"::"public"."booking_status";--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "fees_self_finance" integer DEFAULT 4000;--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "fees_assisted_finance" integer DEFAULT 800;