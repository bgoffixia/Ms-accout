CREATE TYPE "public"."application_status" AS ENUM ('draft', 'submitted', 'under_review', 'needs_information', 'approved', 'rejected');
--> statement-breakpoint
CREATE TYPE "public"."support_status" AS ENUM ('open', 'in_progress', 'resolved', 'answered', 'closed');
--> statement-breakpoint
CREATE TYPE "public"."guest_preapplication_status" AS ENUM ('received', 'contacted', 'closed');
--> statement-breakpoint
CREATE TYPE "public"."guest_evidence_type" AS ENUM ('identity_document', 'verification_video', 'education_certificate');
--> statement-breakpoint
CREATE TYPE "public"."guest_submission_status" AS ENUM ('draft', 'submitted');
--> statement-breakpoint
CREATE TABLE "guest_preapplications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submission_id" uuid NOT NULL,
  "reference" text NOT NULL,
  "access_key_hash" text NOT NULL,
  "category_id" text NOT NULL,
  "full_name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "current_step" integer DEFAULT 0 NOT NULL,
  "answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "details_complete" boolean DEFAULT false NOT NULL,
  "status" "guest_preapplication_status" DEFAULT 'received' NOT NULL,
  "submission_status" "guest_submission_status" DEFAULT 'draft' NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "clerk_user_id" text,
  "linked_application_id" uuid,
  "pin_hash" text,
  "pin_encrypted" text,
  "updated_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "guest_preapplications_submission_id_unique" UNIQUE("submission_id"),
  CONSTRAINT "guest_preapplications_reference_unique" UNIQUE("reference"),
  CONSTRAINT "guest_preapplications_access_key_hash_unique" UNIQUE("access_key_hash")
);
--> statement-breakpoint
CREATE TABLE "guest_preapplication_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "application_id" uuid NOT NULL,
  "evidence_type" "guest_evidence_type" NOT NULL,
  "evidence_slot" text DEFAULT 'identity_document' NOT NULL,
  "file_name" text NOT NULL,
  "content_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "object_path" text NOT NULL,
  "uploaded_by_user_id" text,
  "uploaded_at" timestamp with time zone,
  "upload_expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "guest_preapplication_evidence_object_path_unique" UNIQUE("object_path"),
  CONSTRAINT "guest_preapplication_evidence_application_id_guest_preapplications_id_fk"
    FOREIGN KEY ("application_id") REFERENCES "guest_preapplications"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE "guest_preapplication_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "application_id" uuid NOT NULL,
  "current_step" integer NOT NULL,
  "changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "guest_preapplication_revisions_application_id_guest_preapplications_id_fk"
    FOREIGN KEY ("application_id") REFERENCES "guest_preapplications"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE "enrollment_applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reference" text NOT NULL,
  "clerk_user_id" text NOT NULL,
  "source_guest_preapplication_id" uuid,
  "category_id" text NOT NULL,
  "status" "application_status" DEFAULT 'draft' NOT NULL,
  "current_step" integer DEFAULT 0 NOT NULL,
  "pin_hash" text,
  "pin_encrypted" text,
  "answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "review_note" text,
  "reviewer_user_id" text,
  "submitted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "enrollment_applications_reference_unique" UNIQUE("reference"),
  CONSTRAINT "enrollment_applications_source_guest_preapplication_id_guest_preapplications_id_fk"
    FOREIGN KEY ("source_guest_preapplication_id") REFERENCES "guest_preapplications"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE "application_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "application_id" uuid NOT NULL,
  "actor_user_id" text NOT NULL,
  "event_type" text NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "application_events_application_id_enrollment_applications_id_fk"
    FOREIGN KEY ("application_id") REFERENCES "enrollment_applications"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE "enrollment_support_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clerk_user_id" text NOT NULL,
  "application_id" uuid,
  "subject" text NOT NULL,
  "category" text DEFAULT 'other' NOT NULL,
  "message" text NOT NULL,
  "messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "status" "support_status" DEFAULT 'open' NOT NULL,
  "response" text,
  "assigned_to_user_id" text,
  "updated_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "enrollment_support_tickets_application_id_enrollment_applications_id_fk"
    FOREIGN KEY ("application_id") REFERENCES "enrollment_applications"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE "portal_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL,
  "updated_by_user_id" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_email_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "alerts" jsonb NOT NULL,
  "branding" jsonb DEFAULT '{"logoUrl":null,"logoObjectPath":null,"accentColor":"#49b8aa","headerColor":"#102b46","senderName":"M-soft Account Protection","senderEmail":"notifications@vu-gov.cc","bannerMark":"MS","bannerTitle":"M-soft Account Protection","bannerSubtitle":"Bank Grade Security System","preheaderText":"A message from M-soft Account Protection.","messageEyebrow":"STAFF MESSAGE","footerText":"M-soft Account Protection staff communications","footerLinkText":"Visit M-soft Account Protection","footerLinkUrl":null,"footerLinkColor":"#287d8b","footerBackgroundColor":"#f1f5f8","footerTextColor":"#738392","footerBackgroundUrl":null,"footerBackgroundObjectPath":null}'::jsonb NOT NULL,
  "updated_by_user_id" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_email_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "idempotency_key" text NOT NULL,
  "recipient_email" text NOT NULL,
  "subject" text NOT NULL,
  "message_text" text NOT NULL,
  "event_kind" text,
  "application_reference" text,
  "status" text DEFAULT 'sending' NOT NULL,
  "provider_message_id" text,
  "delivery_status" text,
  "provider_event_at" timestamp with time zone,
  "error_message" text,
  "created_by_user_id" text,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_email_provider_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "outbox_id" uuid NOT NULL,
  "provider_event_id" text NOT NULL,
  "delivery_status" text NOT NULL,
  "provider_event_at" timestamp with time zone NOT NULL,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "staff_email_provider_events_outbox_id_staff_email_outbox_id_fk"
    FOREIGN KEY ("outbox_id") REFERENCES "staff_email_outbox"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE "staff_email_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "subject" text NOT NULL,
  "message_text" text NOT NULL,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_sms_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "base_url" text DEFAULT '' NOT NULL,
  "sender_id" text DEFAULT '' NOT NULL,
  "daily_limit" integer DEFAULT 100 NOT NULL,
  "daily_usage_date" date,
  "daily_usage_count" integer DEFAULT 0 NOT NULL,
  "updated_by_user_id" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_sms_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "recipient_phone" text NOT NULL,
  "sender_id" text NOT NULL,
  "message_text" text NOT NULL,
  "status" text DEFAULT 'sending' NOT NULL,
  "provider_message_id" text,
  "provider_status" text,
  "provider_status_group" text,
  "provider_status_at" timestamp with time zone,
  "accepted_at" timestamp with time zone,
  "error_message" text,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "guest_preapplications_linked_application_idx" ON "guest_preapplications" USING btree ("linked_application_id");
