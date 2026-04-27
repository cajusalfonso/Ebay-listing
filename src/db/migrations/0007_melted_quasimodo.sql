CREATE TABLE "user_pricing_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"min_profit_eur" numeric(10, 2) DEFAULT '10.00' NOT NULL,
	"min_margin_percent" numeric(6, 4) DEFAULT '0.0800' NOT NULL,
	"min_roi_percent" numeric(6, 4) DEFAULT '0.0800' NOT NULL,
	"target_margin_multiplier" numeric(6, 4) DEFAULT '1.2500' NOT NULL,
	"undercut_amount_eur" numeric(10, 2) DEFAULT '0.50' NOT NULL,
	"category_fee_percent" numeric(6, 4) DEFAULT '0.1200' NOT NULL,
	"vat_rate" numeric(6, 4) DEFAULT '0.1900' NOT NULL,
	"return_reserve_percent" numeric(6, 4) DEFAULT '0.0300' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_pricing_settings" ADD CONSTRAINT "user_pricing_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_pricing_settings_user_unique" ON "user_pricing_settings" USING btree ("user_id");