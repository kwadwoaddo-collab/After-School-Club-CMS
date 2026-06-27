CREATE TYPE "public"."note_type" AS ENUM('general', 'progress', 'behaviour', 'subject_feedback', 'attendance_concern', 'medical');--> statement-breakpoint
CREATE TYPE "public"."progress_rating" AS ENUM('excellent', 'good', 'satisfactory', 'needs_improvement', 'unsatisfactory');--> statement-breakpoint
ALTER TABLE "student_notes" ADD COLUMN "note_type" "note_type" DEFAULT 'general';--> statement-breakpoint
ALTER TABLE "student_notes" ADD COLUMN "subject" varchar(100);--> statement-breakpoint
ALTER TABLE "student_notes" ADD COLUMN "rating" "progress_rating";