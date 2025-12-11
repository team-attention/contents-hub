import type { FetchResult } from "@contents-hub/shared";
import { extract } from "@extractus/article-extractor";

export interface HttpFetchOptions {
  timeout?: number;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds

export async function httpFetch(url: string, options: HttpFetchOptions = {}): Promise<FetchResult> {
  const startTime = Date.now();
  const { timeout = DEFAULT_TIMEOUT } = options;

  try {
    // Use article-extractor which handles fetch internally
    const article = await Promise.race([
      extract(url),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), timeout)),
    ]);

    if (!article || !article.content) {
      return {
        success: false,
        contentItemId: "",
        url,
        errorType: "EXTRACTION_ERROR",
        errorMessage: "Failed to extract article content from URL",
        durationMs: Date.now() - startTime,
      };
    }

    // Strip HTML tags from content to get plain text
    const plainText = stripHtml(article.content);

    return {
      success: true,
      contentItemId: "",
      url,
      title: article.title || undefined,
      content: plainText,
      contentLength: article.content.length,
      extractedLength: plainText.length,
      statusCode: 200,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    if (error instanceof Error) {
      if (error.message === "TIMEOUT") {
        return {
          success: false,
          contentItemId: "",
          url,
          errorType: "TIMEOUT",
          errorMessage: `Request timed out after ${timeout}ms`,
          durationMs,
        };
      }

      // Network errors
      if (error.message.includes("fetch failed") || error.message.includes("ENOTFOUND")) {
        return {
          success: false,
          contentItemId: "",
          url,
          errorType: "NETWORK_ERROR",
          errorMessage: error.message,
          durationMs,
        };
      }

      // 404 or other HTTP errors
      if (error.message.includes("404")) {
        return {
          success: false,
          contentItemId: "",
          url,
          statusCode: 404,
          errorType: "NOT_FOUND",
          errorMessage: error.message,
          durationMs,
        };
      }
    }

    return {
      success: false,
      contentItemId: "",
      url,
      errorType: "UNKNOWN",
      errorMessage: error instanceof Error ? error.message : "Unknown error occurred",
      durationMs,
    };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/&nbsp;/g, " ") // Replace &nbsp;
    .replace(/&amp;/g, "&") // Replace &amp;
    .replace(/&lt;/g, "<") // Replace &lt;
    .replace(/&gt;/g, ">") // Replace &gt;
    .replace(/&quot;/g, '"') // Replace &quot;
    .replace(/&#39;/g, "'") // Replace &#39;
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}
