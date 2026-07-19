ALTER TYPE "public"."owner_activity_action" ADD VALUE 'ruling-featured' BEFORE 'report-reviewed';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE 'ruling-unfeatured' BEFORE 'report-reviewed';--> statement-breakpoint
ALTER TABLE "rulings" ADD COLUMN "is_featured" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rulings" ADD COLUMN "featured_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "santa_settings" ADD COLUMN "seasonal_greeting" text;--> statement-breakpoint
CREATE INDEX "rulings_featured_public_idx" ON "rulings" USING btree ("is_featured","visibility","featured_at");--> statement-breakpoint
ALTER TABLE "santa_settings" ADD CONSTRAINT "santa_settings_seasonal_greeting_length_check" CHECK ("santa_settings"."seasonal_greeting" is null or char_length("santa_settings"."seasonal_greeting") <= 120);