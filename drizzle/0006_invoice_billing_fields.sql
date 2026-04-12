ALTER TABLE "invoices" ALTER COLUMN "child_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "billing_phone" varchar(20);--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "billing_email" varchar(255);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "parent_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;