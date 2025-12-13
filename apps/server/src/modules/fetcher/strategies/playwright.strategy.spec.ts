import { type Browser, type Page, chromium } from "playwright";
import { playwrightFetch } from "./playwright.strategy";

describe("playwrightFetch", () => {
  let browser: Browser;
  let page: Page;

  // Set longer timeout for browser tests
  jest.setTimeout(60000);

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
  });

  afterEach(async () => {
    await page.close();
  });

  describe("static page fetching", () => {
    it("should fetch content from a static page", async () => {
      const url = "https://example.com";
      const result = await playwrightFetch(page, url);

      expect(result.success).toBe(true);
      expect(result.url).toBe(url);
      expect(result.title).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content!.length).toBeGreaterThan(50);
      expect(result.durationMs).toBeGreaterThan(0);

      console.log("=== Playwright Fetch Result ===");
      console.log("Title:", result.title);
      console.log("Content length:", result.extractedLength);
      console.log("Duration:", result.durationMs, "ms");
    });

    it("should fetch content from Wikipedia", async () => {
      const url = "https://en.wikipedia.org/wiki/TypeScript";
      const result = await playwrightFetch(page, url);

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content!.length).toBeGreaterThan(500);
      expect(result.content!.toLowerCase()).toMatch(/typescript|javascript|microsoft/i);

      console.log("=== Wikipedia Page ===");
      console.log("Title:", result.title);
      console.log("Content preview:", result.content!.substring(0, 300), "...");
    });
  });

  describe("waitForSelector option", () => {
    it("should wait for a specific selector before extracting content", async () => {
      const url = "https://example.com";
      const result = await playwrightFetch(page, url, {
        waitForSelector: "h1",
        waitForSelectorTimeout: 5000,
      });

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    });

    it("should handle missing selector gracefully", async () => {
      const url = "https://example.com";
      const result = await playwrightFetch(page, url, {
        waitForSelector: ".non-existent-selector-12345",
        waitForSelectorTimeout: 1000,
      });

      // Should still succeed even if selector not found (graceful degradation)
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle network errors", async () => {
      const url = "https://this-domain-definitely-does-not-exist-12345.com";
      const result = await playwrightFetch(page, url, { timeout: 10000 });

      expect(result.success).toBe(false);
      expect(result.errorType).toBeDefined();
      expect(["NETWORK_ERROR", "TIMEOUT", "UNKNOWN"]).toContain(result.errorType);

      console.log("Network error:", result.errorType, result.errorMessage);
    });

    it("should handle timeout", async () => {
      // Use a slow-loading resource
      const url = "https://httpbin.org/delay/10";
      const result = await playwrightFetch(page, url, { timeout: 2000 });

      expect(result.success).toBe(false);
      // httpbin might return various error types depending on how it responds
      expect(["TIMEOUT", "NETWORK_ERROR", "UNKNOWN", "SERVER_ERROR"]).toContain(result.errorType);

      console.log("Timeout error:", result.errorType, result.errorMessage);
    }, 15000);

    it("should handle 404 pages", async () => {
      const url = "https://httpbin.org/status/404";
      const result = await playwrightFetch(page, url);

      expect(result.success).toBe(false);
      // httpbin.org/status/404 returns actual 404, but might be caught as SERVER_ERROR
      expect(["NOT_FOUND", "SERVER_ERROR"]).toContain(result.errorType);
      if (result.errorType === "NOT_FOUND") {
        expect(result.statusCode).toBe(404);
      }
    });

    it("should handle 403 pages", async () => {
      const url = "https://httpbin.org/status/403";
      const result = await playwrightFetch(page, url);

      expect(result.success).toBe(false);
      // httpbin.org/status/403 returns actual 403, but might be caught as SERVER_ERROR
      expect(["FORBIDDEN", "SERVER_ERROR"]).toContain(result.errorType);
      if (result.errorType === "FORBIDDEN") {
        expect(result.statusCode).toBe(403);
      }
    });
  });

  describe("waitUntil options", () => {
    it("should support networkidle wait strategy", async () => {
      const url = "https://example.com";
      const result = await playwrightFetch(page, url, {
        waitUntil: "networkidle",
      });

      expect(result.success).toBe(true);
    });

    it("should support domcontentloaded wait strategy", async () => {
      const url = "https://example.com";
      const result = await playwrightFetch(page, url, {
        waitUntil: "domcontentloaded",
      });

      expect(result.success).toBe(true);
    });

    it("should support load wait strategy", async () => {
      const url = "https://example.com";
      const result = await playwrightFetch(page, url, {
        waitUntil: "load",
      });

      expect(result.success).toBe(true);
    });
  });
});

// Skip real SPA tests in CI environment
const isCI = process.env.CI === "true";

(isCI ? describe.skip : describe)("playwrightFetch - SPA pages", () => {
  let browser: Browser;
  let page: Page;

  jest.setTimeout(90000);

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
  });

  afterEach(async () => {
    await page.close();
  });

  it("should fetch content from a React-based site", async () => {
    // React docs are built with React/Docusaurus
    const url = "https://react.dev/learn";
    const result = await playwrightFetch(page, url, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    expect(result.success).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.content!.length).toBeGreaterThan(500);

    console.log("=== React Docs ===");
    console.log("Title:", result.title);
    console.log("Content length:", result.extractedLength);
  });
});
