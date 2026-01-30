CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" varchar(50) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" varchar(100),
	"resource_name" varchar(255),
	"details" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"success" boolean NOT NULL,
	"failure_reason" varchar(50),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(20) DEFAULT 'gray' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "download_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"downloaded_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" varchar(21) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"original_filename" varchar(255) NOT NULL,
	"blob_url" varchar(1024) NOT NULL,
	"file_size" bigint NOT NULL,
	"mime_type" varchar(255) DEFAULT 'application/zip',
	"download_count" integer DEFAULT 0,
	"project_id" uuid,
	"folder_id" uuid,
	"expires_at" timestamp with time zone,
	"share_password_hash" varchar(128),
	"share_password_salt" varchar(64),
	"share_enabled" boolean,
	"download_limit_per_ip" integer,
	"download_limit_window_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "files_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"deployed_url" text,
	"category_id" uuid,
	"source_type" varchar(20) DEFAULT 'uploaded' NOT NULL,
	"github_owner" varchar(255),
	"github_repo" varchar(255),
	"github_branch" varchar(255) DEFAULT 'main',
	"last_synced_at" timestamp with time zone,
	"share_enabled" boolean,
	"share_password_required" boolean,
	"share_expiry_days" integer,
	"share_download_limit_per_ip" integer,
	"share_download_limit_window_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "share_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sharing_enabled" boolean DEFAULT true NOT NULL,
	"password_required" boolean DEFAULT false NOT NULL,
	"default_expiry_days" integer,
	"download_limit_per_ip" integer,
	"download_limit_window_minutes" integer DEFAULT 60,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "download_logs" ADD CONSTRAINT "download_logs_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_folder_id_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_resource_type" ON "audit_logs" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_auth_logs_ip_created" ON "auth_logs" USING btree ("ip_address","created_at");--> statement-breakpoint
CREATE INDEX "idx_auth_logs_created_at" ON "auth_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_download_logs_file_id" ON "download_logs" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "idx_download_logs_downloaded_at" ON "download_logs" USING btree ("downloaded_at");--> statement-breakpoint
CREATE INDEX "idx_download_logs_ip_address" ON "download_logs" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "idx_download_logs_file_ip_time" ON "download_logs" USING btree ("file_id","ip_address","downloaded_at");--> statement-breakpoint
CREATE INDEX "idx_files_public_id" ON "files" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "idx_files_created_at" ON "files" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_files_project_id" ON "files" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_files_folder_id" ON "files" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "idx_folders_project_id" ON "folders" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_folders_parent_id" ON "folders" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_projects_category_id" ON "projects" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_projects_source_type" ON "projects" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "idx_sessions_token" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires_at" ON "sessions" USING btree ("expires_at");