ALTER TYPE "public"."owner_activity_action" ADD VALUE 'report-reviewed';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE 'report-dismissed';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE 'report-reopened';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE 'report-actioned';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE 'ruling-hidden-from-report';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE 'related-reports-actioned';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_target_type" ADD VALUE 'report';--> statement-breakpoint
ALTER TABLE "owner_activity" DROP CONSTRAINT "owner_activity_details_length_check";--> statement-breakpoint
ALTER TABLE "owner_activity" ADD COLUMN "related_public_id" text;--> statement-breakpoint
ALTER TABLE "ruling_reports" ADD COLUMN "public_id" text;--> statement-breakpoint
ALTER TABLE "ruling_reports" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ruling_reports" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ruling_reports" ADD COLUMN "resolution_note" text;--> statement-breakpoint
UPDATE "ruling_reports"
SET "public_id" = 'report_' || md5(
  "id"::text || ':' || "created_at"::text || ':' || "client_key_hash"
)
WHERE "public_id" IS NULL;--> statement-breakpoint
ALTER TABLE "ruling_reports" ALTER COLUMN "public_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "owner_activity_related_public_id_idx" ON "owner_activity" USING btree ("related_public_id");--> statement-breakpoint
CREATE INDEX "ruling_reports_public_id_idx" ON "ruling_reports" USING btree ("public_id");--> statement-breakpoint
CREATE INDEX "ruling_reports_ruling_status_created_idx" ON "ruling_reports" USING btree ("ruling_id","status","created_at");--> statement-breakpoint
ALTER TABLE "ruling_reports" ADD CONSTRAINT "ruling_reports_public_id_unique" UNIQUE("public_id");--> statement-breakpoint
ALTER TABLE "owner_activity" ADD CONSTRAINT "owner_activity_details_length_check" CHECK ("owner_activity"."details" is null or char_length("owner_activity"."details") <= 500);--> statement-breakpoint
ALTER TABLE "ruling_reports" ADD CONSTRAINT "ruling_reports_resolution_note_length_check" CHECK ("ruling_reports"."resolution_note" is null or char_length("ruling_reports"."resolution_note") <= 500);
