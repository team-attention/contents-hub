import { ListDiffService } from "./list-diff.service";

describe("ListDiffService", () => {
  let service: ListDiffService;

  beforeEach(() => {
    service = new ListDiffService();
  });

  describe("diffUrls", () => {
    it("should find new URLs that are not in previous list", () => {
      const previous = ["https://example.com/1", "https://example.com/2"];
      const current = ["https://example.com/3", "https://example.com/2", "https://example.com/1"];

      const newUrls = service.diffUrls(previous, current);

      expect(newUrls).toEqual(["https://example.com/3"]);
    });

    it("should return empty array when no new URLs", () => {
      const previous = ["https://example.com/1", "https://example.com/2"];
      const current = ["https://example.com/2", "https://example.com/1"];

      const newUrls = service.diffUrls(previous, current);

      expect(newUrls).toEqual([]);
    });

    it("should return all URLs when previous is empty", () => {
      const previous: string[] = [];
      const current = ["https://example.com/1", "https://example.com/2"];

      const newUrls = service.diffUrls(previous, current);

      expect(newUrls).toEqual(["https://example.com/1", "https://example.com/2"]);
    });

    it("should handle multiple new URLs", () => {
      const previous = ["https://example.com/1"];
      const current = ["https://example.com/3", "https://example.com/2", "https://example.com/1"];

      const newUrls = service.diffUrls(previous, current);

      expect(newUrls).toEqual(["https://example.com/3", "https://example.com/2"]);
    });

    it("should preserve order of new URLs from current list", () => {
      const previous = ["https://example.com/old"];
      const current = [
        "https://example.com/c",
        "https://example.com/a",
        "https://example.com/b",
        "https://example.com/old",
      ];

      const newUrls = service.diffUrls(previous, current);

      expect(newUrls).toEqual([
        "https://example.com/c",
        "https://example.com/a",
        "https://example.com/b",
      ]);
    });
  });

  describe("fetch", () => {
    const SAMPLE_HTML = `
      <html>
        <body>
          <section id="posts" class="post-list">
            <article class="post-item">
              <a href="/post/3">Post 3</a>
            </article>
            <article class="post-item">
              <a href="/post/2">Post 2</a>
            </article>
            <article class="post-item">
              <a href="/post/1">Post 1</a>
            </article>
          </section>
        </body>
      </html>
    `;

    beforeEach(() => {
      // biome-ignore lint/suspicious/noExplicitAny: mocking private method
      jest.spyOn(service as any, "fetchHtml").mockResolvedValue(SAMPLE_HTML);
    });

    it("should extract URLs from container using selector", async () => {
      const result = await service.fetch("https://example.com", "#posts");

      expect(result.success).toBe(true);
      expect(result.urls).toEqual([
        "https://example.com/post/3",
        "https://example.com/post/2",
        "https://example.com/post/1",
      ]);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should generate selector hierarchy for AI analysis", async () => {
      const result = await service.fetch("https://example.com", "#posts");

      expect(result.success).toBe(true);
      expect(result.selectorHierarchy).toContain("<section");
      expect(result.selectorHierarchy).toContain("<article");
      expect(result.selectorHierarchy).toContain("<a");
    });

    it("should return error when selector not found", async () => {
      const result = await service.fetch("https://example.com", "#nonexistent");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Selector not found");
      expect(result.urls).toEqual([]);
    });

    it("should handle fetch errors gracefully", async () => {
      // biome-ignore lint/suspicious/noExplicitAny: mocking private method
      jest.spyOn(service as any, "fetchHtml").mockRejectedValue(new Error("Network error"));

      const result = await service.fetch("https://example.com", "#posts");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("should skip javascript: and anchor links", async () => {
      const htmlWithJsLinks = `
        <html><body>
          <div id="links">
            <a href="javascript:void(0)">JS Link</a>
            <a href="#section">Anchor</a>
            <a href="/real-link">Real</a>
          </div>
        </body></html>
      `;
      // biome-ignore lint/suspicious/noExplicitAny: mocking private method
      jest.spyOn(service as any, "fetchHtml").mockResolvedValue(htmlWithJsLinks);

      const result = await service.fetch("https://example.com", "#links");

      expect(result.success).toBe(true);
      expect(result.urls).toEqual(["https://example.com/real-link"]);
    });

    it("should deduplicate URLs", async () => {
      const htmlWithDuplicates = `
        <html><body>
          <div id="links">
            <a href="/post/1">Link 1</a>
            <a href="/post/1">Link 1 Again</a>
            <a href="/post/2">Link 2</a>
          </div>
        </body></html>
      `;
      // biome-ignore lint/suspicious/noExplicitAny: mocking private method
      jest.spyOn(service as any, "fetchHtml").mockResolvedValue(htmlWithDuplicates);

      const result = await service.fetch("https://example.com", "#links");

      expect(result.urls).toEqual(["https://example.com/post/1", "https://example.com/post/2"]);
    });
  });

  describe("lookupUrlsInPage", () => {
    const SAMPLE_HTML = `
      <html>
        <body>
          <main>
            <section class="posts">
              <article><a href="https://example.com/post/3">Post 3</a></article>
              <article><a href="https://example.com/post/2">Post 2</a></article>
              <article><a href="https://example.com/post/1">Post 1</a></article>
            </section>
          </main>
        </body>
      </html>
    `;

    beforeEach(() => {
      // biome-ignore lint/suspicious/noExplicitAny: mocking private method
      jest.spyOn(service as any, "fetchHtml").mockResolvedValue(SAMPLE_HTML);
    });

    it("should find known URLs and return container info", async () => {
      const knownUrls = ["https://example.com/post/2", "https://example.com/post/1"];

      const result = await service.lookupUrlsInPage("https://example.com", knownUrls);

      expect(result.found).toBe(true);
      expect(result.foundUrls).toContain("https://example.com/post/2");
      expect(result.foundUrls).toContain("https://example.com/post/1");
      expect(result.containerSelector).toBeDefined();
      expect(result.containerUrls).toBeDefined();
      expect(result.containerUrls!.length).toBeGreaterThanOrEqual(2);
    });

    it("should return not found when URLs do not exist", async () => {
      const knownUrls = ["https://example.com/nonexistent"];

      const result = await service.lookupUrlsInPage("https://example.com", knownUrls);

      expect(result.found).toBe(false);
      expect(result.foundUrls).toEqual([]);
    });

    it("should find container with single URL by climbing parents", async () => {
      const knownUrls = ["https://example.com/post/2"];

      const result = await service.lookupUrlsInPage("https://example.com", knownUrls);

      expect(result.found).toBe(true);
      // Should climb up to find a container with multiple links
      expect(result.containerUrls!.length).toBeGreaterThan(1);
    });

    it("should handle fetch errors", async () => {
      // biome-ignore lint/suspicious/noExplicitAny: mocking private method
      jest.spyOn(service as any, "fetchHtml").mockRejectedValue(new Error("Network error"));

      const result = await service.lookupUrlsInPage("https://example.com", [
        "https://example.com/post/1",
      ]);

      expect(result.found).toBe(false);
    });
  });

  describe("private helper methods (via integration)", () => {
    it("should clean CSS-in-JS hash classes", async () => {
      // Note: cleanClasses regex filters patterns like:
      // - sc-* (styled-components)
      // - css-* (emotion)
      // - [_-]?[a-z]{1,3}[a-zA-Z0-9]{5,} (generic hash patterns starting with letters)
      const htmlWithHashClasses = `
        <html><body>
          <div id="container" class="posts sc-abc123def css-xyz789abc _abc12345 real-class">
            <a href="/link">Link</a>
          </div>
        </body></html>
      `;
      // biome-ignore lint/suspicious/noExplicitAny: mocking private method
      jest.spyOn(service as any, "fetchHtml").mockResolvedValue(htmlWithHashClasses);

      const result = await service.fetch("https://example.com", "#container");

      expect(result.success).toBe(true);
      // selectorHierarchy should not contain hash classes
      expect(result.selectorHierarchy).not.toMatch(/sc-abc123def/);
      expect(result.selectorHierarchy).not.toMatch(/css-xyz789abc/);
      expect(result.selectorHierarchy).not.toMatch(/_abc12345/);
      expect(result.selectorHierarchy).toContain("real-class");
    });

    it("should normalize relative URLs to absolute", async () => {
      const htmlWithRelativeUrls = `
        <html><body>
          <div id="links">
            <a href="/relative/path">Relative</a>
            <a href="https://other.com/absolute">Absolute</a>
            <a href="./same-dir">Same Dir</a>
          </div>
        </body></html>
      `;
      // biome-ignore lint/suspicious/noExplicitAny: mocking private method
      jest.spyOn(service as any, "fetchHtml").mockResolvedValue(htmlWithRelativeUrls);

      const result = await service.fetch("https://example.com/page/", "#links");

      expect(result.urls).toContain("https://example.com/relative/path");
      expect(result.urls).toContain("https://other.com/absolute");
      expect(result.urls).toContain("https://example.com/page/same-dir");
    });

    it("should truncate long href and text in selectorHierarchy", async () => {
      const longUrl = `/very-long-url-${"x".repeat(100)}`;
      const longText = `Very long link text ${"y".repeat(100)}`;
      const htmlWithLongContent = `
        <html><body>
          <div id="links">
            <a href="${longUrl}">${longText}</a>
          </div>
        </body></html>
      `;
      // biome-ignore lint/suspicious/noExplicitAny: mocking private method
      jest.spyOn(service as any, "fetchHtml").mockResolvedValue(htmlWithLongContent);

      const result = await service.fetch("https://example.com", "#links");

      // selectorHierarchy should have truncated content
      expect(result.selectorHierarchy).toContain("...");
      expect(result.selectorHierarchy.length).toBeLessThan(500);
    });
  });
});
