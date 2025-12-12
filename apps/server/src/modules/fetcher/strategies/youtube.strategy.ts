import type { FetchResult } from "@contents-hub/shared";
import { fetchTranscript } from "youtube-transcript-plus";

export interface YouTubeFetchOptions {
  timeout?: number;
}

const DEFAULT_TIMEOUT = 60000; // 60 seconds

/**
 * Extract video ID from various YouTube URL formats
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&?/]+)/,
    /^([a-zA-Z0-9_-]{11})$/, // Just the video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Check if a URL is a YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/.test(url);
}

/**
 * Fetch YouTube video transcript using youtube-transcript-plus
 */
export async function youtubeFetch(
  url: string,
  options: YouTubeFetchOptions = {},
): Promise<FetchResult> {
  const startTime = Date.now();
  const { timeout = DEFAULT_TIMEOUT } = options;

  const videoId = extractVideoId(url);
  if (!videoId) {
    return {
      success: false,
      contentItemId: "",
      url,
      errorType: "INVALID_URL",
      errorMessage: "Could not extract YouTube video ID from URL",
      durationMs: Date.now() - startTime,
    };
  }

  try {
    const fetchPromise = (async () => {
      // Try to get transcript - prefer English, then Korean, then any available
      const transcript = await fetchTranscript(videoId).catch(async () => {
        // If default fails, try English explicitly
        return fetchTranscript(videoId, { lang: "en" }).catch(async () => {
          // Try Korean as fallback
          return fetchTranscript(videoId, { lang: "ko" });
        });
      });

      // Combine transcript segments into full text
      // Note: YouTube returns double-encoded entities like &amp;#39; so we decode &amp; first
      const content = transcript
        .map((segment) => segment.text)
        .join(" ")
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();

      // Build title from video ID (we don't have metadata with this library)
      const title = `YouTube Video: ${videoId}`;

      return { title, content };
    })();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT")), timeout),
    );

    const { title, content } = await Promise.race([fetchPromise, timeoutPromise]);

    if (!content) {
      return {
        success: false,
        contentItemId: "",
        url,
        errorType: "EXTRACTION_ERROR",
        errorMessage: "No transcript available for this video",
        durationMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      contentItemId: "",
      url,
      title,
      content,
      contentLength: content.length,
      extractedLength: content.length,
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

      // Transcript disabled or not available
      if (
        error.constructor.name === "YoutubeTranscriptDisabledError" ||
        error.message.includes("disabled")
      ) {
        return {
          success: false,
          contentItemId: "",
          url,
          errorType: "TRANSCRIPT_DISABLED",
          errorMessage: "Transcripts are disabled for this video",
          durationMs,
        };
      }

      // Video not found
      if (
        error.constructor.name === "YoutubeTranscriptVideoUnavailableError" ||
        error.message.includes("not found") ||
        error.message.includes("404")
      ) {
        return {
          success: false,
          contentItemId: "",
          url,
          statusCode: 404,
          errorType: "NOT_FOUND",
          errorMessage: "YouTube video not found",
          durationMs,
        };
      }

      // No transcript available in any language
      if (
        error.constructor.name === "YoutubeTranscriptNotAvailableError" ||
        error.constructor.name === "YoutubeTranscriptNotAvailableLanguageError"
      ) {
        return {
          success: false,
          contentItemId: "",
          url,
          errorType: "EXTRACTION_ERROR",
          errorMessage: "No transcript available for this video",
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
