CREATE TYPE "public"."attendance_status" AS ENUM('present', 'absent', 'late', 'no_show', 'excused');--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD COLUMN "attendance_status" "attendance_status";--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD COLUMN "attendance_note" text;--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD COLUMN "attendance_marked_at" timestamp;--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD COLUMN "attendance_marked_by" uuid;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "organisation_id" uuid;--> statement-breakpoint
ALTER TABLE "children" ADD COLUMN "centre_id" uuid;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "parent_signature" text;--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD CONSTRAINT "booking_attendees_attendance_marked_by_users_id_fk" FOREIGN KEY ("attendance_marked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_centre_id_centres_id_fk" FOREIGN KEY ("centre_id") REFERENCES "public"."centres"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_centre_idx" ON "bookings" USING btree ("centre_id");--> statement-breakpoint
CREATE INDEX "bookings_parent_idx" ON "bookings" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "children_parent_idx" ON "children" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "children_org_idx" ON "children" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "children_centre_idx" ON "children" USING btree ("centre_id");--> statement-breakpoint
CREATE INDEX "users_org_idx" ON "users" USING btree ("organisation_id");