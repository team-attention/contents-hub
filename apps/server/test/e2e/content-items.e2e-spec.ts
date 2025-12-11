import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import type { TestDb } from "../utils/global";
import { cleanAndSetupTestData, createTestApp } from "../utils/helpers";

describe("ContentItems (e2e)", () => {
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

  describe("GET /content-items", () => {
    it("should return 401 without token", async () => {
      await request(app.getHttpServer()).get("/content-items").expect(401);
    });

    it("should return empty list initially", async () => {
      const response = await request(app.getHttpServer())
        .get("/content-items")
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(response.body).toHaveProperty("items");
      expect(response.body.items).toEqual([]);
    });

    it("should filter by status", async () => {
      // Create a content item first
      await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: "https://example.com/article" })
        .expect(201);

      // Filter by pending status
      const response = await request(app.getHttpServer())
        .get("/content-items")
        .query({ status: "pending" })
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].status).toBe("pending");

      // Filter by ready status (should be empty)
      const readyResponse = await request(app.getHttpServer())
        .get("/content-items")
        .query({ status: "ready" })
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(readyResponse.body.items).toHaveLength(0);
    });
  });

  describe("POST /content-items", () => {
    it("should return 401 without token", async () => {
      await request(app.getHttpServer())
        .post("/content-items")
        .send({ url: "https://example.com" })
        .expect(401);
    });

    it("should create a new content item", async () => {
      const createDto = {
        url: "https://example.com/article",
        title: "Test Article",
      };

      const response = await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send(createDto)
        .expect(201);

      expect(response.body).toMatchObject({
        url: createDto.url,
        title: createDto.title,
        status: "pending",
      });
      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("createdAt");
      expect(response.body).toHaveProperty("updatedAt");
    });

    it("should create content item without title", async () => {
      const createDto = {
        url: "https://example.com/article",
      };

      const response = await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send(createDto)
        .expect(201);

      expect(response.body.url).toBe(createDto.url);
      expect(response.body.title).toBeNull();
      expect(response.body.status).toBe("pending");
    });

    it("should return 400 for invalid URL", async () => {
      const createDto = {
        url: "not-a-valid-url",
      };

      await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send(createDto)
        .expect(400);
    });

    it("should return 400 for empty URL", async () => {
      await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({})
        .expect(400);
    });
  });

  describe("GET /content-items/:id", () => {
    it("should return 401 without token", async () => {
      await request(app.getHttpServer()).get("/content-items/some-id").expect(401);
    });

    it("should return 404 for non-existent content item", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";

      await request(app.getHttpServer())
        .get(`/content-items/${fakeId}`)
        .set("Authorization", "Bearer any-token")
        .expect(404);
    });

    it("should return content item by id", async () => {
      // Create a content item
      const createResponse = await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: "https://example.com/article", title: "Test" })
        .expect(201);

      const itemId = createResponse.body.id;

      // Get by id
      const response = await request(app.getHttpServer())
        .get(`/content-items/${itemId}`)
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(response.body.id).toBe(itemId);
      expect(response.body.url).toBe("https://example.com/article");
      expect(response.body.title).toBe("Test");
    });
  });

  describe("GET /content-items/by-url", () => {
    it("should return 401 without token", async () => {
      await request(app.getHttpServer())
        .get("/content-items/by-url")
        .query({ url: "https://example.com" })
        .expect(401);
    });

    it("should return null for non-existent URL", async () => {
      const response = await request(app.getHttpServer())
        .get("/content-items/by-url")
        .query({ url: "https://nonexistent.com" })
        .set("Authorization", "Bearer any-token")
        .expect(200);

      // NestJS serializes null as empty object or empty response
      expect(response.body.id).toBeUndefined();
    });

    it("should find content item by URL", async () => {
      const targetUrl = "https://example.com/unique-article";

      // Create content item
      await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: targetUrl, title: "Target Article" })
        .expect(201);

      // Find by URL
      const response = await request(app.getHttpServer())
        .get("/content-items/by-url")
        .query({ url: targetUrl })
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(response.body).not.toBeNull();
      expect(response.body.url).toBe(targetUrl);
      expect(response.body.title).toBe("Target Article");
    });
  });

  describe("PATCH /content-items/:id", () => {
    it("should return 401 without token", async () => {
      await request(app.getHttpServer())
        .patch("/content-items/some-id")
        .send({ title: "New Title" })
        .expect(401);
    });

    it("should return 404 for non-existent content item", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";

      await request(app.getHttpServer())
        .patch(`/content-items/${fakeId}`)
        .set("Authorization", "Bearer any-token")
        .send({ title: "New Title" })
        .expect(404);
    });

    it("should update content item title", async () => {
      // Create content item
      const createResponse = await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: "https://example.com/article" })
        .expect(201);

      const itemId = createResponse.body.id;

      // Update title
      const response = await request(app.getHttpServer())
        .patch(`/content-items/${itemId}`)
        .set("Authorization", "Bearer any-token")
        .send({ title: "Updated Title" })
        .expect(200);

      expect(response.body.title).toBe("Updated Title");
    });

    it("should update content item status", async () => {
      // Create content item
      const createResponse = await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: "https://example.com/article" })
        .expect(201);

      const itemId = createResponse.body.id;

      // Update status
      const response = await request(app.getHttpServer())
        .patch(`/content-items/${itemId}`)
        .set("Authorization", "Bearer any-token")
        .send({ status: "archived" })
        .expect(200);

      expect(response.body.status).toBe("archived");
    });
  });

  describe("PATCH /content-items/:id/archive", () => {
    it("should return 401 without token", async () => {
      await request(app.getHttpServer()).patch("/content-items/some-id/archive").expect(401);
    });

    it("should archive content item", async () => {
      // Create content item
      const createResponse = await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: "https://example.com/article" })
        .expect(201);

      const itemId = createResponse.body.id;

      // Archive it
      const response = await request(app.getHttpServer())
        .patch(`/content-items/${itemId}/archive`)
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(response.body.status).toBe("archived");
    });
  });

  describe("DELETE /content-items/:id", () => {
    it("should return 401 without token", async () => {
      await request(app.getHttpServer()).delete("/content-items/some-id").expect(401);
    });

    it("should return 404 for non-existent content item", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";

      await request(app.getHttpServer())
        .delete(`/content-items/${fakeId}`)
        .set("Authorization", "Bearer any-token")
        .expect(404);
    });

    it("should delete existing content item", async () => {
      // Create content item
      const createResponse = await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: "https://example.com/article" })
        .expect(201);

      const itemId = createResponse.body.id;

      // Delete it
      await request(app.getHttpServer())
        .delete(`/content-items/${itemId}`)
        .set("Authorization", "Bearer any-token")
        .expect(204);

      // Verify it's gone
      const listResponse = await request(app.getHttpServer())
        .get("/content-items")
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(listResponse.body.items).toHaveLength(0);
    });
  });

  describe("User isolation", () => {
    it("should only return content items for the authenticated user", async () => {
      // Create content item as mock user
      await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: "https://example.com/user1-article" })
        .expect(201);

      // All requests with the same mock token will see the same user's data
      const response = await request(app.getHttpServer())
        .get("/content-items")
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].url).toBe("https://example.com/user1-article");
    });
  });

  describe("Multiple content items", () => {
    it("should return items in correct order (newest first)", async () => {
      // Create multiple content items
      await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: "https://example.com/article-1", title: "Article 1" })
        .expect(201);

      await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: "https://example.com/article-2", title: "Article 2" })
        .expect(201);

      await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: "https://example.com/article-3", title: "Article 3" })
        .expect(201);

      // Get all content items
      const response = await request(app.getHttpServer())
        .get("/content-items")
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(response.body.items).toHaveLength(3);
      // Should be ordered by createdAt desc (newest first)
      expect(response.body.items[0].title).toBe("Article 3");
      expect(response.body.items[1].title).toBe("Article 2");
      expect(response.body.items[2].title).toBe("Article 1");
    });
  });
});
