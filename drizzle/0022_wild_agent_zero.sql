CREATE TABLE "org_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_memberships_user_id_organisation_id_unique" UNIQUE("user_id","organisation_id")
);
--> statement-breakpoint
ALTER TABLE "centres" ADD COLUMN "subdomain" varchar(63);--> statement-breakpoint
ALTER TABLE "organisations" ADD COLUMN "subdomain" varchar(63);--> statement-breakpoint
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "org_memberships_user_idx" ON "org_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "org_memberships_org_idx" ON "org_memberships" USING btree ("organisation_id");--> statement-breakpoint
ALTER TABLE "centres" ADD CONSTRAINT "centres_subdomain_unique" UNIQUE("subdomain");--> statement-breakpoint
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_subdomain_unique" UNIQUE("subdomain");