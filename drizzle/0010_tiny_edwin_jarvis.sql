ALTER TABLE "bookings" DROP CONSTRAINT "unique_time_slot";--> statement-breakpoint
ALTER TABLE "booking_attendees" ADD COLUMN "late_minutes" integer;--> statement-breakpoint
CREATE INDEX "audit_events_org_created_idx" ON "audit_events" USING btree ("organisation_id","created_at");--> statement-breakpoint
CREATE INDEX "booking_attendees_booking_idx" ON "booking_attendees" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_attendees_child_idx" ON "booking_attendees" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "bookings_centre_status_start_idx" ON "bookings" USING btree ("centre_id","status","start_at");--> statement-breakpoint
CREATE INDEX "bookings_created_at_idx" ON "bookings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "centre_memberships_user_idx" ON "centre_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "centres_org_idx" ON "centres" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "invoices_org_status_idx" ON "invoices" USING btree ("organisation_id","status");--> statement-breakpoint
CREATE INDEX "invoices_parent_idx" ON "invoices" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "invoices_centre_idx" ON "invoices" USING btree ("centre_id");--> statement-breakpoint
CREATE INDEX "invoices_child_idx" ON "invoices" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "notifications_org_idx" ON "notifications" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "parents_org_idx" ON "parents" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "parents_email_idx" ON "parents" USING btree ("email");--> statement-breakpoint
CREATE INDEX "payments_invoice_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "registration_children_registration_idx" ON "registration_children" USING btree ("registration_id");--> statement-breakpoint
CREATE INDEX "registration_children_child_idx" ON "registration_children" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "registration_parents_registration_idx" ON "registration_parents" USING btree ("registration_id");--> statement-breakpoint
CREATE INDEX "registration_parents_parent_idx" ON "registration_parents" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "registrations_org_status_idx" ON "registrations" USING btree ("organisation_id","status");--> statement-breakpoint
CREATE INDEX "registrations_centre_idx" ON "registrations" USING btree ("centre_id");--> statement-breakpoint
CREATE INDEX "student_notes_child_idx" ON "student_notes" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "student_notes_user_idx" ON "student_notes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "student_registrations_centre_status_idx" ON "student_registrations" USING btree ("centre_id","status");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "unique_time_slot" UNIQUE("centre_id","modality","start_at","parent_id");