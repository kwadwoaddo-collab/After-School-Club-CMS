CREATE TYPE "public"."booking_plan_status" AS ENUM('active', 'paused', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."club_session_type" AS ENUM('breakfast', 'after_school', 'holiday');--> statement-breakpoint
CREATE TABLE "booking_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"club_session_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"weekday_pattern" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "booking_plan_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centre_id" uuid NOT NULL,
	"type" "club_session_type" NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"capacity" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centre_id" uuid NOT NULL,
	"exception_date" date NOT NULL,
	"reason" varchar(255),
	"is_closure" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"holidays" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ 
BEGIN 
  -- Migrate bookings tutor_id -> staff_id before dropping tutor_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='tutor_id') THEN
    UPDATE "bookings" SET "staff_id" = "tutor_id" WHERE "tutor_id" IS NOT NULL;
  END IF;

  -- Migrate bookings child_id -> booking_attendees before dropping child_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bookings' AND column_name='child_id') THEN
    INSERT INTO "booking_attendees" ("id", "booking_id", "child_id")
    SELECT gen_random_uuid(), "id", "child_id" FROM "bookings" WHERE "child_id" IS NOT NULL
    ON CONFLICT ("booking_id", "child_id") DO NOTHING;
  END IF;

  -- Migrate student_registrations to V2 tables before dropping it
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='student_registrations') THEN
    -- 1. Insert into registrations
    INSERT INTO "registrations" ("id", "organisation_id", "status", "created_at", "updated_at")
    SELECT 
      "id", 
      (SELECT "organisation_id" FROM "centres" WHERE "id" = sr."centre_id"),
      'awaiting_confirmation'::registration_status_v2,
      COALESCE(sr."created_at", now()),
      COALESCE(sr."updated_at", now())
    FROM "student_registrations" sr
    ON CONFLICT ("id") DO NOTHING;

    -- 2. Insert parents
    INSERT INTO "registration_parents" ("id", "registration_id", "is_primary", "submitted_first_name", "submitted_last_name", "submitted_email", "submitted_phone", "submitted_relationship")
    SELECT 
      gen_random_uuid(),
      "id",
      true,
      "parent_first_name",
      "parent_last_name",
      "email",
      "phone",
      "relationship"
    FROM "student_registrations"
    ON CONFLICT DO NOTHING;

    -- 3. Insert children
    INSERT INTO "registration_children" ("id", "registration_id", "submitted_first_name", "submitted_last_name", "submitted_date_of_birth", "submitted_school_year")
    SELECT 
      gen_random_uuid(),
      "id",
      "child_first_name",
      "child_last_name",
      "date_of_birth",
      "school_year"
    FROM "student_registrations"
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "student_registrations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "student_registrations" CASCADE;--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_child_id_children_id_fk";
--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_tutor_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "assessment_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "assessment_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "staff_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "booking_plans" ADD CONSTRAINT "booking_plans_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_plans" ADD CONSTRAINT "booking_plans_club_session_id_club_sessions_id_fk" FOREIGN KEY ("club_session_id") REFERENCES "public"."club_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_plans" ADD CONSTRAINT "booking_plans_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_sessions" ADD CONSTRAINT "club_sessions_centre_id_centres_id_fk" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exceptions" ADD CONSTRAINT "session_exceptions_centre_id_centres_id_fk" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_plans_child_idx" ON "booking_plans" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "booking_plans_session_idx" ON "booking_plans" USING btree ("club_session_id");--> statement-breakpoint
CREATE INDEX "booking_plans_term_idx" ON "booking_plans" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX "club_sessions_centre_idx" ON "club_sessions" USING btree ("centre_id");--> statement-breakpoint
CREATE INDEX "session_exceptions_centre_idx" ON "session_exceptions" USING btree ("centre_id");--> statement-breakpoint
CREATE INDEX "terms_org_idx" ON "terms" USING btree ("organisation_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_session_id_club_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."club_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "child_id";--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "tutor_id";--> statement-breakpoint
DROP TYPE "public"."registration_status";