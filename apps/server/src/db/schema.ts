import { sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Subscriptions table - tracks user subscriptions to websites
 */
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  checkInterval: integer("check_interval").notNull().default(60), // minutes
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true, mode: "string" }),
  lastContentHash: text("last_content_hash"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => sql`now()`),
});

/**
 * Content history table - stores content snapshots for diff detection
 */
export const contentHistory = pgTable("content_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id")
    .notNull()
    .references(() => subscriptions.id),
  contentHash: text("content_hash").notNull(),
  summary: text("summary"),
  checkedAt: timestamp("checked_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});
