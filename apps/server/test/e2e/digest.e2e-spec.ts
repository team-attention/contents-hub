import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import * as schema from "../../src/db/schema";
import { env } from "../../src/env";
import type { TestDb } from "../utils/global";
import { cleanAndSetupTestData, createTestApp } from "../utils/helpers";

// Test user ID - must match the MOCK_USER_ID in .env.test
const TEST_USER_ID = env.MOCK_USER_ID ?? "00000000-0000-0000-0000-000000000000";

describe("Digests (e2e)", () => {
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

  describe("GET /digests", () => {
    it("should return 401 without token", async () => {
      await request(app.getHttpServer()).get("/digests").expect(401);
    });

    it("should return empty list initially", async () => {
      const response = await request(app.getHttpServer())
        .get("/digests")
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(response.body).toHaveProperty("items");
      expect(response.body.items).toEqual([]);
    });

    it("should return created digests", async () => {
      // Create a digest directly in DB
      await db.insert(schema.digests).values({
        userId: TEST_USER_ID,
        title: "Test Digest",
        content: "Test content",
        itemCount: 2,
        totalInputTokens: 100,
        totalOutputTokens: 50,
      });

      const response = await request(app.getHttpServer())
        .get("/digests")
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].title).toBe("Test Digest");
      expect(response.body.items[0].content).toBe("Test content");
      expect(response.body.items[0].itemCount).toBe(2);
    });
  });

  describe("GET /digests/today", () => {
    it("should return 401 without token", async () => {
      await request(app.getHttpServer()).get("/digests/today").expect(401);
    });

    it("should return null when no digest exists for today", async () => {
      const response = await request(app.getHttpServer())
        .get("/digests/today")
        .set("Authorization", "Bearer any-token")
        .expect(200);

      // NestJS serializes null
      expect(response.body).toEqual({});
    });

    it("should return today's digest", async () => {
      // Create a digest for today
      const today = new Date().toISOString().split("T")[0];
      await db.insert(schema.digests).values({
        userId: TEST_USER_ID,
        title: `${today} Daily Digest`,
        content: "Today's content",
        itemCount: 3,
        totalInputTokens: 200,
        totalOutputTokens: 100,
      });

      const response = await request(app.getHttpServer())
        .get("/digests/today")
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(response.body.title).toBe(`${today} Daily Digest`);
      expect(response.body.content).toBe("Today's content");
    });
  });

  describe("GET /digests/:id", () => {
    it("should return 401 without token", async () => {
      await request(app.getHttpServer()).get("/digests/some-id").expect(401);
    });

    it("should return 404 for non-existent digest", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";

      await request(app.getHttpServer())
        .get(`/digests/${fakeId}`)
        .set("Authorization", "Bearer any-token")
        .expect(404);
    });

    it("should return digest by id", async () => {
      // Create a digest
      const [digestRecord] = await db
        .insert(schema.digests)
        .values({
          userId: TEST_USER_ID,
          title: "Specific Digest",
          content: "Specific content",
          itemCount: 5,
          totalInputTokens: 300,
          totalOutputTokens: 150,
        })
        .returning();

      const response = await request(app.getHttpServer())
        .get(`/digests/${digestRecord.id}`)
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(response.body.id).toBe(digestRecord.id);
      expect(response.body.title).toBe("Specific Digest");
      expect(response.body.content).toBe("Specific content");
      expect(response.body.itemCount).toBe(5);
    });
  });

  describe("POST /digests/trigger", () => {
    it("should return 401 without token", async () => {
      await request(app.getHttpServer()).post("/digests/trigger").expect(401);
    });

    it("should return no items to digest when empty", async () => {
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

  describe("User isolation", () => {
    it("should only return digests for the authenticated user", async () => {
      // Create digest for mock user
      await db.insert(schema.digests).values({
        userId: TEST_USER_ID,
        title: "User Digest",
        content: "User content",
        itemCount: 1,
        totalInputTokens: 50,
        totalOutputTokens: 25,
      });

      // Create digest for different user (use different UUID that won't match MOCK_USER_ID)
      await db.insert(schema.digests).values({
        userId: "00000000-0000-0000-0000-000000000099",
        title: "Other User Digest",
        content: "Other content",
        itemCount: 1,
        totalInputTokens: 50,
        totalOutputTokens: 25,
      });

      const response = await request(app.getHttpServer())
        .get("/digests")
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].title).toBe("User Digest");
    });

    it("should not return other user's digest by id", async () => {
      // Create digest for different user (use different UUID that won't match MOCK_USER_ID)
      const [otherDigest] = await db
        .insert(schema.digests)
        .values({
          userId: "00000000-0000-0000-0000-000000000099",
          title: "Other User Digest",
          content: "Other content",
          itemCount: 1,
          totalInputTokens: 50,
          totalOutputTokens: 25,
        })
        .returning();

      await request(app.getHttpServer())
        .get(`/digests/${otherDigest.id}`)
        .set("Authorization", "Bearer any-token")
        .expect(404);
    });
  });

  describe("Multiple digests", () => {
    it("should return digests in correct order (newest first)", async () => {
      // Create multiple digests with different timestamps
      await db.insert(schema.digests).values({
        userId: TEST_USER_ID,
        title: "Digest 1",
        content: "Content 1",
        itemCount: 1,
        totalInputTokens: 50,
        totalOutputTokens: 25,
      });

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      await db.insert(schema.digests).values({
        userId: TEST_USER_ID,
        title: "Digest 2",
        content: "Content 2",
        itemCount: 2,
        totalInputTokens: 100,
        totalOutputTokens: 50,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await db.insert(schema.digests).values({
        userId: TEST_USER_ID,
        title: "Digest 3",
        content: "Content 3",
        itemCount: 3,
        totalInputTokens: 150,
        totalOutputTokens: 75,
      });

      const response = await request(app.getHttpServer())
        .get("/digests")
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(response.body.items).toHaveLength(3);
      // Should be ordered by createdAt desc (newest first)
      expect(response.body.items[0].title).toBe("Digest 3");
      expect(response.body.items[1].title).toBe("Digest 2");
      expect(response.body.items[2].title).toBe("Digest 1");
    });
  });
});
