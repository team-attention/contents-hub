import { extractVideoId, isYouTubeUrl, youtubeFetch } from "./youtube.strategy";

// CI 환경에서는 실제 네트워크 테스트 skip
const isCI = process.env.CI === "true";

describe("YouTube Strategy", () => {
  describe("extractVideoId", () => {
    it("should extract video ID from standard watch URL", () => {
      expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("should extract video ID from short URL", () => {
      expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("should extract video ID from embed URL", () => {
      expect(extractVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("should extract video ID from URL with extra params", () => {
      expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120")).toBe(
        "dQw4w9WgXcQ",
      );
    });

    it("should extract raw video ID", () => {
      expect(extractVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("should return null for invalid URLs", () => {
      expect(extractVideoId("https://example.com/video")).toBeNull();
      expect(extractVideoId("not-a-valid-id")).toBeNull();
      expect(extractVideoId("")).toBeNull();
    });
  });

  describe("isYouTubeUrl", () => {
    it("should return true for YouTube URLs", () => {
      expect(isYouTubeUrl("https://www.youtube.com/watch?v=abc123")).toBe(true);
      expect(isYouTubeUrl("https://youtu.be/abc123")).toBe(true);
      expect(isYouTubeUrl("https://youtube.com/embed/abc123")).toBe(true);
    });

    it("should return false for non-YouTube URLs", () => {
      expect(isYouTubeUrl("https://vimeo.com/123456")).toBe(false);
      expect(isYouTubeUrl("https://example.com")).toBe(false);
    });
  });

  // 실제 네트워크 요청 테스트 - CI에서는 skip
  const describeNetwork = isCI ? describe.skip : describe;

  describeNetwork("youtubeFetch - transcript fetching", () => {
    jest.setTimeout(120000);

    it("should fetch transcript from a video with captions", async () => {
      // Gavin Baker interview - has English auto-generated captions
      const url = "https://www.youtube.com/watch?v=tT1z66zSw-k";

      const result = await youtubeFetch(url);

      expect(result.success).toBe(true);
      expect(result.url).toBe(url);
      expect(result.content).toBeDefined();
      expect(result.content!.length).toBeGreaterThan(1000);
      expect(result.contentLength).toBeGreaterThan(0);
      expect(result.statusCode).toBe(200);
      expect(result.durationMs).toBeGreaterThan(0);

      // Content should have properly decoded HTML entities
      expect(result.content).not.toContain("&#39;");
      expect(result.content).not.toContain("&amp;");

      console.log("=== Transcript Fetch Result ===");
      console.log("Title:", result.title);
      console.log("Content length:", result.contentLength);
      console.log("Duration:", result.durationMs, "ms");
      console.log("Content preview:", result.content!.substring(0, 300), "...");
    });

    it("should fetch transcript from TED Talk with multiple languages", async () => {
      // Tim Urban TED Talk - has many subtitle languages
      const url = "https://www.youtube.com/watch?v=arj7oStGLkU";

      const result = await youtubeFetch(url);

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content!.length).toBeGreaterThan(500);

      console.log("=== TED Talk Result ===");
      console.log("Title:", result.title);
      console.log("Content length:", result.contentLength);
      console.log("Content preview:", result.content!.substring(0, 200), "...");
    });
  });

  describeNetwork("youtubeFetch - error handling", () => {
    jest.setTimeout(120000);

    it("should handle video with disabled transcripts", async () => {
      // Baby Shark - transcripts are disabled
      const url = "https://www.youtube.com/watch?v=XqZsoesa55w";

      const result = await youtubeFetch(url);

      expect(result.success).toBe(false);
      expect(result.errorType).toBe("TRANSCRIPT_DISABLED");
      expect(result.errorMessage).toBeDefined();

      console.log("=== Disabled Transcript ===");
      console.log("Error type:", result.errorType);
      console.log("Error message:", result.errorMessage);
    });

    it("should handle invalid video ID", async () => {
      const url = "https://www.youtube.com/watch?v=invalid123xx";

      const result = await youtubeFetch(url);

      expect(result.success).toBe(false);
      expect(["NOT_FOUND", "EXTRACTION_ERROR", "UNKNOWN"]).toContain(result.errorType);

      console.log("=== Invalid Video ===");
      console.log("Error type:", result.errorType);
      console.log("Error message:", result.errorMessage);
    });

    it("should handle invalid URL format", async () => {
      const url = "not-a-youtube-url";

      const result = await youtubeFetch(url);

      expect(result.success).toBe(false);
      expect(result.errorType).toBe("INVALID_URL");
    });

    it("should handle short URL format", async () => {
      // Same video as first test but with short URL
      const url = "https://youtu.be/tT1z66zSw-k";

      const result = await youtubeFetch(url);

      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content!.length).toBeGreaterThan(1000);

      console.log("=== Short URL Result ===");
      console.log("Content length:", result.contentLength);
    });
  });
});
