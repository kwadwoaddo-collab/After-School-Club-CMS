ALTER TABLE "users" ADD COLUMN "dbs_number" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "dbs_expiry_date" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_aid_expiry_date" date;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "safeguarding_expiry_date" date;