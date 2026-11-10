CREATE TABLE IF NOT EXISTS "finance_expenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organisation_id" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
  "centre_id" uuid NOT NULL REFERENCES "centres"("id") ON DELETE CASCADE,
  "expense_date" date NOT NULL,
  "amount_pence" integer NOT NULL CHECK ("amount_pence" > 0 AND "amount_pence" <= 100000000),
  "description" varchar(300) NOT NULL CHECK (char_length(btrim("description")) BETWEEN 1 AND 300),
  "category" varchar(50) DEFAULT 'general' NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "updated_by" uuid REFERENCES "users"("id"),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "deleted_at" timestamptz,
  "deleted_by" uuid REFERENCES "users"("id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finance_expenses_org_centre_date_idx"
  ON "finance_expenses" ("organisation_id", "centre_id", "expense_date");
