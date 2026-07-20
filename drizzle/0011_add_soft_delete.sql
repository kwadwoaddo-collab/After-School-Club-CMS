CREATE TYPE "public"."absence_reason" AS ENUM('illness', 'holiday', 'family', 'other');--> statement-breakpoint
CREATE TYPE "public"."billing_status" AS ENUM('active', 'paused', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."session_type" AS ENUM('scheduled', 'extra');--> statement-breakpoint
CREATE TABLE "billing_config_children" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bcc_config_child_unique" UNIQUE("config_id","child_id")
);
--> statement-breakpoint
CREATE TABLE "billing_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"centre_id" uuid NOT NULL,
	"parent_id" uuid NOT NULL,
	"agreed_monthly_pence" integer DEFAULT 0 NOT NULL,
	"billing_anchor_date" date NOT NULL,
	"billing_end_date" date,
	"invoice_lead_days" integer DEFAULT 7 NOT NULL,
	"status" "billing_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_configs_parent_centre_unique" UNIQUE("parent_id","centre_id")
);
--> statement-breakpoint
CREATE TABLE "billing_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_config_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"invoice_id" uuid,
	"amount_pence" integer DEFAULT 0 NOT NULL,
	"run_at" timestamp DEFAULT now() NOT NULL,
	"run_by" uuid,
	"success" boolean DEFAULT true NOT NULL,
	"error_log" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_id" uuid NOT NULL,
	"academic_year" varchar(9) NOT NULL,
	"sessions_amount" integer DEFAULT 1 NOT NULL,
	"admin_id" uuid,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "child_subjects" DROP CONSTRAINT "child_subjects_child_id_subject_unique";--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD COLUMN "check_in_time" varchar(5);--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD COLUMN "check_out_time" varchar(5);--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD COLUMN "session_type" "session_type";--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD COLUMN "absence_reason" "absence_reason";--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD COLUMN "forgiven_by" uuid;--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD COLUMN "forgiven_at" timestamp;--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD COLUMN "forgiven_note" text;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "flag_homework" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "flag_behaviour" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "flag_note" text;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "billing_config_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "billing_period_label" varchar(100);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "covered_children_json" jsonb;--> statement-breakpoint
ALTER TABLE "parents" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "billing_config_children" ADD CONSTRAINT "billing_config_children_config_id_billing_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."billing_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_config_children" ADD CONSTRAINT "billing_config_children_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_runs" ADD CONSTRAINT "billing_runs_billing_config_id_billing_configs_id_fk" FOREIGN KEY ("billing_config_id") REFERENCES "public"."billing_configs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_notifications" ADD CONSTRAINT "portal_notifications_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_credits" ADD CONSTRAINT "session_credits_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_credits" ADD CONSTRAINT "session_credits_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bcc_config_idx" ON "billing_config_children" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX "bcc_child_idx" ON "billing_config_children" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "billing_configs_org_idx" ON "billing_configs" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "billing_configs_centre_idx" ON "billing_configs" USING btree ("centre_id");--> statement-breakpoint
CREATE INDEX "billing_configs_parent_idx" ON "billing_configs" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "billing_runs_config_idx" ON "billing_runs" USING btree ("billing_config_id");--> statement-breakpoint
CREATE INDEX "billing_runs_period_idx" ON "billing_runs" USING btree ("period_start");--> statement-breakpoint
CREATE INDEX "billing_runs_invoice_idx" ON "billing_runs" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "session_credits_child_idx" ON "session_credits" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "session_credits_year_idx" ON "session_credits" USING btree ("academic_year");--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD CONSTRAINT "booking_attendees_forgiven_by_users_id_fk" FOREIGN KEY ("forgiven_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_subjects" ADD CONSTRAINT "child_subjects_child_id_subject_custom_subject_unique" UNIQUE("child_id","subject","custom_subject");