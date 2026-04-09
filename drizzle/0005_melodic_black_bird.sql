ALTER TYPE "public"."invoice_status" ADD VALUE 'partially_paid' BEFORE 'paid';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'voucher' BEFORE 'other';--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "invoice_date" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "billing_period_start" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "billing_period_end" timestamp;