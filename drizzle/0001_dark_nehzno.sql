CREATE TYPE "public"."report_reason" AS ENUM('bullying', 'hate', 'personal-information', 'inappropriate', 'threats', 'spam', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'reviewed', 'dismissed', 'actioned');--> statement-breakpoint
CREATE TABLE "ruling_reports" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ruling_id" bigint NOT NULL,
	"client_key_hash" text NOT NULL,
	"reason" "report_reason" NOT NULL,
	"note" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ruling_reports_note_length_check" CHECK ("ruling_reports"."note" is null or char_length("ruling_reports"."note") <= 300)
);
--> statement-breakpoint
CREATE TABLE "submission_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"client_key_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_idempotency" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"client_key_hash" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"normalized_name" text NOT NULL,
	"normalized_request" text NOT NULL,
	"ruling_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "submission_idempotency_key_length_check" CHECK (char_length("submission_idempotency"."idempotency_key") between 1 and 64)
);
--> statement-breakpoint
ALTER TABLE "ruling_reports" ADD CONSTRAINT "ruling_reports_ruling_id_rulings_id_fk" FOREIGN KEY ("ruling_id") REFERENCES "public"."rulings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_idempotency" ADD CONSTRAINT "submission_idempotency_ruling_id_rulings_id_fk" FOREIGN KEY ("ruling_id") REFERENCES "public"."rulings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ruling_reports_client_created_idx" ON "ruling_reports" USING btree ("client_key_hash","created_at");--> statement-breakpoint
CREATE INDEX "ruling_reports_ruling_client_created_idx" ON "ruling_reports" USING btree ("ruling_id","client_key_hash","created_at");--> statement-breakpoint
CREATE INDEX "ruling_reports_status_created_idx" ON "ruling_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "submission_attempts_client_created_idx" ON "submission_attempts" USING btree ("client_key_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_idempotency_client_key_idx" ON "submission_idempotency" USING btree ("client_key_hash","idempotency_key");--> statement-breakpoint
CREATE INDEX "submission_idempotency_duplicate_idx" ON "submission_idempotency" USING btree ("client_key_hash","normalized_name","normalized_request","created_at");