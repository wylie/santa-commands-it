CREATE TYPE "public"."seasonal_presentation_mode" AS ENUM('standard', 'festive', 'christmas-eve', 'post-christmas');--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE IF NOT EXISTS 'seasonal-mode-updated';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE IF NOT EXISTS 'seasonal-greeting-enabled';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE IF NOT EXISTS 'seasonal-greeting-disabled';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE IF NOT EXISTS 'seasonal-greeting-updated';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE IF NOT EXISTS 'seasonal-status-enabled';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE IF NOT EXISTS 'seasonal-status-disabled';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE IF NOT EXISTS 'seasonal-status-updated';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE IF NOT EXISTS 'seasonal-countdown-enabled';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE IF NOT EXISTS 'seasonal-countdown-disabled';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE IF NOT EXISTS 'seasonal-countdown-updated';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE IF NOT EXISTS 'seasonal-defaults-restored';--> statement-breakpoint
ALTER TABLE "santa_settings" ADD COLUMN "seasonal_mode" "seasonal_presentation_mode" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "santa_settings" ADD COLUMN "seasonal_greeting_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "santa_settings" ADD COLUMN "seasonal_status_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "santa_settings" ADD COLUMN "seasonal_status_text" text;--> statement-breakpoint
ALTER TABLE "santa_settings" ADD COLUMN "seasonal_countdown_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "santa_settings" ADD COLUMN "seasonal_countdown_target_date" date;--> statement-breakpoint
ALTER TABLE "santa_settings" ADD COLUMN "seasonal_countdown_label" text;--> statement-breakpoint
ALTER TABLE "santa_settings" ADD CONSTRAINT "santa_settings_seasonal_status_text_length_check" CHECK ("santa_settings"."seasonal_status_text" is null or char_length("santa_settings"."seasonal_status_text") <= 160);--> statement-breakpoint
ALTER TABLE "santa_settings" ADD CONSTRAINT "santa_settings_seasonal_countdown_label_length_check" CHECK ("santa_settings"."seasonal_countdown_label" is null or char_length("santa_settings"."seasonal_countdown_label") <= 40);--> statement-breakpoint
UPDATE "santa_settings"
SET
  "seasonal_greeting_enabled" = CASE
    WHEN "seasonal_greeting" IS NULL OR btrim("seasonal_greeting") = '' THEN false
    ELSE true
  END,
  "seasonal_countdown_label" = COALESCE(NULLIF(btrim("seasonal_countdown_label"), ''), 'UNTIL CHRISTMAS');--> statement-breakpoint
