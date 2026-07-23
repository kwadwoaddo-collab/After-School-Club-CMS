CREATE TABLE "student_notes" (
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
--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "status" SET DEFAULT 'awaiting_confirmation'::text;--> statement-breakpoint
DROP TYPE "public"."registration_status_v2";--> statement-breakpoint
CREATE TYPE "public"."registration_status_v2" AS ENUM('awaiting_confirmation', 'signed_up', 'not_interested', 'pending');--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "status" SET DEFAULT 'awaiting_confirmation'::"public"."registration_status_v2";--> statement-breakpoint
ALTER TABLE "registrations" ALTER COLUMN "status" SET DATA TYPE "public"."registration_status_v2" USING "status"::"public"."registration_status_v2";--> statement-breakpoint
ALTER TABLE "registration_children" ALTER COLUMN "was_matched" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "registration_parents" ALTER COLUMN "was_matched" SET NOT NULL;--> statement-breakpoint
/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'sessions'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

ALTER TABLE "sessions" DROP CONSTRAINT "sessions_pkey";--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "session_slots" text;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "registration_pricing" text;--> statement-breakpoint
ALTER TABLE "registration_children" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "registration_parents" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "centre_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "id" text PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_centre_id_centres_id_fk" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token");