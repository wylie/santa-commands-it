CREATE TYPE "public"."moderation_rule_category" AS ENUM('bullying', 'harassment', 'hate', 'violence', 'sexual-content', 'personal-information', 'dangerous-content', 'spam', 'profanity', 'general', 'test-fixture');--> statement-breakpoint
CREATE TYPE "public"."moderation_rule_type" AS ENUM('blocked-word', 'blocked-phrase', 'allowed-exception');--> statement-breakpoint
CREATE TYPE "public"."response_template_group" AS ENUM('approved', 'coal', 'blocked-warning');--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE 'moderation-rule-created';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE 'moderation-rule-updated';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE 'moderation-rule-enabled';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE 'moderation-rule-disabled';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE 'moderation-rule-deleted';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE 'santa-settings-updated';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE 'response-template-created';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE 'response-template-updated';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE 'response-template-enabled';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE 'response-template-disabled';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_action" ADD VALUE 'response-template-deleted';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_target_type" ADD VALUE 'moderation-rule';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_target_type" ADD VALUE 'setting';--> statement-breakpoint
ALTER TYPE "public"."owner_activity_target_type" ADD VALUE 'response-template';--> statement-breakpoint
CREATE TABLE "moderation_rules" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"rule_type" "moderation_rule_type" NOT NULL,
	"value" text NOT NULL,
	"normalized_value" text NOT NULL,
	"category" "moderation_rule_category",
	"private_note" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_rules_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "moderation_rules_value_length_check" CHECK (char_length("moderation_rules"."value") between 1 and 200),
	CONSTRAINT "moderation_rules_normalized_value_length_check" CHECK (char_length("moderation_rules"."normalized_value") between 1 and 200),
	CONSTRAINT "moderation_rules_private_note_length_check" CHECK ("moderation_rules"."private_note" is null or char_length("moderation_rules"."private_note") <= 500)
);
--> statement-breakpoint
CREATE TABLE "response_templates" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"group" "response_template_group" NOT NULL,
	"template_text" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"private_note" text,
	"created_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "response_templates_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "response_templates_text_length_check" CHECK (char_length("response_templates"."template_text") between 1 and 500),
	CONSTRAINT "response_templates_private_note_length_check" CHECK ("response_templates"."private_note" is null or char_length("response_templates"."private_note") <= 500)
);
--> statement-breakpoint
CREATE TABLE "santa_settings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"singleton_key" text NOT NULL,
	"random_coal_enabled" boolean DEFAULT true NOT NULL,
	"random_coal_percentage" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "santa_settings_singleton_key_unique" UNIQUE("singleton_key"),
	CONSTRAINT "santa_settings_random_coal_percentage_check" CHECK ("santa_settings"."random_coal_percentage" between 0 and 100),
	CONSTRAINT "santa_settings_version_check" CHECK ("santa_settings"."version" >= 1)
);
--> statement-breakpoint
CREATE INDEX "moderation_rules_type_active_updated_idx" ON "moderation_rules" USING btree ("rule_type","active","updated_at");--> statement-breakpoint
CREATE INDEX "moderation_rules_category_active_updated_idx" ON "moderation_rules" USING btree ("category","active","updated_at");--> statement-breakpoint
CREATE INDEX "moderation_rules_active_updated_idx" ON "moderation_rules" USING btree ("active","updated_at");--> statement-breakpoint
CREATE INDEX "moderation_rules_public_id_idx" ON "moderation_rules" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_rules_type_normalized_value_idx" ON "moderation_rules" USING btree ("rule_type","normalized_value");--> statement-breakpoint
CREATE INDEX "response_templates_group_active_updated_idx" ON "response_templates" USING btree ("group","active","updated_at");--> statement-breakpoint
CREATE INDEX "response_templates_public_id_idx" ON "response_templates" USING btree ("public_id");