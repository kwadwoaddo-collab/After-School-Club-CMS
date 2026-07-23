CREATE TYPE "public"."instalment_status" AS ENUM('pending', 'processing', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."parent_credit_type" AS ENUM('credit', 'debit', 'refund');--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'gocardless';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'tax_free_childcare';--> statement-breakpoint
CREATE TABLE "invoice_instalments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"status" "instalment_status" DEFAULT 'pending' NOT NULL,
	"gocardless_payment_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"parent_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"type" "parent_credit_type" NOT NULL,
	"reason" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "tfc_reference" varchar(50);--> statement-breakpoint
ALTER TABLE "club_sessions" ADD COLUMN "am_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "club_sessions" ADD COLUMN "pm_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "club_sessions" ADD COLUMN "activity_description" text;--> statement-breakpoint
ALTER TABLE "club_sessions" ADD COLUMN "early_bird_cutoff_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "club_sessions" ADD COLUMN "early_bird_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "invoice_instalments" ADD CONSTRAINT "invoice_instalments_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_instalments" ADD CONSTRAINT "invoice_instalments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_credits" ADD CONSTRAINT "parent_credits_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_credits" ADD CONSTRAINT "parent_credits_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_instalments_org_idx" ON "invoice_instalments" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "invoice_instalments_invoice_idx" ON "invoice_instalments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "parent_credits_org_idx" ON "parent_credits" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "parent_credits_parent_idx" ON "parent_credits" USING btree ("parent_id");