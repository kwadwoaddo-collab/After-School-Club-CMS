-- portal_notifications was originally bundled into 0011_add_soft_delete.sql,
-- which drizzle-kit already recorded as applied in production, so it never
-- re-ran when the table was actually missing. This is a standalone,
-- idempotent corrective migration.
CREATE TABLE IF NOT EXISTS "portal_notifications" (
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
DO $$ BEGIN
	ALTER TABLE "portal_notifications" ADD CONSTRAINT "portal_notifications_parent_id_parents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
