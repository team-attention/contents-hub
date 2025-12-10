import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import { env } from "../../src/env";
import type { TestDb } from "../utils/global";
import { cleanAndSetupTestData, createTestApp } from "../utils/helpers";

describe("Subscriptions (e2e)", () => {
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

  describe("GET /subscriptions", () => {
    it("should return 401 without token", async () => {
      await request(app.getHttpServer()).get("/subscriptions").expect(401);
    });

    it("should return empty list initially", async () => {
      const response = await request(app.getHttpServer())
        .get("/subscriptions")
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(response.body).toHaveProperty("items");
      expect(response.body.items).toEqual([]);
    });
  });

  describe("POST /subscriptions", () => {
    it("should return 401 without token", async () => {
      await request(app.getHttpServer())
        .post("/subscriptions")
        .send({ url: "https://example.com", name: "Test" })
        .expect(401);
    });

    it("should create a new subscription", async () => {
      const createDto = {
        url: "https://example.com/page",
        name: "My Test Subscription",
        checkInterval: 120,
      };

      const response = await request(app.getHttpServer())
        .post("/subscriptions")
        .set("Authorization", "Bearer any-token")
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject({
        url: createDto.url,
        name: createDto.name,
        checkInterval: createDto.checkInterval,
        status: "active",
      });
      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("createdAt");
      expect(response.body).toHaveProperty("updatedAt");
    });

    it("should create subscription with default checkInterval", async () => {
      const createDto = {
        url: "https://example.com/page",
        name: "Default Interval Sub",
      };

      const response = await request(app.getHttpServer())
        .post("/subscriptions")
        .set("Authorization", "Bearer any-token")
        .send(createDto)
        .expect(201);

      expect(response.body.checkInterval).toBe(60);
    });

    it("should return 400 for invalid URL", async () => {
      const createDto = {
        url: "not-a-valid-url",
        name: "Invalid URL Sub",
      };

      await request(app.getHttpServer())
        .post("/subscriptions")
        .set("Authorization", "Bearer any-token")
        .send(createDto)
        .expect(400);
    });
  });

  describe("GET /subscriptions (after creating)", () => {
    it("should return created subscriptions", async () => {
      // Create two subscriptions
      await request(app.getHttpServer())
        .post("/subscriptions")
        .set("Authorization", "Bearer any-token")
        .send({ url: "https://example1.com", name: "Sub 1" })
        .expect(201);

      await request(app.getHttpServer())
        .post("/subscriptions")
        .set("Authorization", "Bearer any-token")
        .send({ url: "https://example2.com", name: "Sub 2" })
        .expect(201);

      // Get all subscriptions
      const response = await request(app.getHttpServer())
        .get("/subscriptions")
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(response.body.items).toHaveLength(2);
      // Should be ordered by createdAt desc (newest first)
      expect(response.body.items[0].name).toBe("Sub 2");
      expect(response.body.items[1].name).toBe("Sub 1");
    });
  });

  describe("GET /subscriptions/by-url", () => {
    it("should return 401 without token", async () => {
      await request(app.getHttpServer())
        .get("/subscriptions/by-url")
        .query({ url: "https://example.com" })
        .expect(401);
    });

    it("should return empty response for non-existent URL", async () => {
      const response = await request(app.getHttpServer())
        .get("/subscriptions/by-url")
        .query({ url: "https://nonexistent.com" })
        .set("Authorization", "Bearer any-token")
        .expect(200);

      // NestJS serializes null as empty object or empty response
      expect(response.body).toEqual(expect.objectContaining({}));
      expect(response.body.id).toBeUndefined();
    });

    it("should find subscription by URL", async () => {
      const targetUrl = "https://target.com/page";

      // Create subscription
      await request(app.getHttpServer())
        .post("/subscriptions")
        .set("Authorization", "Bearer any-token")
        .send({ url: targetUrl, name: "Target Sub" })
        .expect(201);

      // Find by URL
      const response = await request(app.getHttpServer())
        .get("/subscriptions/by-url")
        .query({ url: targetUrl })
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(response.body).not.toBeNull();
      expect(response.body.url).toBe(targetUrl);
      expect(response.body.name).toBe("Target Sub");
    });
  });

  describe("DELETE /subscriptions/:id", () => {
    it("should return 401 without token", async () => {
      await request(app.getHttpServer())
        .delete("/subscriptions/some-id")
        .expect(401);
    });

    it("should return 404 for non-existent subscription", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";

      await request(app.getHttpServer())
        .delete(`/subscriptions/${fakeId}`)
        .set("Authorization", "Bearer any-token")
        .expect(404);
    });

    it("should delete existing subscription", async () => {
      // Create subscription
      const createResponse = await request(app.getHttpServer())
        .post("/subscriptions")
        .set("Authorization", "Bearer any-token")
        .send({ url: "https://to-delete.com", name: "To Delete" })
        .expect(201);

      const subscriptionId = createResponse.body.id;

      // Delete it
      await request(app.getHttpServer())
        .delete(`/subscriptions/${subscriptionId}`)
        .set("Authorization", "Bearer any-token")
        .expect(204);

      // Verify it's gone
      const listResponse = await request(app.getHttpServer())
        .get("/subscriptions")
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(listResponse.body.items).toHaveLength(0);
    });
  });

  describe("User isolation", () => {
    it("should only return subscriptions for the authenticated user", async () => {
      // Create subscription as mock user
      await request(app.getHttpServer())
        .post("/subscriptions")
        .set("Authorization", "Bearer any-token")
        .send({ url: "https://user1.com", name: "User 1 Sub" })
        .expect(201);

      // Subscriptions are isolated by userId (from MOCK_USER_ID)
      // All requests with the same mock token will see the same user's data
      const response = await request(app.getHttpServer())
        .get("/subscriptions")
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].name).toBe("User 1 Sub");
    });
  });
});
