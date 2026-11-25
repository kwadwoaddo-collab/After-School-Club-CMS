-- Parent e-contract signing (additive only: new tables, no changes to existing columns/data).
-- Retention: contracts and their signed PDFs are never deleted by cascade. Deleting a billing config
-- detaches the contract (billing_config_id -> NULL); deleting a centre/parent/organisation that still has
-- contracts is blocked (RESTRICT). Contracts are archived (archived_at), never deleted.
CREATE TABLE IF NOT EXISTS "contract_centre_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organisation_id" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
  "centre_id" uuid NOT NULL REFERENCES "centres"("id") ON DELETE CASCADE,
  "provider_name" varchar(255),
  "address" text,
  "phone" varchar(50),
  "website" varchar(255),
  "ofsted_reg_no" varchar(50),
  "signatory_name" varchar(200),
  "signatory_role" varchar(120),
  "updated_by" uuid REFERENCES "users"("id"),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "contract_centre_settings_centre_unique" UNIQUE ("centre_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contract_centre_settings_org_idx" ON "contract_centre_settings" ("organisation_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contracts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organisation_id" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE RESTRICT,
  "centre_id" uuid NOT NULL REFERENCES "centres"("id") ON DELETE RESTRICT,
  "parent_id" uuid NOT NULL REFERENCES "parents"("id") ON DELETE RESTRICT,
  "billing_config_id" uuid REFERENCES "billing_configs"("id") ON DELETE SET NULL,
  "status" varchar(20) DEFAULT 'draft' NOT NULL CHECK ("status" IN ('draft','sent','signed','expired','revoked')),
  "token_hash" varchar(64) NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "sent_at" timestamptz,
  "sent_to_email" varchar(255),
  "template_version" varchar(40) NOT NULL,
  "template_hash" varchar(64) NOT NULL,
  "amount_pence" integer NOT NULL CHECK ("amount_pence" > 0),
  -- Children covered when the contract was sent (compared with the family's current plan to flag changes).
  "child_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  "snapshot" text NOT NULL,
  "signer_name" varchar(200),
  "signature_kind" varchar(10) CHECK ("signature_kind" IN ('drawn','typed')),
  "signature_data" text,
  "signed_at" timestamptz,
  "signer_ip" varchar(64),
  "signer_user_agent" varchar(400),
  "copy_emailed_at" timestamptz,
  "revoked_at" timestamptz,
  "archived_at" timestamptz,
  "archived_by" uuid REFERENCES "users"("id"),
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "contracts_token_hash_unique" UNIQUE ("token_hash")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contracts_config_idx" ON "contracts" ("billing_config_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contracts_parent_centre_idx" ON "contracts" ("parent_id", "centre_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contracts_org_centre_idx" ON "contracts" ("organisation_id", "centre_id");
--> statement-breakpoint
-- At most one open (unsigned, unrevoked) contract per family billing config.
CREATE UNIQUE INDEX IF NOT EXISTS "contracts_one_open_per_config" ON "contracts" ("billing_config_id") WHERE "status" IN ('draft','sent');
--> statement-breakpoint
-- Signed PDF kept in a separate table so listings never select the bytes (private, staff-only download route).
CREATE TABLE IF NOT EXISTS "contract_pdfs" (
  "contract_id" uuid PRIMARY KEY REFERENCES "contracts"("id") ON DELETE RESTRICT,
  "content" bytea NOT NULL,
  "size_bytes" integer NOT NULL,
  "sha256" varchar(64) NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Seed Sydenham provider details from the signed-off contract (insert only; no-op if no matching centre or already set).
INSERT INTO "contract_centre_settings" ("organisation_id", "centre_id", "provider_name", "address", "phone", "website", "ofsted_reg_no")
SELECT c."organisation_id", c."id", 'Sydenham After School Club LTD', '105 Sydenham Road, London, SE26 5UA', '020 3621 3942', 'www.sydenhamasc.co.uk', 'EY2854827'
FROM "centres" c WHERE lower(c."name") LIKE '%sydenham%'
ON CONFLICT ("centre_id") DO NOTHING;
