import { type DbConnection, PROVIDER_DB_CONNECTION } from "@/db/drizzle.module";
import { contentItems, fetchHistory } from "@/db/schema";
import type { FetchRequest, FetchResult } from "@contents-hub/shared";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { httpFetch } from "./strategies/http.strategy";
import { isYouTubeUrl, youtubeFetch } from "./strategies/youtube.strategy";

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

    // Select strategy based on URL
    const result = isYouTubeUrl(request.url)
      ? await youtubeFetch(request.url)
      : await httpFetch(request.url);
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
