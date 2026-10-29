CREATE TABLE "centre_document_folders" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "organisation_id" uuid NOT NULL REFERENCES "organisations"("id"),
 "centre_id" uuid NOT NULL REFERENCES "centres"("id"),
 "parent_id" uuid,
 "name" varchar(120) NOT NULL,
 "version" integer DEFAULT 1 NOT NULL,
 "created_by" uuid NOT NULL REFERENCES "users"("id"),
 "updated_at" timestamptz DEFAULT now() NOT NULL,
 "removed_at" timestamptz,
 CONSTRAINT "centre_document_folders_scope_unique" UNIQUE (id, centre_id, organisation_id),
 CONSTRAINT "centre_document_folders_parent_scope" FOREIGN KEY (parent_id, centre_id, organisation_id) REFERENCES centre_document_folders(id, centre_id, organisation_id)
);
--> statement-breakpoint
CREATE INDEX "centre_document_folders_centre_idx" ON "centre_document_folders" ("organisation_id", "centre_id");
--> statement-breakpoint
ALTER TABLE "centre_documents" ADD COLUMN "folder_id" uuid;
--> statement-breakpoint
ALTER TABLE "centre_documents" ADD CONSTRAINT "centre_documents_folder_scope" FOREIGN KEY (folder_id, centre_id, organisation_id) REFERENCES centre_document_folders(id, centre_id, organisation_id);
