import type { INestApplication } from "@nestjs/common";
import { eq } from "drizzle-orm";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import * as schema from "../../src/db/schema";
import { ListDiffService } from "../../src/modules/subscriptions/list-diff";
import { SubscriptionsService } from "../../src/modules/subscriptions/subscriptions.service";
import {
  INITIAL_HTML_URLS,
  MULTIPLE_NEW_URLS,
  SAMPLE_SELECTOR_HIERARCHY,
  UPDATED_HTML_URLS,
  createFailedListDiffResult,
  createListDiffResult,
} from "../mocks/list-diff.mock";
import type { TestDb } from "../utils/global";
import { cleanAndSetupTestData, createTestApp } from "../utils/helpers";

describe("Subscription Watch (List-Diff) E2E", () => {
  let app: INestApplication;
  let db: TestDb;
  let listDiffService: ListDiffService;

  beforeAll(async () => {
    ({ app, db } = await createTestApp(AppModule));
    listDiffService = app.get(ListDiffService);
  });

  afterEach(async () => {
    await cleanAndSetupTestData(db);
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /subscriptions/watch", () => {
    it("should create subscription and extract URLs from selector", async () => {
      // Mock: successful fetch with 3 URLs
      jest
        .spyOn(listDiffService, "fetch")
        .mockResolvedValue(createListDiffResult(INITIAL_HTML_URLS));

      const response = await request(app.getHttpServer())
        .post("/subscriptions/watch")
        .set("Authorization", "Bearer any-token")
        .send({
          url: "https://example.com/posts",
          name: "Example Blog",
          selector: "section.posts",
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.urlCount).toBe(3);
      expect(response.body.subscriptionId).toBeDefined();

      // Verify subscription was created in DB
      const [subscription] = await db
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.id, response.body.subscriptionId));

      expect(subscription).toBeDefined();
      expect(subscription.url).toBe("https://example.com/posts");
      expect(subscription.initialSelector).toBe("section.posts");
      expect(subscription.status).toBe("active");

      // Verify subscription_history was created
      const [history] = await db
        .select()
        .from(schema.subscriptionHistory)
        .where(eq(schema.subscriptionHistory.subscriptionId, response.body.subscriptionId));

      expect(history).toBeDefined();
      expect(history.urls).toEqual(INITIAL_HTML_URLS);
      expect(history.hasChanged).toBe(false);
    });

    it("should return error when selector not found", async () => {
      jest
        .spyOn(listDiffService, "fetch")
        .mockResolvedValue(createFailedListDiffResult("Selector not found: .nonexistent"));

      const response = await request(app.getHttpServer())
        .post("/subscriptions/watch")
        .set("Authorization", "Bearer any-token")
        .send({
          url: "https://example.com/posts",
          name: "Example Blog",
          selector: ".nonexistent",
        })
        .expect(201); // Still 201 but success: false

      expect(response.body.success).toBe(false);
      expect(response.body.urlCount).toBe(0);
      expect(response.body.error).toContain("Selector not found");

      // No subscription should be created
      const subscriptions = await db.select().from(schema.subscriptions);
      expect(subscriptions).toHaveLength(0);
    });

    it("should return error when no URLs in container", async () => {
      jest
        .spyOn(listDiffService, "fetch")
        .mockResolvedValue(createFailedListDiffResult("No URLs found in the selected container"));

      const response = await request(app.getHttpServer())
        .post("/subscriptions/watch")
        .set("Authorization", "Bearer any-token")
        .send({
          url: "https://example.com/posts",
          name: "Empty Blog",
          selector: "section.empty",
        })
        .expect(201);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("No URLs found");
    });

    it("should return 401 without token", async () => {
      await request(app.getHttpServer())
        .post("/subscriptions/watch")
        .send({
          url: "https://example.com/posts",
          name: "Test",
          selector: "section.posts",
        })
        .expect(401);
    });
  });

  describe("checkSubscription()", () => {
    it("should detect new URLs and create content_items", async () => {
      // Setup: create subscription with initial URLs
      jest
        .spyOn(listDiffService, "fetch")
        .mockResolvedValue(createListDiffResult(INITIAL_HTML_URLS));

      const createResponse = await request(app.getHttpServer())
        .post("/subscriptions/watch")
        .set("Authorization", "Bearer any-token")
        .send({
          url: "https://example.com/posts",
          name: "Example Blog",
          selector: "section.posts",
        })
        .expect(201);

      const subscriptionId = createResponse.body.subscriptionId;

      // Mock: URL lookup succeeds and returns updated URLs (no duplicate fetch needed)
      jest.spyOn(listDiffService, "lookupUrlsInPage").mockResolvedValue({
        found: true,
        foundUrls: INITIAL_HTML_URLS.slice(0, 2),
        containerSelector: "section.posts",
        containerUrls: UPDATED_HTML_URLS,
        selectorHierarchy: SAMPLE_SELECTOR_HIERARCHY,
      });

      // Get service and call checkSubscription directly
      const subscriptionsService = app.get(SubscriptionsService);
      const result = await subscriptionsService.checkSubscription(subscriptionId);

      expect(result.success).toBe(true);
      expect(result.newUrls).toHaveLength(1);
      expect(result.newUrls).toContain("https://example.com/post/4");
      expect(result.totalUrls).toBe(4);

      // Verify content_item was created for new URL
      const contentItems = await db.select().from(schema.contentItems);
      expect(contentItems).toHaveLength(1);
      expect(contentItems[0].url).toBe("https://example.com/post/4");
      expect(contentItems[0].source).toBe("subscription");
      expect(contentItems[0].subscriptionId).toBe(subscriptionId);
      expect(contentItems[0].status).toBe("pending");

      // Verify new subscription_history was created
      const histories = await db
        .select()
        .from(schema.subscriptionHistory)
        .where(eq(schema.subscriptionHistory.subscriptionId, subscriptionId));

      expect(histories).toHaveLength(2); // Initial + check
      const latestHistory = histories.find((h) => h.hasChanged === true);
      expect(latestHistory).toBeDefined();
      expect(latestHistory?.urls).toEqual(UPDATED_HTML_URLS);
    });

    it("should detect multiple new URLs", async () => {
      // Setup: create subscription
      jest
        .spyOn(listDiffService, "fetch")
        .mockResolvedValue(createListDiffResult(INITIAL_HTML_URLS));

      const createResponse = await request(app.getHttpServer())
        .post("/subscriptions/watch")
        .set("Authorization", "Bearer any-token")
        .send({
          url: "https://example.com/posts",
          name: "Active Blog",
          selector: "section.posts",
        })
        .expect(201);

      const subscriptionId = createResponse.body.subscriptionId;

      // Mock: URL lookup returns container with multiple new URLs
      jest.spyOn(listDiffService, "lookupUrlsInPage").mockResolvedValue({
        found: true,
        foundUrls: ["https://example.com/post/3", "https://example.com/post/2"],
        containerSelector: "section.posts",
        containerUrls: MULTIPLE_NEW_URLS,
        selectorHierarchy: SAMPLE_SELECTOR_HIERARCHY,
      });

      const subscriptionsService = app.get(SubscriptionsService);
      const result = await subscriptionsService.checkSubscription(subscriptionId);

      expect(result.success).toBe(true);
      expect(result.newUrls).toHaveLength(3); // post/4, post/5, post/6
      expect(result.newUrls).toContain("https://example.com/post/6");
      expect(result.newUrls).toContain("https://example.com/post/5");
      expect(result.newUrls).toContain("https://example.com/post/4");

      // 3 content_items created
      const contentItems = await db.select().from(schema.contentItems);
      expect(contentItems).toHaveLength(3);
    });

    it("should not create items when no changes", async () => {
      // Setup
      jest
        .spyOn(listDiffService, "fetch")
        .mockResolvedValue(createListDiffResult(INITIAL_HTML_URLS));

      const createResponse = await request(app.getHttpServer())
        .post("/subscriptions/watch")
        .set("Authorization", "Bearer any-token")
        .send({
          url: "https://example.com/posts",
          name: "Static Blog",
          selector: "section.posts",
        })
        .expect(201);

      const subscriptionId = createResponse.body.subscriptionId;

      // Mock: same URLs (no change)
      jest.spyOn(listDiffService, "lookupUrlsInPage").mockResolvedValue({
        found: true,
        foundUrls: INITIAL_HTML_URLS.slice(0, 2),
        containerSelector: "section.posts",
        containerUrls: INITIAL_HTML_URLS,
        selectorHierarchy: SAMPLE_SELECTOR_HIERARCHY,
      });

      const subscriptionsService = app.get(SubscriptionsService);
      const result = await subscriptionsService.checkSubscription(subscriptionId);

      expect(result.success).toBe(true);
      expect(result.newUrls).toHaveLength(0);
      expect(result.totalUrls).toBe(3);

      // No content_items created
      const contentItems = await db.select().from(schema.contentItems);
      expect(contentItems).toHaveLength(0);

      // History created with hasChanged: false
      const histories = await db
        .select()
        .from(schema.subscriptionHistory)
        .where(eq(schema.subscriptionHistory.subscriptionId, subscriptionId));

      expect(histories).toHaveLength(2);
      const latestHistory = histories[1];
      expect(latestHistory.hasChanged).toBe(false);
    });

    it("should mark subscription as broken when all strategies fail", async () => {
      // Setup
      jest
        .spyOn(listDiffService, "fetch")
        .mockResolvedValue(createListDiffResult(INITIAL_HTML_URLS));

      const createResponse = await request(app.getHttpServer())
        .post("/subscriptions/watch")
        .set("Authorization", "Bearer any-token")
        .send({
          url: "https://example.com/posts",
          name: "Broken Blog",
          selector: "section.posts",
        })
        .expect(201);

      const subscriptionId = createResponse.body.subscriptionId;

      // Mock: all strategies fail
      jest.spyOn(listDiffService, "lookupUrlsInPage").mockResolvedValue({
        found: false,
        foundUrls: [],
      });
      jest
        .spyOn(listDiffService, "fetch")
        .mockResolvedValue(createFailedListDiffResult("Selector not found"));

      const subscriptionsService = app.get(SubscriptionsService);
      const result = await subscriptionsService.checkSubscription(subscriptionId);

      expect(result.success).toBe(false);
      expect(result.broken).toBe(true);
      expect(result.error).toContain("Could not find content container");

      // Subscription should be marked as broken
      const [subscription] = await db
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.id, subscriptionId));

      expect(subscription.status).toBe("broken");
      expect(subscription.errorMessage).toContain("Could not find content container");
    });

    it("should not check paused subscription", async () => {
      // Setup
      jest
        .spyOn(listDiffService, "fetch")
        .mockResolvedValue(createListDiffResult(INITIAL_HTML_URLS));

      const createResponse = await request(app.getHttpServer())
        .post("/subscriptions/watch")
        .set("Authorization", "Bearer any-token")
        .send({
          url: "https://example.com/posts",
          name: "Paused Blog",
          selector: "section.posts",
        })
        .expect(201);

      const subscriptionId = createResponse.body.subscriptionId;

      // Manually pause the subscription
      await db
        .update(schema.subscriptions)
        .set({ status: "paused" })
        .where(eq(schema.subscriptions.id, subscriptionId));

      const subscriptionsService = app.get(SubscriptionsService);
      const result = await subscriptionsService.checkSubscription(subscriptionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Subscription is paused");
    });

    it("should use stable selectors as fallback", async () => {
      // Setup with stableSelectors in history
      jest.spyOn(listDiffService, "fetch").mockResolvedValue(
        createListDiffResult(INITIAL_HTML_URLS, {
          selectorHierarchy: SAMPLE_SELECTOR_HIERARCHY,
        }),
      );

      const createResponse = await request(app.getHttpServer())
        .post("/subscriptions/watch")
        .set("Authorization", "Bearer any-token")
        .send({
          url: "https://example.com/posts",
          name: "Fallback Blog",
          selector: "section.posts",
        })
        .expect(201);

      const subscriptionId = createResponse.body.subscriptionId;

      // Add stableSelectors to history manually
      await db
        .update(schema.subscriptionHistory)
        .set({ stableSelectors: ["article.post-item", "section.posts"] })
        .where(eq(schema.subscriptionHistory.subscriptionId, subscriptionId));

      // Mock: URL lookup fails, but stable selector works
      jest.spyOn(listDiffService, "lookupUrlsInPage").mockResolvedValue({
        found: false,
        foundUrls: [],
      });

      // First call (stable selector) succeeds, returns updated URLs
      jest
        .spyOn(listDiffService, "fetch")
        .mockResolvedValueOnce(createListDiffResult(UPDATED_HTML_URLS)); // stable selector

      const subscriptionsService = app.get(SubscriptionsService);
      const result = await subscriptionsService.checkSubscription(subscriptionId);

      expect(result.success).toBe(true);
      expect(result.newUrls).toHaveLength(1);
      expect(result.newUrls).toContain("https://example.com/post/4");
    });
  });
});
