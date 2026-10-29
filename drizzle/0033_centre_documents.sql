CREATE TABLE "centre_documents" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "organisation_id" uuid NOT NULL REFERENCES "organisations"("id"),
 "centre_id" uuid NOT NULL REFERENCES "centres"("id"),
 "name" varchar(120) NOT NULL,
 "original_filename" varchar(200) NOT NULL,
 "size_bytes" integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 3145728),
 "content" bytea NOT NULL,
 "version" integer DEFAULT 1 NOT NULL,
 "created_by" uuid NOT NULL REFERENCES "users"("id"),
 "updated_at" timestamptz DEFAULT now() NOT NULL,
 "removed_at" timestamptz,
 CONSTRAINT "centre_documents_payload_size" CHECK (octet_length(content) = size_bytes)
);
--> statement-breakpoint
CREATE INDEX "centre_documents_centre_idx" ON "centre_documents" ("organisation_id", "centre_id");
