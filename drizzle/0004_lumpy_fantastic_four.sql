CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'bank_transfer', 'stripe', 'other');--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE 'pending';--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE 'signed_up';--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"centre_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"due_date" timestamp NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"transaction_reference" varchar(255),
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "fee_self_finance" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "fee_assisted_finance" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "bank_name" varchar(255);--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "sort_code" varchar(20);--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "account_no" varchar(20);--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "ofsted_id" varchar(50);--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "manager_name" varchar(255);--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "signature_url" varchar(500);--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "registered_sessions" text[];--> statement-breakpoint
ALTER TABLE "registration_children" ADD COLUMN "submitted_sessions" text[];--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_centre_id_centres_id_fk" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;