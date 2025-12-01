/**
 * Shared type definitions for Contents Hub
 */

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

/**
 * API Response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
