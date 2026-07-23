CREATE TYPE "public"."waitlist_status" AS ENUM('waiting', 'offered', 'accepted', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "authorised_collectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"relationship" varchar(100) NOT NULL,
	"phone" varchar(50),
	"collection_password" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"club_session_id" uuid NOT NULL,
	"session_date" date,
	"term_id" uuid,
	"child_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"status" "waitlist_status" DEFAULT 'waiting' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_plans" ADD COLUMN "organisation_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "allergies" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "dietary_requirements" text;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "medical_conditions" text;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "medication_notes" text;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "gp_name" varchar(255);--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "gp_phone" varchar(50);--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "sen_details" text;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "photo_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "sun_cream_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "first_aid_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "club_sessions" ADD COLUMN "organisation_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "session_exceptions" ADD COLUMN "organisation_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "authorised_collectors" ADD CONSTRAINT "authorised_collectors_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorised_collectors" ADD CONSTRAINT "authorised_collectors_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_club_session_id_club_sessions_id_fk" FOREIGN KEY ("club_session_id") REFERENCES "public"."club_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_collectors_child_idx" ON "authorised_collectors" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "auth_collectors_org_idx" ON "authorised_collectors" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "waitlist_entries_org_idx" ON "waitlist_entries" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "waitlist_entries_session_idx" ON "waitlist_entries" USING btree ("club_session_id");--> statement-breakpoint
CREATE INDEX "waitlist_entries_child_idx" ON "waitlist_entries" USING btree ("child_id");--> statement-breakpoint
ALTER TABLE "booking_plans" ADD CONSTRAINT "booking_plans_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_sessions" ADD CONSTRAINT "club_sessions_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_exceptions" ADD CONSTRAINT "session_exceptions_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_plans_org_idx" ON "booking_plans" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "club_sessions_org_idx" ON "club_sessions" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "session_exceptions_org_idx" ON "session_exceptions" USING btree ("organisation_id");