-- Rename content_history to subscription_history
ALTER TABLE "contents_hub"."content_history" RENAME TO "subscription_history";
--> statement-breakpoint
-- Update foreign key constraint name
ALTER TABLE "contents_hub"."subscription_history" RENAME CONSTRAINT "content_history_subscription_id_subscriptions_id_fk" TO "subscription_history_subscription_id_subscriptions_id_fk";
--> statement-breakpoint
-- Add new columns to subscription_history
ALTER TABLE "contents_hub"."subscription_history" ALTER COLUMN "content_hash" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "contents_hub"."subscription_history" ADD COLUMN "has_changed" boolean;
--> statement-breakpoint
ALTER TABLE "contents_hub"."subscription_history" ADD COLUMN "error" text;
--> statement-breakpoint
ALTER TABLE "contents_hub"."subscription_history" ADD COLUMN "urls" jsonb;
--> statement-breakpoint
ALTER TABLE "contents_hub"."subscription_history" ADD COLUMN "stable_selectors" jsonb;
--> statement-breakpoint
ALTER TABLE "contents_hub"."subscription_history" ADD COLUMN "selector_hierarchy" text;
--> statement-breakpoint
-- Remove summary column (moved to content_items)
ALTER TABLE "contents_hub"."subscription_history" DROP COLUMN IF EXISTS "summary";
--> statement-breakpoint
-- Add new columns to subscriptions
ALTER TABLE "contents_hub"."subscriptions" ADD COLUMN "initial_selector" text;
--> statement-breakpoint
ALTER TABLE "contents_hub"."subscriptions" ADD COLUMN "error_message" text;
