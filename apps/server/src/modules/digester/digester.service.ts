import { type DbConnection, PROVIDER_DB_CONNECTION } from "@/db/drizzle.module";
import { contentItems, digestHistory, digests } from "@/db/schema";
import { env } from "@/env";
import type {
  DigestRequest,
  DigestResult,
  SummarizeRequest,
  SummarizeResult,
} from "@contents-hub/shared";
import { GoogleGenAI } from "@google/genai";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";
import { DIGEST_SYSTEM_PROMPT, buildDigestUserPrompt } from "./prompts/digest.prompt";
import { SUMMARIZE_SYSTEM_PROMPT, buildSummarizeUserPrompt } from "./prompts/summarize.prompt";

const DEFAULT_MODEL = "gemini-2.0-flash";

@Injectable()
export class DigesterService {
  private readonly logger = new Logger(DigesterService.name);
  private readonly genai: GoogleGenAI;

  constructor(
    @Inject(PROVIDER_DB_CONNECTION)
    private readonly db: DbConnection,
  ) {
    this.genai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }

  /**
   * Summarize a single content item
   */
  async summarize(request: SummarizeRequest): Promise<SummarizeResult> {
    const startTime = Date.now();
    this.logger.log(`Summarizing content item: ${request.contentItemId}`);

    try {
      const response = await this.genai.models.generateContent({
        model: DEFAULT_MODEL,
        config: {
          maxOutputTokens: 1024,
          systemInstruction: SUMMARIZE_SYSTEM_PROMPT,
        },
        contents: buildSummarizeUserPrompt(request.title, request.content),
      });

      const durationMs = Date.now() - startTime;
      const summary = response.text ?? "";
      const usage = response.usageMetadata;

      const result: SummarizeResult = {
        success: true,
        contentItemId: request.contentItemId,
        summary,
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
        model: DEFAULT_MODEL,
        durationMs,
      };

      // Save to digest_history
      await this.saveDigestHistory({
        contentItemId: request.contentItemId,
        operationType: "summarize",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        model: result.model,
        durationMs: result.durationMs,
        success: true,
      });

      // Update content item with summary
      await this.db
        .update(contentItems)
        .set({ summary })
        .where(eq(contentItems.id, request.contentItemId));

      this.logger.log(
        `Summarization complete: ${result.inputTokens} in / ${result.outputTokens} out tokens`,
      );

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      this.logger.error(`Summarization failed: ${errorMessage}`);

      // Save error to digest_history
      await this.saveDigestHistory({
        contentItemId: request.contentItemId,
        operationType: "summarize",
        inputTokens: 0,
        outputTokens: 0,
        model: DEFAULT_MODEL,
        durationMs,
        success: false,
        errorMessage,
      });

      return {
        success: false,
        contentItemId: request.contentItemId,
        inputTokens: 0,
        outputTokens: 0,
        model: DEFAULT_MODEL,
        durationMs,
        errorMessage,
      };
    }
  }

  /**
   * Create a combined digest from multiple content items
   */
  async digest(request: DigestRequest): Promise<DigestResult> {
    const startTime = Date.now();
    this.logger.log(
      `Creating digest for user ${request.userId} with ${request.items.length} items`,
    );

    if (request.items.length === 0) {
      return {
        success: false,
        itemCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        model: DEFAULT_MODEL,
        durationMs: 0,
        errorMessage: "No items to digest",
      };
    }

    try {
      const response = await this.genai.models.generateContent({
        model: DEFAULT_MODEL,
        config: {
          maxOutputTokens: 4096,
          systemInstruction: DIGEST_SYSTEM_PROMPT,
        },
        contents: buildDigestUserPrompt(
          request.items.map((item) => ({
            title: item.title,
            url: item.url,
            summary: item.summary,
          })),
        ),
      });

      const durationMs = Date.now() - startTime;
      const content = response.text ?? "";
      const title = this.generateDigestTitle();
      const usage = response.usageMetadata;

      const inputTokens = usage?.promptTokenCount ?? 0;
      const outputTokens = usage?.candidatesTokenCount ?? 0;

      // Create digest record
      const [digestRecord] = await this.db
        .insert(digests)
        .values({
          userId: request.userId,
          title,
          content,
          itemCount: request.items.length,
          totalInputTokens: inputTokens,
          totalOutputTokens: outputTokens,
        })
        .returning();

      // Save to digest_history
      await this.saveDigestHistory({
        digestId: digestRecord.id,
        operationType: "digest",
        inputTokens,
        outputTokens,
        model: DEFAULT_MODEL,
        durationMs,
        success: true,
      });

      // Update all content items with digest reference and status (bulk update)
      const itemIds = request.items.map((item) => item.contentItemId);
      await this.db
        .update(contentItems)
        .set({
          digestId: digestRecord.id,
          status: "done",
        })
        .where(inArray(contentItems.id, itemIds));

      this.logger.log(`Digest created: ${digestRecord.id} with ${request.items.length} items`);

      return {
        success: true,
        digestId: digestRecord.id,
        title,
        content,
        itemCount: request.items.length,
        inputTokens,
        outputTokens,
        model: DEFAULT_MODEL,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      this.logger.error(`Digest creation failed: ${errorMessage}`);

      // Save error to digest_history
      await this.saveDigestHistory({
        operationType: "digest",
        inputTokens: 0,
        outputTokens: 0,
        model: DEFAULT_MODEL,
        durationMs,
        success: false,
        errorMessage,
      });

      return {
        success: false,
        itemCount: request.items.length,
        inputTokens: 0,
        outputTokens: 0,
        model: DEFAULT_MODEL,
        durationMs,
        errorMessage,
      };
    }
  }

  /**
   * Summarize multiple content items (parallel execution)
   */
  async summarizeMany(requests: SummarizeRequest[]): Promise<SummarizeResult[]> {
    return Promise.all(requests.map((request) => this.summarize(request)));
  }

  private generateDigestTitle(): string {
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    return `${dateStr} Daily Digest`;
  }

  private async saveDigestHistory(data: {
    digestId?: string;
    contentItemId?: string;
    operationType: string;
    inputTokens: number;
    outputTokens: number;
    model: string;
    durationMs: number;
    success: boolean;
    errorMessage?: string;
  }): Promise<void> {
    await this.db.insert(digestHistory).values({
      digestId: data.digestId,
      contentItemId: data.contentItemId,
      operationType: data.operationType,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      model: data.model,
      durationMs: data.durationMs,
      success: data.success,
      errorMessage: data.errorMessage,
    });
  }
}
