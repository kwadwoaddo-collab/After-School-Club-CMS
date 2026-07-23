CREATE TYPE "public"."funding_type" AS ENUM('tax_free_childcare', 'childcare_vouchers', 'student_finance', 'self_funded', 'other');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('booking_created', 'booking_cancelled', 'booking_rescheduled', 'assessment_reminder', 'system');--> statement-breakpoint
CREATE TYPE "public"."parent_relationship" AS ENUM('mother', 'father', 'guardian', 'other');--> statement-breakpoint
CREATE TYPE "public"."registration_status_v2" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."student_source" AS ENUM('assessment', 'registration', 'both');--> statement-breakpoint
ALTER TYPE "public"."subject" ADD VALUE 'Other';--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"booking_id" uuid,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration_children" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"child_id" uuid,
	"submitted_first_name" varchar(100) NOT NULL,
	"submitted_last_name" varchar(100) NOT NULL,
	"submitted_date_of_birth" timestamp,
	"submitted_school_year" varchar(10),
	"was_matched" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "registration_parents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"parent_id" uuid,
	"is_primary" boolean DEFAULT true,
	"submitted_first_name" varchar(100) NOT NULL,
	"submitted_last_name" varchar(100) NOT NULL,
	"submitted_email" varchar(255),
	"submitted_phone" varchar(20),
	"submitted_relationship" varchar(50),
	"was_matched" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"status" "registration_status_v2" DEFAULT 'pending' NOT NULL,
	"start_date" timestamp,
	"funding_types" text[],
	"funding_other" text,
	"has_special_needs" boolean DEFAULT false,
	"special_needs_details" text,
	"emergency_contact_name" varchar(255),
	"emergency_contact_phone" varchar(20),
	"emergency_contact_relationship" varchar(50),
	"terms_agreed" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_session_token_unique";--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "sessions" ADD PRIMARY KEY ("session_token");--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD COLUMN "feedback_notes" text;--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD COLUMN "feedback_score" varchar(50);--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD COLUMN "feedback_attachment_base64" text;--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD COLUMN "feedback_attachment_mime" varchar(50);--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD COLUMN "feedback_status" varchar(20) DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD COLUMN "feedback_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "child_subjects" ADD COLUMN "custom_subject" varchar(100);--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "source" "student_source" DEFAULT 'assessment';--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "is_registered" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "registered_at" timestamp;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "registration_terms" text;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "session_slots" text;--> statement-breakpoint
ALTER TABLE "parents" ADD COLUMN "relationship" "parent_relationship";--> statement-breakpoint
ALTER TABLE "parents" ADD COLUMN "address_line1" varchar(255);--> statement-breakpoint
ALTER TABLE "parents" ADD COLUMN "address_line2" varchar(255);--> statement-breakpoint
ALTER TABLE "parents" ADD COLUMN "city" varchar(100);--> statement-breakpoint
ALTER TABLE "parents" ADD COLUMN "postcode" varchar(10);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "name" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_reset_token" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_reset_expiry" timestamp;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_children" ADD CONSTRAINT "registration_children_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_children" ADD CONSTRAINT "registration_children_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_parents" ADD CONSTRAINT "registration_parents_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_parents" ADD CONSTRAINT "registration_parents_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint