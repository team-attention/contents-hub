import type { FetchResult } from "@contents-hub/shared";
import { FetcherService } from "./fetcher.service";

// Mock database connection
const mockDb = {
  insert: jest.fn().mockReturnValue({ values: jest.fn() }),
  update: jest.fn().mockReturnValue({
    set: jest.fn().mockReturnValue({ where: jest.fn() }),
  }),
};

// Mock BrowserPoolService
const mockBrowserPoolService = {
  isReady: jest.fn().mockReturnValue(true),
  fetch: jest.fn(),
};

describe("FetcherService", () => {
  let fetcherService: FetcherService;

  beforeEach(() => {
    jest.clearAllMocks();
    // biome-ignore lint/suspicious/noExplicitAny: Test mocks need flexible types
    fetcherService = new FetcherService(mockDb as any, mockBrowserPoolService as any);
  });

  describe("isContentSufficient (via smartFetch)", () => {
    // Access private method for testing
    const isContentSufficient = (result: FetchResult) => {
      // biome-ignore lint/suspicious/noExplicitAny: Accessing private method for testing
      return (fetcherService as any).isContentSufficient(result);
    };

    it("should return false for failed results", () => {
      const result: FetchResult = {
        success: false,
        contentItemId: "",
        url: "https://example.com",
        durationMs: 100,
      };

      expect(isContentSufficient(result)).toBe(false);
    });

    it("should return false for empty content", () => {
      const result: FetchResult = {
        success: true,
        contentItemId: "",
        url: "https://example.com",
        content: "",
        durationMs: 100,
      };

      expect(isContentSufficient(result)).toBe(false);
    });

    it("should return false for content less than 500 chars", () => {
      const result: FetchResult = {
        success: true,
        contentItemId: "",
        url: "https://example.com",
        content: "Short content",
        durationMs: 100,
      };

      expect(isContentSufficient(result)).toBe(false);
    });

    it("should return false for loading state content", () => {
      const result: FetchResult = {
        success: true,
        contentItemId: "",
        url: "https://example.com",
        content: "Loading... Please wait while we fetch the content.",
        durationMs: 100,
      };

      expect(isContentSufficient(result)).toBe(false);
    });

    it("should return false for skeleton content", () => {
      const result: FetchResult = {
        success: true,
        contentItemId: "",
        url: "https://example.com",
        content: "█████████ ░░░░░░░░░ skeleton placeholder ████████",
        durationMs: 100,
      };

      expect(isContentSufficient(result)).toBe(false);
    });

    it("should return false for low meaningful character ratio", () => {
      const result: FetchResult = {
        success: true,
        contentItemId: "",
        url: "https://example.com",
        content: "... ... ... --- === +++ ### *** ^^^ ~~~ ``` ''' \"\"\"".repeat(20),
        durationMs: 100,
      };

      expect(isContentSufficient(result)).toBe(false);
    });

    it("should return true for substantial content", () => {
      const result: FetchResult = {
        success: true,
        contentItemId: "",
        url: "https://example.com",
        content: `
          TypeScript is a strongly typed programming language that builds on JavaScript,
          giving you better tooling at any scale. It adds optional static typing and
          class-based object-oriented programming to the language. TypeScript is designed
          for development of large applications and transcompiles to JavaScript. As
          TypeScript is a superset of JavaScript, existing JavaScript programs are also
          valid TypeScript programs. TypeScript may be used to develop JavaScript
          applications for both client-side and server-side execution.
        `.repeat(3),
        durationMs: 100,
      };

      expect(isContentSufficient(result)).toBe(true);
    });

    it("should return true for Korean content", () => {
      const result: FetchResult = {
        success: true,
        contentItemId: "",
        url: "https://example.com",
        content: `
          타입스크립트는 자바스크립트를 기반으로 하는 강타입 프로그래밍 언어입니다.
          어떤 규모에서든 더 나은 도구를 제공합니다. 선택적 정적 타이핑과 클래스 기반
          객체 지향 프로그래밍을 언어에 추가합니다. 타입스크립트는 대규모 애플리케이션
          개발을 위해 설계되었으며 자바스크립트로 트랜스컴파일됩니다.
        `.repeat(5),
        durationMs: 100,
      };

      expect(isContentSufficient(result)).toBe(true);
    });
  });

  describe("smartFetch", () => {
    beforeEach(() => {
      // Reset mocks
      mockBrowserPoolService.isReady.mockReturnValue(true);
    });

    it("should use static fetch for known static pages", async () => {
      const result = await fetcherService.smartFetch("https://example.com", {
        renderType: "static",
      });

      // Should not call browserPoolService.fetch
      expect(mockBrowserPoolService.fetch).not.toHaveBeenCalled();
      expect(result.detectedRenderType).toBe("static");
    });

    it("should use dynamic fetch for known dynamic pages", async () => {
      mockBrowserPoolService.fetch.mockResolvedValue({
        success: true,
        contentItemId: "",
        url: "https://spa-example.com",
        content: "Dynamic content",
        durationMs: 500,
      });

      const result = await fetcherService.smartFetch("https://spa-example.com", {
        renderType: "dynamic",
      });

      expect(mockBrowserPoolService.fetch).toHaveBeenCalled();
      expect(result.detectedRenderType).toBe("dynamic");
    });

    it("should force playwright when forcePlaywright is true", async () => {
      mockBrowserPoolService.fetch.mockResolvedValue({
        success: true,
        contentItemId: "",
        url: "https://example.com",
        content: "Content from Playwright",
        durationMs: 500,
      });

      const result = await fetcherService.smartFetch("https://example.com", {
        forcePlaywright: true,
      });

      expect(mockBrowserPoolService.fetch).toHaveBeenCalled();
      expect(result.detectedRenderType).toBe("dynamic");
    });

    it("should fallback to http when browser pool is not ready", async () => {
      mockBrowserPoolService.isReady.mockReturnValue(false);

      const result = await fetcherService.smartFetch("https://example.com", {
        renderType: "dynamic",
      });

      // Should fallback to static
      expect(result.detectedRenderType).toBe("static");
    });
  });
});
