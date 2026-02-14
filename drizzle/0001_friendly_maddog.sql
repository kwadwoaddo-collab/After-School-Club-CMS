CREATE TYPE "public"."registration_status" AS ENUM('pending', 'approved', 'contacted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'cancelled', 'past_due', 'trialing');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "accounts_provider_provider_account_id_unique" UNIQUE("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "booking_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	CONSTRAINT "booking_attendees_booking_id_child_id_unique" UNIQUE("booking_id","child_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "student_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"centre_id" uuid NOT NULL,
	"parent_first_name" varchar(100) NOT NULL,
	"parent_last_name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"relationship" varchar(50) NOT NULL,
	"child_first_name" varchar(100) NOT NULL,
	"child_last_name" varchar(100) NOT NULL,
	"date_of_birth" timestamp NOT NULL,
	"school_year" varchar(10) NOT NULL,
	"notes" text,
	"subjects" text[] NOT NULL,
	"preferred_days" text[] NOT NULL,
	"preferred_times" text[],
	"lesson_type" varchar(50) NOT NULL,
	"status" "registration_status" DEFAULT 'pending' NOT NULL,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_token_unique" UNIQUE("token"),
	CONSTRAINT "verification_tokens_identifier_token_unique" UNIQUE("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "child_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "children" ALTER COLUMN "date_of_birth" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "organisation_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'ORG_OWNER';--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "logo_url" varchar(500);--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "contact_email" varchar(255);--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "contact_phone" varchar(20);--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "website" varchar(255);--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "privacy_policy_url" varchar(500);--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "brand_color" varchar(7) DEFAULT '#4F46E5' NOT NULL;--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "stripe_customer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "subscription_status" "subscription_status" DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "subscription_tier" varchar(50) DEFAULT 'free';--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "subscription_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "parents" ADD COLUMN "organisation_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "parents" ADD COLUMN "stripe_customer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "parents" ADD COLUMN "magic_link_token" varchar(255);--> statement-breakpoint
ALTER TABLE "parents" ADD COLUMN "magic_link_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "image" varchar(500);--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD CONSTRAINT "booking_attendees_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD CONSTRAINT "booking_attendees_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_registrations" ADD CONSTRAINT "student_registrations_centre_id_centres_id_fk" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parents" ADD CONSTRAINT "parents_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "children" DROP COLUMN "special_needs";--> statement-breakpoint
ALTER TABLE "parents" ADD CONSTRAINT "parents_magic_link_token_unique" UNIQUE("magic_link_token");