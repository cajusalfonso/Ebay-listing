CREATE TABLE "products" (
	"ean" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"brand" text,
	"mpn" text,
	"description" text,
	"specs" jsonb,
	"ebay_category_id" text,
	"data_source" text,
	"source_metadata" jsonb,
	"quality_score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"ean" text NOT NULL,
	"position" integer NOT NULL,
	"source" text NOT NULL,
	"local_path" text NOT NULL,
	"ebay_eps_url" text,
	"ebay_eps_uploaded_at" timestamp with time zone,
	"width" integer,
	"height" integer,
	"licensed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"ean" text NOT NULL,
	"competitor_count" integer NOT NULL,
	"lowest_price" numeric(10, 2),
	"median_price" numeric(10, 2),
	"snapshot" jsonb NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"ean" text NOT NULL,
	"ebay_environment" text NOT NULL,
	"ebay_sku" text NOT NULL,
	"ebay_offer_id" text,
	"ebay_listing_id" text,
	"sell_price_gross" numeric(10, 2) NOT NULL,
	"cogs" numeric(10, 2) NOT NULL,
	"calculated_profit" numeric(10, 2),
	"calculated_margin" numeric(5, 4),
	"status" text DEFAULT 'draft' NOT NULL,
	"compliance_passed" boolean DEFAULT false NOT NULL,
	"compliance_blockers" jsonb,
	"last_market_snapshot_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"ean" text NOT NULL,
	"source" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ebay_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"environment" text NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text NOT NULL,
	"access_expires_at" timestamp with time zone NOT NULL,
	"refresh_expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gpsr_manufacturer_overrides" (
	"brand" text PRIMARY KEY NOT NULL,
	"name" text,
	"address" text,
	"email" text,
	"eu_responsible_person" text
);
--> statement-breakpoint
CREATE TABLE "needs_review" (
	"id" serial PRIMARY KEY NOT NULL,
	"ean" text,
	"reason" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_ean_products_ean_fk" FOREIGN KEY ("ean") REFERENCES "public"."products"("ean") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_snapshots" ADD CONSTRAINT "market_snapshots_ean_products_ean_fk" FOREIGN KEY ("ean") REFERENCES "public"."products"("ean") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_ean_products_ean_fk" FOREIGN KEY ("ean") REFERENCES "public"."products"("ean") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_last_market_snapshot_id_market_snapshots_id_fk" FOREIGN KEY ("last_market_snapshot_id") REFERENCES "public"."market_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_ean_products_ean_fk" FOREIGN KEY ("ean") REFERENCES "public"."products"("ean") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_brand_idx" ON "products" USING btree ("brand");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("ebay_category_id");--> statement-breakpoint
CREATE INDEX "product_images_ean_idx" ON "product_images" USING btree ("ean");--> statement-breakpoint
CREATE INDEX "market_snapshots_ean_idx" ON "market_snapshots" USING btree ("ean");--> statement-breakpoint
CREATE INDEX "market_snapshots_captured_at_idx" ON "market_snapshots" USING btree ("captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_ebay_sku_unique" ON "listings" USING btree ("ebay_sku");--> statement-breakpoint
CREATE INDEX "listings_ean_idx" ON "listings" USING btree ("ean");--> statement-breakpoint
CREATE INDEX "listings_status_idx" ON "listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "listings_environment_idx" ON "listings" USING btree ("ebay_environment");--> statement-breakpoint
CREATE INDEX "price_history_ean_idx" ON "price_history" USING btree ("ean");--> statement-breakpoint
CREATE INDEX "price_history_ean_captured_idx" ON "price_history" USING btree ("ean","captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ebay_tokens_environment_unique" ON "ebay_tokens" USING btree ("environment");--> statement-breakpoint
CREATE INDEX "needs_review_ean_idx" ON "needs_review" USING btree ("ean");--> statement-breakpoint
CREATE INDEX "needs_review_reason_idx" ON "needs_review" USING btree ("reason");