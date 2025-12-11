/**
 * Mock for @google/genai GoogleGenAI class
 */

export interface MockGenerateContentResponse {
  text: string;
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
  };
}

/**
 * Creates a mock response for summarization
 */
export function createSummarizeResponse(summary?: string): MockGenerateContentResponse {
  return {
    text:
      summary ??
      "This is a mocked summary of the article content. It highlights the key points and provides a concise overview.",
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 50,
    },
  };
}

/**
 * Creates a mock response for digest
 */
export function createDigestResponse(content?: string): MockGenerateContentResponse {
  return {
    text:
      content ??
      `# Daily Digest

## Summary
Here is your daily digest combining multiple articles.

### Article 1
Key points from the first article.

### Article 2
Key points from the second article.

## Conclusion
These articles cover important topics for today.`,
    usageMetadata: {
      promptTokenCount: 300,
      candidatesTokenCount: 150,
    },
  };
}

/**
 * Mock generateContent function
 */
export const mockGenerateContent = jest
  .fn()
  .mockImplementation(async (): Promise<MockGenerateContentResponse> => {
    return createSummarizeResponse();
  });

/**
 * Mock GoogleGenAI class
 */
export const MockGoogleGenAI = jest.fn().mockImplementation(() => ({
  models: {
    generateContent: mockGenerateContent,
  },
}));

/**
 * Configure mock to fail
 */
export function configureMockToFail(errorMessage = "API error"): void {
  mockGenerateContent.mockImplementation(async () => {
    throw new Error(errorMessage);
  });
}

/**
 * Configure mock to return specific responses
 */
export function configureMockResponses(responses: MockGenerateContentResponse[]): void {
  let callIndex = 0;
  mockGenerateContent.mockImplementation(async () => {
    const response = responses[callIndex] ?? createSummarizeResponse();
    callIndex++;
    return response;
  });
}

/**
 * Reset mock to default behavior
 */
export function resetGenAIMock(): void {
  mockGenerateContent.mockImplementation(async (): Promise<MockGenerateContentResponse> => {
    return createSummarizeResponse();
  });
}
