import { extract } from "@extractus/article-extractor";
import { GoogleGenAI } from "@google/genai";
/**
 * Mock Verification Tests
 * Verifies that external service mocks are working correctly
 */
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import type { TestDb } from "../utils/global";
import { cleanAndSetupTestData, createTestApp } from "../utils/helpers";

describe("Mock Verification", () => {
  let app: INestApplication;
  let db: TestDb;

  beforeAll(async () => {
    ({ app, db } = await createTestApp(AppModule));
  });

  afterEach(async () => {
    await cleanAndSetupTestData(db);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Article Extractor Mock", () => {
    it("should be mocked", () => {
      expect(jest.isMockFunction(extract)).toBe(true);
    });

    it("should return mocked content when called", async () => {
      const result = await extract("https://any-url.com");
      expect(result).toEqual({
        title: "Mocked Article Title",
        content: "<p>This is mocked article content for testing purposes.</p>",
      });
    });
  });

  describe("GoogleGenAI Mock", () => {
    it("should be mocked", () => {
      expect(jest.isMockFunction(GoogleGenAI)).toBe(true);
    });

    it("should return mocked response when called", async () => {
      const genai = new GoogleGenAI({ apiKey: "test-key" });
      const response = await genai.models.generateContent({
        model: "test",
        contents: "test",
      });

      expect(response).toEqual({
        text: "This is a mocked summary or digest content.",
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
        },
      });
    });
  });

  describe("Integration - Mock in Pipeline", () => {
    it("should use mocked article extractor in fetch", async () => {
      // Create a content item
      const createResponse = await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: "https://example.com/test" })
        .expect(201);

      // Trigger pipeline - this will use the mocked extract function
      const triggerResponse = await request(app.getHttpServer())
        .post("/digests/trigger")
        .set("Authorization", "Bearer any-token")
        .expect(201);

      // Verify mock was used - item should be processed with mocked content
      expect(triggerResponse.body.success).toBe(true);
      expect(triggerResponse.body.fetchedCount).toBe(1);

      // The item should have the mocked title
      const itemResponse = await request(app.getHttpServer())
        .get(`/content-items/${createResponse.body.id}`)
        .set("Authorization", "Bearer any-token")
        .expect(200);

      // Title comes from mocked article extractor
      expect(itemResponse.body.title).toBe("Mocked Article Title");
      expect(itemResponse.body.status).toBe("done");
    });
  });
});
