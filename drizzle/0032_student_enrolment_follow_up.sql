-- Additive only: no existing children, registrations, invoices or payments are rewritten.
CREATE TABLE IF NOT EXISTS student_enrolment_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
 organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 status varchar(20) NOT NULL CHECK (status IN ('active','paused','stopped')),
 effective_date date NOT NULL,
 reason text NOT NULL CHECK (length(trim(reason)) >= 5),
 expected_restart_date date,
 next_contact_date date,
 fee_review_confirmed boolean NOT NULL DEFAULT false,
 billing_reviewed_from date,
 created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (expected_restart_date IS NULL OR expected_restart_date >= effective_date)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS student_enrolment_events_child_effective_idx ON student_enrolment_events(child_id,effective_date,created_at);
CREATE INDEX IF NOT EXISTS student_enrolment_events_org_idx ON student_enrolment_events(organisation_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS student_follow_up_contacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
 organisation_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
 contacted_at timestamptz NOT NULL DEFAULT now(),
 notes text NOT NULL CHECK (length(trim(notes)) >= 5),
 next_contact_date date,
 created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS student_follow_up_contacts_child_contact_idx ON student_follow_up_contacts(child_id,contacted_at);
CREATE INDEX IF NOT EXISTS student_follow_up_contacts_org_idx ON student_follow_up_contacts(organisation_id);
--> statement-breakpoint
ALTER TABLE student_enrolment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_follow_up_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON student_enrolment_events, student_follow_up_contacts FROM PUBLIC;
