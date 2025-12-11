import { type DbConnection, PROVIDER_DB_CONNECTION } from "@/db/drizzle.module";
import { contentItems, fetchHistory } from "@/db/schema";
import type { FetchRequest, FetchResult } from "@contents-hub/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { httpFetch } from "./strategies/http.strategy";

@Injectable()
export class FetcherService {
  private readonly logger = new Logger(FetcherService.name);

  constructor(
    @Inject(PROVIDER_DB_CONNECTION)
    private readonly db: DbConnection,
  ) {}

  /**
   * Fetch content from a URL and update the content item
   */
  async fetch(request: FetchRequest): Promise<FetchResult> {
    this.logger.log(`Fetching: ${request.url}`);

    // Execute HTTP fetch
    const result = await httpFetch(request.url);
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
   * Fetch multiple content items
   */
  async fetchMany(requests: FetchRequest[]): Promise<FetchResult[]> {
    const results: FetchResult[] = [];

    for (const request of requests) {
      try {
        const result = await this.fetch(request);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to fetch ${request.url}:`, error);
        results.push({
          success: false,
          contentItemId: request.contentItemId,
          url: request.url,
          errorType: "UNKNOWN",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          durationMs: 0,
        });
      }
    }

    return results;
  }

  private async saveFetchHistory(result: FetchResult): Promise<void> {
    await this.db.insert(fetchHistory).values({
      contentItemId: result.contentItemId,
      url: result.url,
      success: result.success ? 1 : 0,
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
}