--> statement-breakpoint
CREATE INDEX "guest_preapplications_status_idx" ON "guest_preapplications" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "guest_preapplications_submission_status_idx" ON "guest_preapplications" USING btree ("submission_status");
--> statement-breakpoint
CREATE INDEX "guest_preapplications_created_idx" ON "guest_preapplications" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "guest_preapplications_evidence_cleanup_idx" ON "guest_preapplications" USING btree ("submission_status", "linked_application_id", "updated_at");
--> statement-breakpoint
CREATE INDEX "guest_preapplication_evidence_application_idx" ON "guest_preapplication_evidence" USING btree ("application_id");
--> statement-breakpoint
CREATE INDEX "guest_preapplication_evidence_type_idx" ON "guest_preapplication_evidence" USING btree ("application_id", "evidence_type");
--> statement-breakpoint
CREATE INDEX "guest_preapplication_evidence_upload_expiry_idx" ON "guest_preapplication_evidence" USING btree ("uploaded_at", "upload_expires_at", "created_at");
--> statement-breakpoint
CREATE INDEX "guest_preapplication_revisions_application_idx" ON "guest_preapplication_revisions" USING btree ("application_id", "created_at");
--> statement-breakpoint
CREATE INDEX "enrollment_applications_owner_idx" ON "enrollment_applications" USING btree ("clerk_user_id");
--> statement-breakpoint
CREATE INDEX "enrollment_applications_status_idx" ON "enrollment_applications" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "enrollment_applications_category_idx" ON "enrollment_applications" USING btree ("category_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_applications_guest_source_idx" ON "enrollment_applications" USING btree ("source_guest_preapplication_id");
--> statement-breakpoint
CREATE INDEX "application_events_application_idx" ON "application_events" USING btree ("application_id");
--> statement-breakpoint
CREATE INDEX "enrollment_support_owner_idx" ON "enrollment_support_tickets" USING btree ("clerk_user_id");
--> statement-breakpoint
CREATE INDEX "enrollment_support_status_idx" ON "enrollment_support_tickets" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_email_outbox_idempotency_idx" ON "staff_email_outbox" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE INDEX "staff_email_outbox_created_idx" ON "staff_email_outbox" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "staff_email_outbox_status_idx" ON "staff_email_outbox" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_email_provider_events_provider_id_idx" ON "staff_email_provider_events" USING btree ("provider_event_id");
--> statement-breakpoint
CREATE INDEX "staff_email_provider_events_outbox_time_idx" ON "staff_email_provider_events" USING btree ("outbox_id", "provider_event_at");
--> statement-breakpoint
CREATE INDEX "staff_email_templates_name_idx" ON "staff_email_templates" USING btree ("name");
--> statement-breakpoint
CREATE UNIQUE INDEX "staff_sms_outbox_provider_message_id_idx" ON "staff_sms_outbox" USING btree ("provider_message_id");
--> statement-breakpoint
CREATE INDEX "staff_sms_outbox_created_idx" ON "staff_sms_outbox" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "staff_sms_outbox_status_idx" ON "staff_sms_outbox" USING btree ("status");
