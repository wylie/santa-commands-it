CREATE TYPE "public"."ruling_decision" AS ENUM('approved', 'random-coal');--> statement-breakpoint
CREATE TABLE "rulings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"public_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"request_text" text NOT NULL,
	"decision" "ruling_decision" NOT NULL,
	"santa_response" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rulings_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "rulings_display_name_length_check" CHECK (char_length("rulings"."display_name") between 1 and 40),
	CONSTRAINT "rulings_request_text_length_check" CHECK (char_length("rulings"."request_text") between 1 and 500)
);
--> statement-breakpoint
CREATE INDEX "rulings_created_at_idx" ON "rulings" USING btree ("created_at");