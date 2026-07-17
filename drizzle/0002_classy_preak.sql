CREATE TYPE "public"."owner_activity_action" AS ENUM('login-success', 'login-failure', 'logout', 'ruling-hidden', 'ruling-restored', 'ruling-deleted');--> statement-breakpoint
CREATE TYPE "public"."owner_activity_target_type" AS ENUM('auth', 'ruling');--> statement-breakpoint
CREATE TYPE "public"."ruling_visibility" AS ENUM('public', 'hidden');--> statement-breakpoint
CREATE TABLE "owner_activity" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"action" "owner_activity_action" NOT NULL,
	"target_type" "owner_activity_target_type" NOT NULL,
	"target_public_id" text,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owner_activity_details_length_check" CHECK ("owner_activity"."details" is null or char_length("owner_activity"."details") <= 300)
);
--> statement-breakpoint
CREATE TABLE "workshop_login_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"client_key_hash" text NOT NULL,
	"successful" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshop_sessions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"csrf_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workshop_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "rulings" ADD COLUMN "visibility" "ruling_visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "rulings" ADD COLUMN "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rulings" ADD COLUMN "hidden_reason" text;--> statement-breakpoint
CREATE INDEX "owner_activity_created_at_idx" ON "owner_activity" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "owner_activity_target_public_id_idx" ON "owner_activity" USING btree ("target_public_id");--> statement-breakpoint
CREATE INDEX "workshop_login_attempts_client_created_idx" ON "workshop_login_attempts" USING btree ("client_key_hash","created_at");--> statement-breakpoint
CREATE INDEX "workshop_sessions_expires_at_idx" ON "workshop_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "rulings_visibility_created_at_idx" ON "rulings" USING btree ("visibility","created_at");--> statement-breakpoint
ALTER TABLE "rulings" ADD CONSTRAINT "rulings_hidden_reason_length_check" CHECK ("rulings"."hidden_reason" is null or char_length("rulings"."hidden_reason") <= 300);