-- Migration: 0022 - Add org_memberships table for multi-tenancy
-- Creates a junction table mapping users to multiple organisations with roles.
-- Existing users are seeded from users.organisation_id + users.role.

CREATE TABLE IF NOT EXISTS "org_memberships" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "organisation_id" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
    "role" "user_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "org_memberships_user_org_unique" UNIQUE("user_id", "organisation_id")
);

CREATE INDEX IF NOT EXISTS "org_memberships_user_idx" ON "org_memberships" ("user_id");
CREATE INDEX IF NOT EXISTS "org_memberships_org_idx" ON "org_memberships" ("organisation_id");

-- Seed from existing users (backfill all current org assignments)
INSERT INTO "org_memberships" ("user_id", "organisation_id", "role")
SELECT "id", "organisation_id", "role"
FROM "users"
WHERE "organisation_id" IS NOT NULL
ON CONFLICT ("user_id", "organisation_id") DO NOTHING;
