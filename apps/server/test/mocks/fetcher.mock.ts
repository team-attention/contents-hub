import type { FetchErrorType, FetchResult } from "@contents-hub/shared";

/**
 * Creates a successful fetch result mock
 */
export function createSuccessfulFetchResult(
  url: string,
  options: Partial<FetchResult> = {},
): FetchResult {
  return {
    success: true,
    contentItemId: "",
    url,
    title: options.title ?? "Mocked Article Title",
    content:
      options.content ??
      "This is mocked article content for testing purposes. It contains multiple sentences to simulate real article content. The content should be long enough to test summarization.",
    contentLength: 500,
    extractedLength: 200,
    statusCode: 200,
    durationMs: 100,
    ...options,
  };
}

/**
 * Creates a failed fetch result mock
 */
export function createFailedFetchResult(
  url: string,
  errorType: FetchErrorType = "NETWORK_ERROR",
  errorMessage = "Mocked network error",
): FetchResult {
  return {
    success: false,
    contentItemId: "",
    url,
    errorType,
    errorMessage,
    durationMs: 50,
  };
}

/**
 * Mock implementation for httpFetch
 * Use this with jest.mock to override the actual implementation
 */
export const mockHttpFetch = jest
  .fn()
  .mockImplementation(async (url: string): Promise<FetchResult> => {
    // Default behavior: return success for all URLs
    return createSuccessfulFetchResult(url);
  });

/**
 * Configure mock to return specific results for specific URLs
 */
export function configureFetchMock(config: Record<string, FetchResult>): void {
  mockHttpFetch.mockImplementation(async (url: string): Promise<FetchResult> => {
    if (config[url]) {
      return config[url];
    }
    // Default success for unconfigured URLs
    return createSuccessfulFetchResult(url);
  });
}

/**
 * Reset mock to default behavior
 */
export function resetFetchMock(): void {
  mockHttpFetch.mockImplementation(async (url: string): Promise<FetchResult> => {
    return createSuccessfulFetchResult(url);
  });
}
