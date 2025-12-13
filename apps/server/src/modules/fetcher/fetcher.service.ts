import { type DbConnection, PROVIDER_DB_CONNECTION } from "@/db/drizzle.module";
import { contentItems, fetchHistory } from "@/db/schema";
import type { FetchRequest, FetchResult, RenderType } from "@contents-hub/shared";
import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { BrowserPoolService } from "./browser-pool.service";
import { httpFetch } from "./strategies/http.strategy";
import { isYouTubeUrl, youtubeFetch } from "./strategies/youtube.strategy";

/**
 * Options for smart fetch
 */
export interface SmartFetchOptions {
  renderType?: RenderType;
  forcePlaywright?: boolean;
}

@Injectable()
export class FetcherService {
  private readonly logger = new Logger(FetcherService.name);

  constructor(
    @Inject(PROVIDER_DB_CONNECTION)
    private readonly db: DbConnection,
    @Optional()
    private readonly browserPoolService?: BrowserPoolService,
  ) {}

  /**
   * Fetch content from a URL and update the content item
   * Uses smartFetch to automatically detect and cache render type
   */
  async fetch(request: FetchRequest): Promise<FetchResult> {
    this.logger.log(`Fetching: ${request.url} (renderType: ${request.renderType ?? "unknown"})`);

    // Use smartFetch with cached renderType if available
    const result = await this.smartFetch(request.url, {
      renderType: request.renderType,
    });
    result.contentItemId = request.contentItemId;

    // Save to fetch_history
    await this.saveFetchHistory(result);

    // Update content item based on result
    if (result.success) {
      await this.updateContentItemSuccess(request.contentItemId, result);
    } else {
      await this.updateContentItemError(request.contentItemId, result);
    }

    return result;
  }

  /**
   * Fetch multiple content items (parallel execution)
   */
  async fetchMany(requests: FetchRequest[]): Promise<FetchResult[]> {
    return Promise.all(
      requests.map(async (request) => {
        try {
          return await this.fetch(request);
        } catch (error) {
          this.logger.error(`Failed to fetch ${request.url}:`, error);
          return {
            success: false,
            contentItemId: request.contentItemId,
            url: request.url,
            errorType: "UNKNOWN",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            durationMs: 0,
          } satisfies FetchResult;
        }
      }),
    );
  }

  private async saveFetchHistory(result: FetchResult): Promise<void> {
    await this.db.insert(fetchHistory).values({
      contentItemId: result.contentItemId,
      url: result.url,
      success: result.success,
      statusCode: result.statusCode,
      contentLength: result.contentLength,
      extractedLength: result.extractedLength,
      errorType: result.errorType,
      errorMessage: result.errorMessage,
      durationMs: result.durationMs,
    });
  }

  private async updateContentItemSuccess(
    contentItemId: string,
    result: FetchResult,
  ): Promise<void> {
    await this.db
      .update(contentItems)
      .set({
        status: "ready",
        title: result.title,
        fetchedContent: result.content,
        fetchedAt: new Date().toISOString(),
        // Cache detected render type for future fetches
        ...(result.detectedRenderType && { renderType: result.detectedRenderType }),
      })
      .where(eq(contentItems.id, contentItemId));
  }

  private async updateContentItemError(contentItemId: string, result: FetchResult): Promise<void> {
    await this.db
      .update(contentItems)
      .set({
        status: "error",
      })
      .where(eq(contentItems.id, contentItemId));

    this.logger.warn(
      `Fetch failed for ${result.url}: ${result.errorType} - ${result.errorMessage}`,
    );
  }

  /**
   * Smart fetch: tries static first, falls back to dynamic if needed
   * Detects and returns the render type for caching
   */
  async smartFetch(url: string, options: SmartFetchOptions = {}): Promise<FetchResult> {
    const { renderType, forcePlaywright } = options;

    // YouTube always uses its own strategy
    if (isYouTubeUrl(url)) {
      const result = await youtubeFetch(url);
      return { ...result, detectedRenderType: "static" };
    }

    // Force Playwright if requested
    if (forcePlaywright) {
      return this.fetchWithPlaywright(url);
    }

    // If render type is known, use the appropriate strategy
    if (renderType === "static") {
      const result = await httpFetch(url);
      return { ...result, detectedRenderType: "static" };
    }

    if (renderType === "dynamic") {
      return this.fetchWithPlaywright(url);
    }

    // Unknown render type: try static first, fallback to dynamic
    this.logger.log(`Smart fetch for ${url}: trying static first...`);
    const staticResult = await httpFetch(url);

    if (staticResult.success && this.isContentSufficient(staticResult)) {
      this.logger.log(`Smart fetch for ${url}: static fetch successful`);
      return { ...staticResult, detectedRenderType: "static" };
    }

    // Static fetch failed or content insufficient, try dynamic
    this.logger.log(
      `Smart fetch for ${url}: static insufficient (${staticResult.extractedLength ?? 0} chars), trying dynamic...`,
    );
    return this.fetchWithPlaywright(url);
  }

  /**
   * Fetch using Playwright (browser pool)
   */
  private async fetchWithPlaywright(url: string): Promise<FetchResult> {
    if (!this.browserPoolService?.isReady()) {
      this.logger.warn("Browser pool not available, falling back to http fetch");
      const result = await httpFetch(url);
      return { ...result, detectedRenderType: "static" };
    }

    const result = await this.browserPoolService.fetch(url);
    return { ...result, detectedRenderType: "dynamic" };
  }

  /**
   * Check if extracted content is sufficient
   * Returns false if content seems incomplete (loading state, too short, etc.)
   */
  private isContentSufficient(result: FetchResult): boolean {
    if (!result.success || !result.content) {
      return false;
    }

    const content = result.content;
    const length = content.length;

    // Too short - likely incomplete
    if (length < 500) {
      return false;
    }

    // Check for loading state patterns
    const loadingPatterns = /loading\.\.\.|로딩 중|please wait|잠시만 기다려|fetching|불러오는 중/i;
    if (loadingPatterns.test(content) && length < 1000) {
      return false;
    }

    // Check for skeleton/placeholder patterns
    const skeletonPatterns = /█|░|skeleton|placeholder/i;
    if (skeletonPatterns.test(content) && length < 1000) {
      return false;
    }

    // Check meaningful character ratio (letters vs total)
    const meaningfulChars = content.match(/[a-zA-Z가-힣\u4e00-\u9fff]/g)?.length ?? 0;
    const ratio = meaningfulChars / length;
    if (ratio < 0.3) {
      return false;
    }

    return true;
  }
}
