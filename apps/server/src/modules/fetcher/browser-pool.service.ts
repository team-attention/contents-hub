import type { FetchResult } from "@contents-hub/shared";
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { BrowserPool, PlaywrightPlugin } from "browser-pool";
import type { Page } from "playwright";
import { chromium } from "playwright";
import { type PlaywrightFetchOptions, playwrightFetch } from "./strategies/playwright.strategy";

export interface BrowserPoolConfig {
  maxOpenPagesPerBrowser?: number;
  retireBrowserAfterPageCount?: number;
  operationTimeoutSecs?: number;
}

const DEFAULT_CONFIG: BrowserPoolConfig = {
  maxOpenPagesPerBrowser: 10,
  retireBrowserAfterPageCount: 50,
  operationTimeoutSecs: 120,
};

@Injectable()
export class BrowserPoolService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BrowserPoolService.name);
  private browserPool: BrowserPool | null = null;
  private readonly config: BrowserPoolConfig;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  async onModuleInit(): Promise<void> {
    this.logger.log("Initializing browser pool...");
    await this.initializePool();
    this.logger.log("Browser pool initialized");
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log("Shutting down browser pool...");
    await this.destroyPool();
    this.logger.log("Browser pool destroyed");
  }

  private async initializePool(): Promise<void> {
    const playwrightPlugin = new PlaywrightPlugin(chromium, {
      launchOptions: {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
        ],
      },
    });

    this.browserPool = new BrowserPool({
      browserPlugins: [playwrightPlugin],
      maxOpenPagesPerBrowser: this.config.maxOpenPagesPerBrowser,
      retireBrowserAfterPageCount: this.config.retireBrowserAfterPageCount,
      operationTimeoutSecs: this.config.operationTimeoutSecs,
    });
  }

  private async destroyPool(): Promise<void> {
    if (this.browserPool) {
      await this.browserPool.destroy();
      this.browserPool = null;
    }
  }

  /**
   * Fetch content from a URL using Playwright
   * Automatically manages browser pages from the pool
   */
  async fetch(url: string, options?: PlaywrightFetchOptions): Promise<FetchResult> {
    if (!this.browserPool) {
      return {
        success: false,
        contentItemId: "",
        url,
        errorType: "UNKNOWN",
        errorMessage: "Browser pool not initialized",
        durationMs: 0,
      };
    }

    let page: Page | null = null;

    try {
      // Get a page from the pool
      const poolPage = await this.browserPool.newPage();
      page = poolPage as unknown as Page;

      // Use the playwright strategy to fetch content
      const result = await playwrightFetch(page, url, options);

      return result;
    } catch (error) {
      this.logger.error(`Browser pool fetch error for ${url}:`, error);

      return {
        success: false,
        contentItemId: "",
        url,
        errorType: "UNKNOWN",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        durationMs: 0,
      };
    } finally {
      // Always return the page to the pool
      if (page) {
        try {
          await page.close();
        } catch (closeError) {
          this.logger.warn("Failed to close page:", closeError);
        }
      }
    }
  }

  /**
   * Fetch raw HTML from a URL using Playwright
   * Used for list-diff and other HTML parsing needs
   */
  async fetchHtml(
    url: string,
    options?: { timeout?: number; waitUntil?: "load" | "domcontentloaded" | "networkidle" },
  ): Promise<{ success: boolean; html: string; error?: string }> {
    if (!this.browserPool) {
      return {
        success: false,
        html: "",
        error: "Browser pool not initialized",
      };
    }

    const { timeout = 60000, waitUntil = "networkidle" } = options ?? {};
    let page: Page | null = null;

    try {
      const poolPage = await this.browserPool.newPage();
      page = poolPage as unknown as Page;

      await page.goto(url, { timeout, waitUntil });
      const html = await page.content();

      return { success: true, html };
    } catch (error) {
      this.logger.error(`Browser pool fetchHtml error for ${url}:`, error);

      return {
        success: false,
        html: "",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (closeError) {
          this.logger.warn("Failed to close page:", closeError);
        }
      }
    }
  }

  /**
   * Check if the browser pool is ready
   */
  isReady(): boolean {
    return this.browserPool !== null;
  }
}
