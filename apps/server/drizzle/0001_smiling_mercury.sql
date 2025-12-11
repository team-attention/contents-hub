CREATE TABLE "contents_hub"."content_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"fetched_content" text,
	"fetched_at" timestamp with time zone,
	"summary" text,
	"digest_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contents_hub"."digest_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"digest_id" uuid,
	"content_item_id" uuid,
	"operation_type" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"model" text NOT NULL,
	"duration_ms" integer,
	"success" boolean NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contents_hub"."digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"total_input_tokens" integer DEFAULT 0 NOT NULL,
	"total_output_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contents_hub"."fetch_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_item_id" uuid NOT NULL,
	"url" text NOT NULL,
	"success" boolean NOT NULL,
	"status_code" integer,
	"content_length" integer,
	"extracted_length" integer,
	"error_type" text,
	"error_message" text,
	"duration_ms" integer,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contents_hub"."content_items" ADD CONSTRAINT "content_items_digest_id_digests_id_fk" FOREIGN KEY ("digest_id") REFERENCES "contents_hub"."digests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents_hub"."digest_history" ADD CONSTRAINT "digest_history_digest_id_digests_id_fk" FOREIGN KEY ("digest_id") REFERENCES "contents_hub"."digests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents_hub"."digest_history" ADD CONSTRAINT "digest_history_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "contents_hub"."content_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents_hub"."fetch_history" ADD CONSTRAINT "fetch_history_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "contents_hub"."content_items"("id") ON DELETE no action ON UPDATE no action;