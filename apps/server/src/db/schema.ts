import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * contents_hub schema - isolates this project's tables from other projects
 */
export const contentsHubSchema = pgSchema("contents_hub");

/**
 * Content item status enum
 * - pending: registered, waiting to be fetched
 * - ready: fetched, waiting to be digested
 * - done: digest completed
 * - archived: user archived (from done or error)
 * - error: fetch or digest failed (details in fetch_history/digest_history)
 */
export type ContentItemStatus = "pending" | "ready" | "done" | "archived" | "error";

/**
 * Content item source enum
 * - read_later: manually added via extension "Read Later"
 * - subscription: auto-created from subscription diff detection
 */
export type ContentItemSource = "read_later" | "subscription";

/**
 * Subscription status enum
 * - active: subscription is active and being watched
 * - paused: user paused the subscription
 * - broken: URL/Selector not found, auto-paused with error
 */
export type SubscriptionStatus = "active" | "paused" | "broken";

/**
 * Content items table - stores URLs to be fetched and digested
 * Can be created from Read Later (extension) or subscription diff detection
 */
export const contentItems = contentsHubSchema.table("content_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  url: text("url").notNull(),
  title: text("title"), // extracted or user-provided title
  status: text("status").$type<ContentItemStatus>().notNull().default("pending"),
  // Source tracking
  source: text("source").$type<ContentItemSource>().notNull().default("read_later"),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
  // Fetched content
  fetchedContent: text("fetched_content"), // extracted article text
  fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "string" }),
  // Digest result
  summary: text("summary"), // individual item summary
  digestId: uuid("digest_id").references(() => digests.id), // linked digest
  // Metadata
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
});

/**
 * Digests table - stores combined digest results for users
 */
export const digests = contentsHubSchema.table("digests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  title: text("title").notNull(), // e.g., "2025-12-11 Daily Digest"
  content: text("content").notNull(), // the combined digest content
  itemCount: integer("item_count").notNull().default(0),
  // Token usage tracking
  totalInputTokens: integer("total_input_tokens").notNull().default(0),
  totalOutputTokens: integer("total_output_tokens").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

/**
 * Fetch history table - audit log for fetch operations
 */
export const fetchHistory = contentsHubSchema.table("fetch_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentItemId: uuid("content_item_id")
    .notNull()
    .references(() => contentItems.id),
  url: text("url").notNull(),
  success: boolean("success").notNull(),
  statusCode: integer("status_code"),
  contentLength: integer("content_length"),
  extractedLength: integer("extracted_length"), // length of extracted article text
  errorType: text("error_type"), // TIMEOUT, NOT_FOUND, PARSE_ERROR, etc.
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

/**
 * Digest history table - audit log for digest/summarization operations
 */
export const digestHistory = contentsHubSchema.table("digest_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  digestId: uuid("digest_id").references(() => digests.id),
  contentItemId: uuid("content_item_id").references(() => contentItems.id),
  operationType: text("operation_type").notNull(), // "summarize" | "digest"
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  model: text("model").notNull(), // e.g., "claude-3-haiku-20240307"
  durationMs: integer("duration_ms"),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

/**
 * Subscriptions table - tracks user subscriptions to websites
 */
export const subscriptions = contentsHubSchema.table("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  url: text("url").notNull(),
  name: text("name").notNull(),
  status: text("status").$type<SubscriptionStatus>().notNull().default("active"),
  checkInterval: integer("check_interval").notNull().default(60), // minutes
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true, mode: "string" }),
  lastContentHash: text("last_content_hash"),
  initialSelector: text("initial_selector"), // user-selected selector from picker
  errorMessage: text("error_message"), // error details when status="broken"
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
});

/**
 * Subscription history table - logs all subscription check attempts
 * error: null = success, has value = failure (contains error type + message)
 */
export const subscriptionHistory = contentsHubSchema.table("subscription_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => subscriptions.id),
  contentHash: text("content_hash"), // hash for diff detection (null on error)
  hasChanged: boolean("has_changed"), // true if content changed from last check
  error: text("error"), // null = success, otherwise error info (e.g., "TIMEOUT: 30s exceeded")
  // List diff fields
  urls: jsonb("urls").$type<string[]>(), // discovered URLs (newest first)
  stableSelectors: jsonb("stable_selectors").$type<string[]>(), // AI-extracted stable selectors
  selectorHierarchy: text("selector_hierarchy"), // DOM structure (simplified HTML)
  checkedAt: timestamp("checked_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});
