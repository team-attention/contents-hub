import type { FetchResult } from "@contents-hub/shared";
import type { Page } from "playwright";

export interface PlaywrightFetchOptions {
  timeout?: number;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
  waitForSelector?: string;
  waitForSelectorTimeout?: number;
}

const DEFAULT_TIMEOUT = 60000; // 60 seconds
const DEFAULT_WAIT_FOR_SELECTOR_TIMEOUT = 10000; // 10 seconds

/**
 * Fetch content from a URL using Playwright (headless browser)
 * Used for dynamic/SPA pages that require JavaScript rendering
 *
 * @param page - Playwright Page instance (provided by BrowserPoolService)
 * @param url - URL to fetch
 * @param options - Fetch options
 */
export async function playwrightFetch(
  page: Page,
  url: string,
  options: PlaywrightFetchOptions = {},
): Promise<FetchResult> {
  const startTime = Date.now();
  const {
    timeout = DEFAULT_TIMEOUT,
    waitUntil = "networkidle",
    waitForSelector,
    waitForSelectorTimeout = DEFAULT_WAIT_FOR_SELECTOR_TIMEOUT,
  } = options;

  try {
    // Navigate to the page
    const response = await page.goto(url, {
      timeout,
      waitUntil,
    });

    // Check HTTP status
    const status = response?.status();
    if (status && status >= 400) {
      return {
        success: false,
        contentItemId: "",
        url,
        statusCode: status,
        errorType: status === 404 ? "NOT_FOUND" : status === 403 ? "FORBIDDEN" : "SERVER_ERROR",
        errorMessage: `HTTP ${status} error`,
        durationMs: Date.now() - startTime,
      };
    }

    // Wait for specific selector if provided (for SPA content)
    if (waitForSelector) {
      try {
        await page.waitForSelector(waitForSelector, {
          timeout: waitForSelectorTimeout,
        });
      } catch {
        // Selector not found within timeout - continue anyway
        // Content might still be usable
      }
    }

    // Get the rendered HTML content
    const html = await page.content();

    // Extract text content from the page
    // Try to find main content area first, then fallback to body
    const { title, content } = await page.evaluate(() => {
      // Priority order for content extraction
      const contentSelectors = [
        "article",
        "main",
        '[role="main"]',
        ".post-content",
        ".article-content",
        ".entry-content",
        ".content",
        "#content",
        ".post",
        ".article",
      ];

      let contentElement: Element | null = null;
      for (const selector of contentSelectors) {
        contentElement = document.querySelector(selector);
        if (contentElement) break;
      }

      // Fallback to body if no content area found
      const textSource = contentElement || document.body;

      // Remove script, style, nav, header, footer elements
      const clone = textSource.cloneNode(true) as Element;
      const removeSelectors = [
        "script",
        "style",
        "nav",
        "header",
        "footer",
        "aside",
        ".sidebar",
        ".nav",
        ".menu",
      ];
      for (const sel of removeSelectors) {
        clone.querySelectorAll(sel).forEach((el) => el.remove());
      }

      const text = clone.textContent || "";
      const pageTitle = document.title;

      return { title: pageTitle, content: text };
    });

    const plainText = content.replace(/\s+/g, " ").trim();

    if (plainText.length < 100) {
      return {
        success: false,
        contentItemId: "",
        url,
        statusCode: status || 200,
        errorType: "EXTRACTION_ERROR",
        errorMessage: "Failed to extract sufficient content from rendered page",
        durationMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      contentItemId: "",
      url,
      title: title || undefined,
      content: plainText,
      contentLength: html.length,
      extractedLength: plainText.length,
      statusCode: status || 200,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    if (error instanceof Error) {
      // Timeout errors
      if (error.message.includes("Timeout") || error.message.includes("timeout")) {
        return {
          success: false,
          contentItemId: "",
          url,
          errorType: "TIMEOUT",
          errorMessage: `Page load timed out after ${timeout}ms`,
          durationMs,
        };
      }

      // Navigation errors (network issues)
      if (
        error.message.includes("net::") ||
        error.message.includes("ERR_") ||
        error.message.includes("Navigation failed")
      ) {
        return {
          success: false,
          contentItemId: "",
          url,
          errorType: "NETWORK_ERROR",
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
