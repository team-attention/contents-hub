ALTER TABLE "contents_hub"."content_history" RENAME TO "subscription_history";--> statement-breakpoint
ALTER TABLE "contents_hub"."subscription_history" RENAME COLUMN "summary" TO "has_changed";--> statement-breakpoint
ALTER TABLE "contents_hub"."subscription_history" DROP CONSTRAINT "content_history_subscription_id_subscriptions_id_fk";
--> statement-breakpoint
ALTER TABLE "contents_hub"."subscription_history" ALTER COLUMN "content_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "contents_hub"."subscription_history" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "contents_hub"."subscription_history" ADD COLUMN "urls" jsonb;--> statement-breakpoint
ALTER TABLE "contents_hub"."subscription_history" ADD COLUMN "stable_selectors" jsonb;--> statement-breakpoint
ALTER TABLE "contents_hub"."subscription_history" ADD COLUMN "selector_hierarchy" text;--> statement-breakpoint
ALTER TABLE "contents_hub"."content_items" ADD COLUMN "source" text DEFAULT 'read_later' NOT NULL;--> statement-breakpoint
ALTER TABLE "contents_hub"."content_items" ADD COLUMN "subscription_id" uuid;--> statement-breakpoint
ALTER TABLE "contents_hub"."subscriptions" ADD COLUMN "initial_selector" text;--> statement-breakpoint
ALTER TABLE "contents_hub"."subscriptions" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "contents_hub"."subscription_history" ADD CONSTRAINT "subscription_history_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "contents_hub"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents_hub"."content_items" ADD CONSTRAINT "content_items_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "contents_hub"."subscriptions"("id") ON DELETE no action ON UPDATE no action;