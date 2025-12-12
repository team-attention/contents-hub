import type { ListDiffResult, UrlLookupResult } from "../../src/modules/subscriptions/list-diff";

/**
 * HTML Fixtures for list-diff testing
 */

// Initial state: 3 posts
export const INITIAL_HTML_URLS = [
  "https://example.com/post/3",
  "https://example.com/post/2",
  "https://example.com/post/1",
];

// Updated state: 1 new post added at top
export const UPDATED_HTML_URLS = [
  "https://example.com/post/4", // NEW
  "https://example.com/post/3",
  "https://example.com/post/2",
  "https://example.com/post/1",
];

// Multiple new posts
export const MULTIPLE_NEW_URLS = [
  "https://example.com/post/6", // NEW
  "https://example.com/post/5", // NEW
  "https://example.com/post/4",
  "https://example.com/post/3",
  "https://example.com/post/2",
];

export const SAMPLE_SELECTOR_HIERARCHY = `<section class="posts"><article class="post-item"><a href="/post/3">Post 3</a></article><article class="post-item"><a href="/post/2">Post 2</a></article><article class="post-item"><a href="/post/1">Post 1</a></article></section>`;

/**
 * Create a successful ListDiffResult
 */
export function createListDiffResult(
  urls: string[],
  options: Partial<ListDiffResult> = {},
): ListDiffResult {
  return {
    success: true,
    urls,
    selectorHierarchy: options.selectorHierarchy ?? SAMPLE_SELECTOR_HIERARCHY,
    durationMs: options.durationMs ?? 100,
    ...options,
  };
}

/**
 * Create a failed ListDiffResult
 */
export function createFailedListDiffResult(
  error: string,
  options: Partial<ListDiffResult> = {},
): ListDiffResult {
  return {
    success: false,
    urls: [],
    selectorHierarchy: "",
    error,
    durationMs: options.durationMs ?? 50,
    ...options,
  };
}

/**
 * Create a successful UrlLookupResult
 */
export function createUrlLookupResult(
  foundUrls: string[],
  containerUrls: string[],
  options: { containerSelector?: string; selectorHierarchy?: string } = {},
): UrlLookupResult {
  return {
    found: true,
    foundUrls,
    containerSelector: options.containerSelector ?? "section.posts",
    containerUrls,
    selectorHierarchy: options.selectorHierarchy ?? SAMPLE_SELECTOR_HIERARCHY,
  };
}

/**
 * Create a failed UrlLookupResult
 */
export function createFailedUrlLookupResult(): UrlLookupResult {
  return {
    found: false,
    foundUrls: [],
  };
}

/**
 * Mock configuration for ListDiffService
 * Use with jest.spyOn to configure behavior
 */
export interface ListDiffMockConfig {
  fetchResults?: Map<string, ListDiffResult>; // url+selector -> result
  lookupResult?: UrlLookupResult;
  defaultFetchResult?: ListDiffResult;
}

/**
 * Configure ListDiffService mock with specific behaviors
 */
export function configureListDiffMock(
  listDiffService: {
    fetch: jest.Mock;
    lookupUrlsInPage: jest.Mock;
    diffUrls: jest.Mock;
  },
  config: ListDiffMockConfig,
): void {
  // Configure fetch mock
  if (config.fetchResults) {
    listDiffService.fetch.mockImplementation(async (url: string, selector: string) => {
      const key = `${url}|${selector}`;
      return (
        config.fetchResults?.get(key) ??
        config.defaultFetchResult ??
        createFailedListDiffResult("Not configured")
      );
    });
  } else if (config.defaultFetchResult) {
    listDiffService.fetch.mockResolvedValue(config.defaultFetchResult);
  }

  // Configure lookupUrlsInPage mock
  if (config.lookupResult) {
    listDiffService.lookupUrlsInPage.mockResolvedValue(config.lookupResult);
  }

  // diffUrls is a pure function, keep real implementation
  listDiffService.diffUrls.mockImplementation((prev: string[], curr: string[]) => {
    const prevSet = new Set(prev);
    return curr.filter((url) => !prevSet.has(url));
  });
}
