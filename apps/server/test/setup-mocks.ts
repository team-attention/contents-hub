// Mock @extractus/article-extractor
// Content must be at least 500 chars to pass isContentSufficient check in smartFetch
const MOCK_ARTICLE_CONTENT = `
<p>This is a comprehensive mocked article content for testing purposes.</p>
<p>The article discusses various aspects of software development and testing best practices.
It covers topics such as unit testing, integration testing, and end-to-end testing strategies.</p>
<p>In modern software development, testing is crucial for ensuring code quality and reliability.
Automated tests help catch bugs early in the development cycle and provide confidence when refactoring code.</p>
<p>This mock content is intentionally made longer to simulate real article content that would be
extracted from web pages. Real articles typically contain multiple paragraphs of meaningful text.</p>
<p>The testing framework we use supports various assertion methods and mocking capabilities,
making it easy to isolate components and verify their behavior in controlled environments.</p>
`;

jest.mock("@extractus/article-extractor", () => ({
  extract: jest.fn().mockResolvedValue({
    title: "Mocked Article Title",
    content: MOCK_ARTICLE_CONTENT,
  }),
}));

// Mock @google/genai
const mockGenerateContent = jest.fn().mockResolvedValue({
  text: "This is a mocked summary or digest content.",
  usageMetadata: {
    promptTokenCount: 100,
    candidatesTokenCount: 50,
  },
});

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}));

// Export mock functions for test manipulation
export { mockGenerateContent };
