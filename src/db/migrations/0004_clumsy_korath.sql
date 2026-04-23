CREATE TABLE "price_comparisons" (
	"ean" text NOT NULL,
	"country" text NOT NULL,
	"results" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_comparisons_ean_country_pk" PRIMARY KEY("ean","country")
);
--> statement-breakpoint
ALTER TABLE "user_credentials" ADD COLUMN "serp_api_key_encrypted" text;