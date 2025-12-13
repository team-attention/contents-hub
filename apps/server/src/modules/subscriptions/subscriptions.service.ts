import { type DbConnection, PROVIDER_DB_CONNECTION } from "@/db/drizzle.module";
import { contentItems, subscriptionHistory, subscriptions } from "@/db/schema";
import { AiService } from "@/modules/ai/ai.service";
import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import type { CreateSubscriptionDto } from "./dto/create-subscription.dto";
import type {
  SubscriptionListResponseDto,
  SubscriptionResponseDto,
} from "./dto/subscription-response.dto";
import type {
  WatchSubscriptionDto,
  WatchSubscriptionResultDto,
} from "./dto/watch-subscription.dto";
import { ListDiffService } from "./list-diff";

export interface CheckSubscriptionResult {
  success: boolean;
  subscriptionId: string;
  newUrls: string[];
  totalUrls: number;
  error?: string;
  broken?: boolean;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @Inject(PROVIDER_DB_CONNECTION)
    private readonly db: DbConnection,
    private readonly aiService: AiService,
    private readonly listDiffService: ListDiffService,
  ) {}

  async findAll(userId: string): Promise<SubscriptionListResponseDto> {
    const results = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt));

    return { items: results.map(this.toResponseDto) };
  }

  async findByUrl(userId: string, url: string): Promise<SubscriptionResponseDto | null> {
    const [result] = await this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.url, url)))
      .limit(1);

    return result ? this.toResponseDto(result) : null;
  }

  async create(userId: string, dto: CreateSubscriptionDto): Promise<SubscriptionResponseDto> {
    const [result] = await this.db
      .insert(subscriptions)
      .values({
        userId,
        url: dto.url,
        name: dto.name,
        checkInterval: dto.checkInterval ?? 60,
        status: "active",
      })
      .returning();

    return this.toResponseDto(result);
  }

  async delete(userId: string, id: string): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
      .limit(1);

    if (!existing) {
      throw new NotFoundException("Subscription not found");
    }

    await this.db
      .delete(subscriptions)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)));
  }

  /**
   * Initialize a new list-diff subscription with a CSS selector
   * 1. Fetch the page and extract URLs from the selector (auto-detects static/dynamic)
   * 2. Create subscription with initialSelector and renderType
   * 3. Save initial URL list to subscription_history
   */
  async initializeWatch(
    userId: string,
    dto: WatchSubscriptionDto,
  ): Promise<WatchSubscriptionResultDto> {
    this.logger.log(`Initializing watch for ${dto.url} with selector: ${dto.selector}`);

    // 1. Fetch and extract URLs using the selector (auto-detects renderType)
    const result = await this.listDiffService.fetch(dto.url, dto.selector);

    if (!result.success) {
      this.logger.warn(`Failed to initialize watch: ${result.error}`);
      return {
        success: false,
        urlCount: 0,
        error: result.error,
      };
    }

    this.logger.log(
      `Found ${result.urls.length} URLs in selector (renderType: ${result.detectedRenderType})`,
    );

    // 2. Create subscription with initialSelector and detected renderType
    const [subscription] = await this.db
      .insert(subscriptions)
      .values({
        userId,
        url: dto.url,
        name: dto.name,
        initialSelector: dto.selector,
        checkInterval: dto.checkInterval ?? 60,
        status: "active",
        renderType: result.detectedRenderType ?? "unknown",
        lastCheckedAt: new Date().toISOString(),
      })
      .returning();

    // 3. Save initial state to subscription_history
    await this.db.insert(subscriptionHistory).values({
      subscriptionId: subscription.id,
      urls: result.urls,
      selectorHierarchy: result.selectorHierarchy,
      hasChanged: false,
    });

    this.logger.log(`Created subscription ${subscription.id} with ${result.urls.length} URLs`);

    return {
      success: true,
      subscriptionId: subscription.id,
      urlCount: result.urls.length,
    };
  }

  /**
   * Check a subscription for new content (Scheduler Check)
   * 1. Fetch the page
   * 2. Get previous URLs from subscription_history
   * 3. URL reverse-lookup (1st try)
   * 4. Stable Selector fallback (2nd try)
   * 5. Find LCA using AI
   * 6. Extract all URLs from LCA
   * 7. Diff with previous URLs
   * 8. Create content_items for new URLs
   * 9. Save to subscription_history
   */
  async checkSubscription(subscriptionId: string): Promise<CheckSubscriptionResult> {
    this.logger.log(`Checking subscription: ${subscriptionId}`);

    // Get subscription
    const [subscription] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1);

    if (!subscription) {
      return {
        success: false,
        subscriptionId,
        newUrls: [],
        totalUrls: 0,
        error: "Subscription not found",
      };
    }

    if (subscription.status !== "active") {
      return {
        success: false,
        subscriptionId,
        newUrls: [],
        totalUrls: 0,
        error: `Subscription is ${subscription.status}`,
      };
    }

    // Get latest subscription_history
    const [latestHistory] = await this.db
      .select()
      .from(subscriptionHistory)
      .where(eq(subscriptionHistory.subscriptionId, subscriptionId))
      .orderBy(desc(subscriptionHistory.checkedAt))
      .limit(1);

    const previousUrls = (latestHistory?.urls as string[]) ?? [];
    const stableSelectors = (latestHistory?.stableSelectors as string[]) ?? [];
    const initialSelector = subscription.initialSelector;

    this.logger.log(
      `Previous URLs: ${previousUrls.length}, Stable selectors: ${stableSelectors.length}`,
    );

    // Strategy 1: URL reverse-lookup
    let currentUrls: string[] = [];
    let selectorHierarchy = "";
    let containerFound = false;

    if (previousUrls.length > 0) {
      this.logger.log("Trying URL reverse-lookup...");
      const lookupResult = await this.listDiffService.lookupUrlsInPage(
        subscription.url,
        previousUrls,
        { renderType: subscription.renderType ?? undefined },
      );

      if (
        lookupResult.found &&
        lookupResult.containerUrls &&
        lookupResult.containerUrls.length > 0
      ) {
        this.logger.log(`Found container via URL lookup: ${lookupResult.containerSelector}`);
        // Use pre-extracted data (no duplicate fetch)
        currentUrls = lookupResult.containerUrls;
        selectorHierarchy = lookupResult.selectorHierarchy ?? "";
        containerFound = true;
      }
    }

    // Use known renderType for subsequent fetches
    const fetchOptions = { renderType: subscription.renderType ?? undefined };

    // Strategy 2: Stable selectors fallback
    if (!containerFound && stableSelectors.length > 0) {
      this.logger.log("Trying stable selectors fallback...");
      for (const selector of stableSelectors) {
        const fetchResult = await this.listDiffService.fetch(
          subscription.url,
          selector,
          fetchOptions,
        );
        if (fetchResult.success && fetchResult.urls.length > 0) {
          this.logger.log(`Found container via stable selector: ${selector}`);
          currentUrls = fetchResult.urls;
          selectorHierarchy = fetchResult.selectorHierarchy;
          containerFound = true;
          break;
        }
      }
    }

    // Strategy 3: Initial selector fallback
    if (!containerFound && initialSelector) {
      this.logger.log("Trying initial selector fallback...");
      const fetchResult = await this.listDiffService.fetch(
        subscription.url,
        initialSelector,
        fetchOptions,
      );
      if (fetchResult.success && fetchResult.urls.length > 0) {
        this.logger.log(`Found container via initial selector: ${initialSelector}`);
        currentUrls = fetchResult.urls;
        selectorHierarchy = fetchResult.selectorHierarchy;
        containerFound = true;
      }
    }

    // If all strategies fail, mark as broken
    if (!containerFound) {
      this.logger.warn(`All strategies failed for subscription ${subscriptionId}`);
      await this.markAsBroken(subscriptionId, "Could not find content container");
      return {
        success: false,
        subscriptionId,
        newUrls: [],
        totalUrls: 0,
        error: "Could not find content container",
        broken: true,
      };
    }

    // Calculate diff
    const newUrls = this.listDiffService.diffUrls(previousUrls, currentUrls);
    const hasChanged = newUrls.length > 0;

    this.logger.log(`Found ${currentUrls.length} URLs, ${newUrls.length} new`);

    // Create content_items for new URLs (inherit renderType from subscription)
    if (newUrls.length > 0) {
      await this.createContentItemsForNewUrls(
        subscription.userId,
        subscriptionId,
        newUrls,
        subscription.renderType ?? undefined,
      );
    }

    // Extract stable selectors using AI (periodically, not every time)
    let newStableSelectors = stableSelectors;
    if (selectorHierarchy && (!stableSelectors.length || Math.random() < 0.1)) {
      const extractedSelectors = await this.aiService.extractStableSelectors({
        selectorHierarchy,
        currentSelector: initialSelector ?? "",
      });
      if (extractedSelectors.length > 0) {
        newStableSelectors = extractedSelectors;
      }
    }

    // Save to subscription_history
    await this.db.insert(subscriptionHistory).values({
      subscriptionId,
      urls: currentUrls,
      stableSelectors: newStableSelectors,
      selectorHierarchy,
      hasChanged,
    });

    // Update subscription lastCheckedAt
    await this.db
      .update(subscriptions)
      .set({ lastCheckedAt: new Date().toISOString() })
      .where(eq(subscriptions.id, subscriptionId));

    return {
      success: true,
      subscriptionId,
      newUrls,
      totalUrls: currentUrls.length,
    };
  }

  /**
   * Mark a subscription as broken
   */
  private async markAsBroken(subscriptionId: string, errorMessage: string): Promise<void> {
    await this.db
      .update(subscriptions)
      .set({
        status: "broken",
        errorMessage,
        lastCheckedAt: new Date().toISOString(),
      })
      .where(eq(subscriptions.id, subscriptionId));

    await this.db.insert(subscriptionHistory).values({
      subscriptionId,
      error: errorMessage,
      hasChanged: false,
    });
  }

  /**
   * Create content_items for new URLs discovered by subscription
   * Inherits renderType from subscription for smart fetch optimization
   */
  private async createContentItemsForNewUrls(
    userId: string,
    subscriptionId: string,
    urls: string[],
    renderType?: "static" | "dynamic" | "unknown",
  ): Promise<void> {
    this.logger.log(`Creating ${urls.length} content items for subscription ${subscriptionId}`);

    const values = urls.map((url) => ({
      userId,
      url,
      source: "subscription" as const,
      subscriptionId,
      status: "pending" as const,
      // Inherit renderType from subscription for smart fetch optimization
      renderType: renderType ?? "unknown",
    }));

    await this.db.insert(contentItems).values(values);
  }

  private toResponseDto(row: typeof subscriptions.$inferSelect): SubscriptionResponseDto {
    return {
      id: row.id,
      url: row.url,
      name: row.name,
      status: row.status,
      checkInterval: row.checkInterval,
      lastCheckedAt: row.lastCheckedAt,
      lastContentHash: row.lastContentHash,
      initialSelector: row.initialSelector,
      errorMessage: row.errorMessage,
      renderType: row.renderType,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
