import { httpFetch } from "./http.strategy";

describe("httpFetch", () => {
  // 실제 네트워크 요청이므로 타임아웃 여유있게 설정
  jest.setTimeout(60000);

  describe("Wikipedia article fetching", () => {
    it("should successfully fetch and extract content from Wikipedia", async () => {
      const url = "https://en.wikipedia.org/wiki/TypeScript";

      const result = await httpFetch(url);

      expect(result.success).toBe(true);
      expect(result.url).toBe(url);
      expect(result.title).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content!.length).toBeGreaterThan(100);
      expect(result.extractedLength).toBeGreaterThan(0);
      expect(result.statusCode).toBe(200);
      expect(result.durationMs).toBeGreaterThan(0);

      // Wikipedia TypeScript 페이지에는 관련 키워드가 있어야 함
      const content = result.content!.toLowerCase();
      expect(content).toMatch(/typescript|javascript|microsoft/i);

      console.log("=== Fetch Result ===");
      console.log("Title:", result.title);
      console.log("Content length:", result.extractedLength);
      console.log("Duration:", result.durationMs, "ms");
      console.log("Content preview:", result.content!.substring(0, 300), "...");
    });

    it("should extract Korean Wikipedia article", async () => {
      const url = "https://ko.wikipedia.org/wiki/타입스크립트";

      const result = await httpFetch(url);

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content!.length).toBeGreaterThan(100);

      console.log("=== Korean Wikipedia ===");
      console.log("Title:", result.title);
      console.log("Content preview:", result.content!.substring(0, 300), "...");
    });
  });

  describe("error handling", () => {
    it("should handle 404 not found", async () => {
      const url = "https://en.wikipedia.org/wiki/This_Page_Does_Not_Exist_12345";

      const result = await httpFetch(url);

      // article-extractor가 404를 어떻게 처리하는지에 따라 다름
      // 실패하거나 빈 콘텐츠를 반환할 수 있음
      if (!result.success) {
        expect(result.errorType).toBeDefined();
        console.log("Error type:", result.errorType);
        console.log("Error message:", result.errorMessage);
      } else {
        // 일부 404 페이지는 콘텐츠가 추출될 수 있음
        console.log("Page returned content despite being non-existent");
      }
    });

    it("should handle invalid URL", async () => {
      const url = "https://invalid-domain-that-does-not-exist-12345.com/page";

      const result = await httpFetch(url);

      expect(result.success).toBe(false);
      expect(result.errorType).toBe("NETWORK_ERROR");
      expect(result.errorMessage).toBeDefined();

      console.log("Network error:", result.errorMessage);
    });

    it("should timeout for slow requests", async () => {
      // httpbin의 delay 엔드포인트 사용 (10초 지연)
      const url = "https://httpbin.org/delay/10";

      const result = await httpFetch(url, { timeout: 2000 }); // 2초 타임아웃

      expect(result.success).toBe(false);
      // article-extractor가 타임아웃을 다르게 처리할 수 있음
      expect(["TIMEOUT", "UNKNOWN", "NETWORK_ERROR"]).toContain(result.errorType);

      console.log("Timeout/Error type:", result.errorType);
      console.log("Timeout/Error message:", result.errorMessage);
    }, 15000);
  });
});
