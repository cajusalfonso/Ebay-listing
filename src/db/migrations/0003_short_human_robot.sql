ALTER TABLE "listings" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "needs_review" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "needs_review" ADD CONSTRAINT "needs_review_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listings_user_idx" ON "listings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "listings_user_status_idx" ON "listings" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "needs_review_user_idx" ON "needs_review" USING btree ("user_id");