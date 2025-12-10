CREATE SCHEMA "contents_hub";
--> statement-breakpoint
CREATE TABLE "contents_hub"."content_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"content_hash" text NOT NULL,
	"summary" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contents_hub"."subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"check_interval" integer DEFAULT 60 NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_content_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contents_hub"."content_history" ADD CONSTRAINT "content_history_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "contents_hub"."subscriptions"("id") ON DELETE no action ON UPDATE no action;