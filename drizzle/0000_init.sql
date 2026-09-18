CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_key" varchar(24) NOT NULL,
	"job_title" text,
	"profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"crm_application_id" text,
	"crm_candidate_id" text,
	"error_code" text,
	CONSTRAINT "applications_status_check" CHECK ("applications"."status" in ('forwarded', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target" text,
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "banners" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"link_url" text,
	"link_label" text,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pinned_jobs" (
	"job_key" varchar(24) PRIMARY KEY NOT NULL,
	"position" integer NOT NULL,
	"title" text,
	"pinned_by" text NOT NULL,
	"pinned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" text NOT NULL,
	"city" text,
	"consent_at" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email"),
	CONSTRAINT "profiles_source_check" CHECK ("profiles"."source" in ('apply', 'signup'))
);
--> statement-breakpoint
CREATE TABLE "site_text_versions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"body" text NOT NULL,
	"saved_by" text NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_texts" (
	"key" text PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applications_created_idx" ON "applications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "applications_profile_idx" ON "applications" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_at_idx" ON "audit_log" USING btree ("actor","at");--> statement-breakpoint
CREATE INDEX "banners_active_idx" ON "banners" USING btree ("active");--> statement-breakpoint
CREATE INDEX "site_text_versions_key_idx" ON "site_text_versions" USING btree ("key","id");