// Mock @extractus/article-extractor
jest.mock("@extractus/article-extractor", () => ({
  extract: jest.fn().mockResolvedValue({
    title: "Mocked Article Title",
    content: "<p>This is mocked article content for testing purposes.</p>",
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
