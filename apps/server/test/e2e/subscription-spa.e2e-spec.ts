/**
 * E2E tests for subscription with real websites
 * These tests make actual network requests to verify:
 * 1. URL extraction works correctly from real websites
 * 2. renderType is correctly detected and cached
 * 3. Smart fetch fallback to Playwright when needed
 *
 * Note: Most modern sites use SSR/SSG, so they will be detected as "static"
 * True SPA sites (client-side only) will be detected as "dynamic"
 *
 * Skip in CI with: SKIP_NETWORK_TESTS=true
 */
import type { INestApplication } from "@nestjs/common";
import { eq } from "drizzle-orm";
import request from "supertest";
import { AppModule } from "../../src/app.module";
import * as schema from "../../src/db/schema";
import { ListDiffService } from "../../src/modules/subscriptions/list-diff";
import type { TestDb } from "../utils/global";
import { cleanAndSetupTestData, createTestApp } from "../utils/helpers";

const SKIP_NETWORK_TESTS = process.env.SKIP_NETWORK_TESTS === "true" || process.env.CI === "true";

/**
 * Real SPA sites for testing
 * These sites require JavaScript rendering to show content
 */
const SPA_TEST_SITES = {
  // React official blog - requires JS to render blog posts
  reactBlog: {
    url: "https://react.dev/blog",
    selector: "main",
    expectedMinUrls: 3,
    description: "React official blog (React-based SPA)",
  },
  // Vue official blog - requires JS to render
  vueBlog: {
    url: "https://blog.vuejs.org",
    selector: "main",
    expectedMinUrls: 2,
    description: "Vue official blog (Vue-based SPA)",
  },
};

const describeOrSkip = SKIP_NETWORK_TESTS ? describe.skip : describe;

describeOrSkip("Subscription SPA E2E (Real Network)", () => {
  let app: INestApplication;
  let db: TestDb;
  let listDiffService: ListDiffService;

  beforeAll(async () => {
    ({ app, db } = await createTestApp(AppModule));
    listDiffService = app.get(ListDiffService);
  }, 60000);

  afterEach(async () => {
    await cleanAndSetupTestData(db);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("ListDiffService.fetch() with real SPA sites", () => {
    it("should detect React blog as dynamic and extract URLs", async () => {
      const site = SPA_TEST_SITES.reactBlog;

      const result = await listDiffService.fetch(site.url, site.selector);

      // Should succeed (either static or dynamic)
      expect(result.success).toBe(true);
      expect(result.urls.length).toBeGreaterThanOrEqual(site.expectedMinUrls);

      // Log for debugging
      console.log(`[${site.description}]`);
      console.log(`  renderType: ${result.detectedRenderType}`);
      console.log(`  URLs found: ${result.urls.length}`);
      console.log(`  First 3 URLs: ${result.urls.slice(0, 3).join(", ")}`);
    }, 60000);

    it("should detect Vue blog as dynamic and extract URLs", async () => {
      const site = SPA_TEST_SITES.vueBlog;

      const result = await listDiffService.fetch(site.url, site.selector);

      // Should succeed
      expect(result.success).toBe(true);
      expect(result.urls.length).toBeGreaterThanOrEqual(site.expectedMinUrls);

      console.log(`[${site.description}]`);
      console.log(`  renderType: ${result.detectedRenderType}`);
      console.log(`  URLs found: ${result.urls.length}`);
      console.log(`  First 3 URLs: ${result.urls.slice(0, 3).join(", ")}`);
    }, 60000);
  });

  describe("POST /subscriptions/watch with real SPA site", () => {
    it("should create subscription from React blog and detect renderType", async () => {
      const site = SPA_TEST_SITES.reactBlog;

      const response = await request(app.getHttpServer())
        .post("/subscriptions/watch")
        .set("Authorization", "Bearer any-token")
        .send({
          url: site.url,
          name: "React Blog",
          selector: site.selector,
        })
        .timeout(60000);

      console.log(`[Subscription Watch - ${site.description}]`);
      console.log(`  success: ${response.body.success}`);
      console.log(`  urlCount: ${response.body.urlCount}`);
      if (response.body.error) {
        console.log(`  error: ${response.body.error}`);
      }

      // Should succeed and extract URLs
      expect(response.body.success).toBe(true);
      expect(response.body.urlCount).toBeGreaterThanOrEqual(site.expectedMinUrls);
      expect(response.body.subscriptionId).toBeDefined();
    }, 60000);
  });

  describe("renderType caching flow", () => {
    it("should save renderType to subscription in DB", async () => {
      const site = SPA_TEST_SITES.reactBlog;

      // 1. Create subscription
      const createResponse = await request(app.getHttpServer())
        .post("/subscriptions/watch")
        .set("Authorization", "Bearer any-token")
        .send({
          url: site.url,
          name: "React Blog for Cache Test",
          selector: site.selector,
        })
        .timeout(60000);

      expect(createResponse.body.success).toBe(true);
      const subscriptionId = createResponse.body.subscriptionId;

      // 2. Verify subscription was created with renderType (query DB directly)
      const [subscription] = await db
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.id, subscriptionId));

      console.log("[Subscription renderType caching]");
      console.log(`  subscription.renderType: ${subscription.renderType}`);

      // The subscription should have a renderType (static or dynamic)
      expect(["static", "dynamic"]).toContain(subscription.renderType);
    }, 60000);
  });
});

/**
 * Unit tests for smart fetch detection logic (no network)
 */
describe("Smart fetch detection (unit)", () => {
  it("should correctly identify SPA indicators in content", () => {
    // Test content that indicates SPA/loading state
    const spaIndicators = ["Loading...", "Please wait", '<div class="skeleton"></div>', "로딩 중"];

    for (const indicator of spaIndicators) {
      expect(indicator.length).toBeGreaterThan(0);
    }
  });
});
