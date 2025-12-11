import { ContentItemsService } from "@/modules/content-items/content-items.service";
import { DigesterService } from "@/modules/digester/digester.service";
import { FetcherService } from "@/modules/fetcher/fetcher.service";
import type { DigestResult, FetchResult, SummarizeResult } from "@contents-hub/shared";
import { Injectable, Logger } from "@nestjs/common";

export interface PipelineResult {
  fetchResults: FetchResult[];
  summarizeResults: SummarizeResult[];
  digestResult: DigestResult | null;
}

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly contentItemsService: ContentItemsService,
    private readonly fetcherService: FetcherService,
    private readonly digesterService: DigesterService,
  ) {}

  /**
   * Fetch all pending content items for a user
   */
  async runFetchPending(userId: string): Promise<FetchResult[]> {
    const pendingItems = await this.contentItemsService.findPending(userId);

    if (pendingItems.length === 0) {
      this.logger.log(`No pending items for user ${userId}`);
      return [];
    }

    this.logger.log(`Fetching ${pendingItems.length} pending items for user ${userId}`);

    const fetchRequests = pendingItems.map((item) => ({
      contentItemId: item.id,
      url: item.url,
    }));

    return this.fetcherService.fetchMany(fetchRequests);
  }

  /**
   * Summarize all ready (fetched) content items for a user
   */
  async runSummarizeReady(userId: string): Promise<SummarizeResult[]> {
    const readyItems = await this.contentItemsService.findReady(userId);

    if (readyItems.length === 0) {
      this.logger.log(`No ready items for user ${userId}`);
      return [];
    }

    this.logger.log(`Summarizing ${readyItems.length} ready items for user ${userId}`);

    const summarizeRequests = readyItems
      .filter((item) => item.fetchedContent && !item.summary)
      .map((item) => ({
        contentItemId: item.id,
        title: item.title ?? item.url,
        content: item.fetchedContent!,
      }));

    return this.digesterService.summarizeMany(summarizeRequests);
  }

  /**
   * Create a digest from all summarized content items for a user
   */
  async runDigestForUser(userId: string): Promise<DigestResult | null> {
    const readyItems = await this.contentItemsService.findReady(userId);

    const itemsWithSummary = readyItems.filter((item) => item.summary);

    if (itemsWithSummary.length === 0) {
      this.logger.log(`No summarized items for user ${userId}`);
      return null;
    }

    this.logger.log(`Creating digest from ${itemsWithSummary.length} items for user ${userId}`);

    return this.digesterService.digest({
      userId,
      items: itemsWithSummary.map((item) => ({
        contentItemId: item.id,
        title: item.title ?? item.url,
        url: item.url,
        summary: item.summary!,
      })),
    });
  }

  /**
   * Run the full pipeline: fetch -> summarize -> digest
   */
  async runFullPipeline(userId: string): Promise<PipelineResult> {
    this.logger.log(`Running full pipeline for user ${userId}`);

    // Step 1: Fetch pending items
    const fetchResults = await this.runFetchPending(userId);
    this.logger.log(
      `Fetch complete: ${fetchResults.filter((r) => r.success).length}/${fetchResults.length} successful`,
    );

    // Step 2: Summarize fetched items
    const summarizeResults = await this.runSummarizeReady(userId);
    this.logger.log(
      `Summarize complete: ${summarizeResults.filter((r) => r.success).length}/${summarizeResults.length} successful`,
    );

    // Step 3: Create digest
    const digestResult = await this.runDigestForUser(userId);
    if (digestResult?.success) {
      this.logger.log(`Digest created: ${digestResult.digestId}`);
    }

    return {
      fetchResults,
      summarizeResults,
      digestResult,
    };
  }
}
