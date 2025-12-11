/**
 * Shared type definitions for Contents Hub
 */

// ============================================
// Subscription Types
// ============================================

/**
 * Subscription status
 */
export type SubscriptionStatus = "active" | "paused" | "error";

/**
 * Content check result
 */
export interface ContentCheckResult {
  hasChanges: boolean;
  previousHash?: string;
  currentHash?: string;
  diff?: string;
  checkedAt: Date;
}

/**
 * Subscription entity
 */
export interface Subscription {
  id: string;
  url: string;
  name: string;
  status: SubscriptionStatus;
  checkInterval: number; // in minutes
  lastCheckedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Content Item Types
// ============================================

/**
 * Content item status
 * - pending: registered, waiting to be fetched
 * - ready: fetched, waiting to be digested
 * - done: digest completed
 * - archived: user archived (from done or error)
 * - error: fetch or digest failed (details in fetch_history/digest_history)
 */
export type ContentItemStatus = "pending" | "ready" | "done" | "archived" | "error";

/**
 * Content item entity
 */
export interface ContentItem {
  id: string;
  userId: string;
  url: string;
  title?: string;
  status: ContentItemStatus;
  fetchedContent?: string;
  fetchedAt?: string;
  summary?: string;
  digestId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Digest Types
// ============================================

/**
 * Digest entity - combined summary of multiple content items
 */
export interface Digest {
  id: string;
  userId: string;
  title: string;
  content: string;
  itemCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  createdAt: string;
}

// ============================================
// Fetch Types
// ============================================

/**
 * Fetch error types
 */
export type FetchErrorType =
  | "TIMEOUT"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "PARSE_ERROR"
  | "EXTRACTION_ERROR"
  | "UNKNOWN";

/**
 * Request to fetch content from a URL
 */
export interface FetchRequest {
  contentItemId: string;
  url: string;
}

/**
 * Result of a fetch operation
 */
export interface FetchResult {
  success: boolean;
  contentItemId: string;
  url: string;
  // Success data
  title?: string;
  content?: string;
  contentLength?: number;
  extractedLength?: number;
  // Error data
  errorType?: FetchErrorType;
  errorMessage?: string;
  statusCode?: number;
  // Metrics
  durationMs: number;
}

// ============================================
// Summarize/Digest Types
// ============================================

/**
 * Request to summarize a single content item
 */
export interface SummarizeRequest {
  contentItemId: string;
  title: string;
  content: string;
}

/**
 * Result of summarization
 */
export interface SummarizeResult {
  success: boolean;
  contentItemId: string;
  summary?: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  durationMs: number;
  errorMessage?: string;
}

/**
 * Request to create a combined digest from multiple summaries
 */
export interface DigestRequest {
  userId: string;
  items: Array<{
    contentItemId: string;
    title: string;
    url: string;
    summary: string;
  }>;
}

/**
 * Result of digest creation
 */
export interface DigestResult {
  success: boolean;
  digestId?: string;
  title?: string;
  content?: string;
  itemCount: number;
  inputTokens: number;
  outputTokens: number;
  model: string;
  durationMs: number;
  errorMessage?: string;
}

// ============================================
// API Types
// ============================================

/**
 * API Response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
