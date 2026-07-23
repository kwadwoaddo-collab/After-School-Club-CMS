CREATE TYPE "public"."incident_type" AS ENUM('accident', 'incident', 'medication', 'safeguarding');--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"centre_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"type" "incident_type" NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"description" text NOT NULL,
	"treatment" text,
	"witnesses" text,
	"body_map_coordinates" jsonb,
	"staff_signature" text,
	"parent_signature" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_centre_id_centres_id_fk" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "incidents_org_idx" ON "incidents" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "incidents_centre_idx" ON "incidents" USING btree ("centre_id");--> statement-breakpoint
CREATE INDEX "incidents_child_idx" ON "incidents" USING btree ("child_id");