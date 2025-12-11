import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import * as schema from "../../src/db/schema";
import type { TestDb } from "../utils/global";
import { cleanAndSetupTestData, createTestApp } from "../utils/helpers";

// Import mock function from setup-mocks (globally configured)
// The mocks are already set up in setup-mocks.ts

describe("Pipeline E2E Tests", () => {
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

  describe("Scenario 1: Single Item Flow (Happy Path)", () => {
    it("should process content item through fetch -> summarize -> digest", async () => {
      const testUrl = "https://example.com/test-article";

      // Step 1: Create content item
      const createResponse = await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: testUrl })
        .expect(201);

      expect(createResponse.body.status).toBe("pending");
      const itemId = createResponse.body.id;

      // Step 2: Trigger digest pipeline
      const triggerResponse = await request(app.getHttpServer())
        .post("/digests/trigger")
        .set("Authorization", "Bearer any-token")
        .expect(201);

      expect(triggerResponse.body.success).toBe(true);
      expect(triggerResponse.body.fetchedCount).toBe(1);
      expect(triggerResponse.body.summarizedCount).toBe(1);
      expect(triggerResponse.body.digest).toBeDefined();

      // Step 3: Verify content item was updated
      const itemResponse = await request(app.getHttpServer())
        .get(`/content-items/${itemId}`)
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(itemResponse.body.status).toBe("done");
      expect(itemResponse.body.summary).toBeDefined();
      expect(itemResponse.body.digestId).toBe(triggerResponse.body.digest.id);

      // Step 4: Verify fetch history was created
      const fetchHistory = await db.select().from(schema.fetchHistory);
      expect(fetchHistory).toHaveLength(1);
      expect(fetchHistory[0].success).toBe(1);
      expect(fetchHistory[0].url).toBe(testUrl);

      // Step 5: Verify digest history was created
      const digestHistory = await db.select().from(schema.digestHistory);
      expect(digestHistory.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Scenario 2: Batch Digest Flow", () => {
    it("should process multiple items in a single digest", async () => {
      // Create 3 content items
      await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: "https://example.com/article-1" })
        .expect(201);

      await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: "https://example.com/article-2" })
        .expect(201);

      await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: "https://example.com/article-3" })
        .expect(201);

      // Trigger digest
      const triggerResponse = await request(app.getHttpServer())
        .post("/digests/trigger")
        .set("Authorization", "Bearer any-token")
        .expect(201);

      expect(triggerResponse.body.success).toBe(true);
      expect(triggerResponse.body.fetchedCount).toBe(3);
      expect(triggerResponse.body.summarizedCount).toBe(3);
      expect(triggerResponse.body.digest).toBeDefined();
      expect(triggerResponse.body.digest.itemCount).toBe(3);

      // All items should be done
      const itemsResponse = await request(app.getHttpServer())
        .get("/content-items")
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(itemsResponse.body.items).toHaveLength(3);
      for (const item of itemsResponse.body.items) {
        expect(item.status).toBe("done");
        expect(item.digestId).toBe(triggerResponse.body.digest.id);
      }
    });
  });

  describe("Scenario 3: Empty Pipeline", () => {
    it("should handle empty pipeline gracefully", async () => {
      // No content items created

      const response = await request(app.getHttpServer())
        .post("/digests/trigger")
        .set("Authorization", "Bearer any-token")
        .expect(201);

      expect(response.body.success).toBe(false);
      expect(response.body.fetchedCount).toBe(0);
      expect(response.body.summarizedCount).toBe(0);
      expect(response.body.message).toContain("No items to digest");
    });
  });

  describe("Scenario 4: Already Processed Items", () => {
    it("should not reprocess done items", async () => {
      // Create and process an item
      await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: "https://example.com/article" })
        .expect(201);

      await request(app.getHttpServer())
        .post("/digests/trigger")
        .set("Authorization", "Bearer any-token")
        .expect(201);

      // Trigger again - should not process the done item
      const secondResponse = await request(app.getHttpServer())
        .post("/digests/trigger")
        .set("Authorization", "Bearer any-token")
        .expect(201);

      expect(secondResponse.body.success).toBe(false);
      expect(secondResponse.body.fetchedCount).toBe(0);
    });
  });

  describe("Scenario 5: View Digest After Creation", () => {
    it("should be able to view created digest via GET endpoints", async () => {
      // Create and process
      await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: "https://example.com/article" })
        .expect(201);

      const triggerResponse = await request(app.getHttpServer())
        .post("/digests/trigger")
        .set("Authorization", "Bearer any-token")
        .expect(201);

      const digestId = triggerResponse.body.digest.id;

      // Get by ID
      const getByIdResponse = await request(app.getHttpServer())
        .get(`/digests/${digestId}`)
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(getByIdResponse.body.id).toBe(digestId);

      // Get today's digest
      const getTodayResponse = await request(app.getHttpServer())
        .get("/digests/today")
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(getTodayResponse.body.id).toBe(digestId);

      // Get all digests
      const getAllResponse = await request(app.getHttpServer())
        .get("/digests")
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(getAllResponse.body.items).toHaveLength(1);
      expect(getAllResponse.body.items[0].id).toBe(digestId);
    });
  });
});
