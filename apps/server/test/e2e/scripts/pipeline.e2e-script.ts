import * as fs from "node:fs";
import * as path from "node:path";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../../src/app.module";
import * as schema from "../../../src/db/schema";
import type { TestDb } from "../../utils/global";
import { cleanAndSetupTestData, createTestApp } from "../../utils/helpers";

const OUTPUT_FILE = path.resolve(__dirname, "../../../output.txt");

/**
 * Real API E2E Test - Pipeline Flow
 *
 * 이 테스트는 mock 없이 실제 API를 호출합니다:
 * - HTTP Fetcher: Wikipedia 페이지 크롤링
 * - YouTube Fetcher: YouTube 자막 추출
 * - Gemini API: 요약 및 다이제스트 생성
 *
 * 실행: pnpm test:e2e:real
 * 주의: GEMINI_API_KEY가 .env.test.local에 설정되어 있어야 합니다.
 */

// 테스트용 URL들 - 자막이 있는 짧은 영상과 짧은 Wikipedia 문서
const TEST_URLS = {
  // Wikipedia - 짧은 문서 (빠른 테스트용)
  wikipedia: "https://en.wikipedia.org/wiki/Hello_World",
  // YouTube - TED-Ed 짧은 영상 (자막 있음)
  youtube: "https://www.youtube.com/watch?v=YbgnlkJPga4",
};

describe("Pipeline E2E Real API Tests", () => {
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

  describe("Full Pipeline with Real APIs", () => {
    it("should process Wikipedia article through full pipeline", async () => {
      console.log("\n📄 Testing Wikipedia article fetch & digest...");

      // Step 1: Create content item with Wikipedia URL
      const createResponse = await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: TEST_URLS.wikipedia })
        .expect(201);

      expect(createResponse.body.status).toBe("pending");
      const itemId = createResponse.body.id;
      console.log(`  ✓ Created content item: ${itemId}`);

      // Step 2: Trigger full pipeline
      console.log("  ⏳ Running pipeline (fetch → summarize → digest)...");
      const triggerResponse = await request(app.getHttpServer())
        .post("/digests/trigger")
        .set("Authorization", "Bearer any-token")
        .expect(201);

      console.log(`  ✓ Fetched: ${triggerResponse.body.fetchedCount}`);
      console.log(`  ✓ Summarized: ${triggerResponse.body.summarizedCount}`);
      console.log(`  ✓ Digest created: ${triggerResponse.body.digest?.id}`);

      expect(triggerResponse.body.success).toBe(true);
      expect(triggerResponse.body.fetchedCount).toBe(1);
      expect(triggerResponse.body.summarizedCount).toBe(1);
      expect(triggerResponse.body.digest).toBeDefined();

      // Step 3: Verify content item
      const itemResponse = await request(app.getHttpServer())
        .get(`/content-items/${itemId}`)
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(itemResponse.body.status).toBe("done");
      expect(itemResponse.body.title).toBeDefined();
      expect(itemResponse.body.summary).toBeDefined();
      expect(itemResponse.body.fetchedContent).toBeDefined();
      console.log(`  ✓ Title: ${itemResponse.body.title}`);
      console.log(`  ✓ Summary length: ${itemResponse.body.summary?.length} chars`);

      // Step 4: Verify fetch history
      const fetchHistory = await db.select().from(schema.fetchHistory);
      expect(fetchHistory).toHaveLength(1);
      expect(fetchHistory[0].success).toBe(true);
      console.log("  ✓ Fetch history recorded");
    }, 120000); // 2분 타임아웃

    it("should process YouTube video through full pipeline", async () => {
      console.log("\n🎬 Testing YouTube transcript fetch & digest...");

      // Step 1: Create content item with YouTube URL
      const createResponse = await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: TEST_URLS.youtube })
        .expect(201);

      expect(createResponse.body.status).toBe("pending");
      const itemId = createResponse.body.id;
      console.log(`  ✓ Created content item: ${itemId}`);

      // Step 2: Trigger full pipeline
      console.log("  ⏳ Running pipeline (fetch → summarize → digest)...");
      const triggerResponse = await request(app.getHttpServer())
        .post("/digests/trigger")
        .set("Authorization", "Bearer any-token")
        .expect(201);

      console.log(`  ✓ Fetched: ${triggerResponse.body.fetchedCount}`);
      console.log(`  ✓ Summarized: ${triggerResponse.body.summarizedCount}`);
      console.log(`  ✓ Digest created: ${triggerResponse.body.digest?.id}`);

      expect(triggerResponse.body.success).toBe(true);
      expect(triggerResponse.body.fetchedCount).toBe(1);
      expect(triggerResponse.body.summarizedCount).toBe(1);

      // Step 3: Verify content item
      const itemResponse = await request(app.getHttpServer())
        .get(`/content-items/${itemId}`)
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(itemResponse.body.status).toBe("done");
      expect(itemResponse.body.fetchedContent).toBeDefined();
      expect(itemResponse.body.summary).toBeDefined();
      console.log(`  ✓ Title: ${itemResponse.body.title}`);
      console.log(`  ✓ Summary length: ${itemResponse.body.summary?.length} chars`);

      // Step 4: Verify fetch history
      const fetchHistory = await db.select().from(schema.fetchHistory);
      expect(fetchHistory).toHaveLength(1);
      expect(fetchHistory[0].success).toBe(true);
      console.log("  ✓ Fetch history recorded");
    }, 120000);

    it("should process mixed content (Wikipedia + YouTube) in single digest", async () => {
      console.log("\n🔀 Testing mixed content digest...");

      // Create Wikipedia item
      const wikiResponse = await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: TEST_URLS.wikipedia })
        .expect(201);
      console.log(`  ✓ Created Wikipedia item: ${wikiResponse.body.id}`);

      // Create YouTube item
      const ytResponse = await request(app.getHttpServer())
        .post("/content-items")
        .set("Authorization", "Bearer any-token")
        .send({ url: TEST_URLS.youtube })
        .expect(201);
      console.log(`  ✓ Created YouTube item: ${ytResponse.body.id}`);

      // Trigger full pipeline
      console.log("  ⏳ Running pipeline for both items...");
      const triggerResponse = await request(app.getHttpServer())
        .post("/digests/trigger")
        .set("Authorization", "Bearer any-token")
        .expect(201);

      expect(triggerResponse.body.success).toBe(true);
      expect(triggerResponse.body.fetchedCount).toBe(2);
      expect(triggerResponse.body.summarizedCount).toBe(2);
      expect(triggerResponse.body.digest.itemCount).toBe(2);

      console.log(`  ✓ Fetched: ${triggerResponse.body.fetchedCount}`);
      console.log(`  ✓ Summarized: ${triggerResponse.body.summarizedCount}`);
      console.log(`  ✓ Digest item count: ${triggerResponse.body.digest.itemCount}`);

      // Verify both items are done
      const itemsResponse = await request(app.getHttpServer())
        .get("/content-items")
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(itemsResponse.body.items).toHaveLength(2);
      for (const item of itemsResponse.body.items) {
        expect(item.status).toBe("done");
        expect(item.digestId).toBe(triggerResponse.body.digest.id);
      }

      // Verify fetch history has both items
      const fetchHistory = await db.select().from(schema.fetchHistory);
      expect(fetchHistory).toHaveLength(2);
      expect(fetchHistory.every((h) => h.success)).toBe(true);
      console.log("  ✓ Both items fetched successfully");

      // Verify digest content
      const digestResponse = await request(app.getHttpServer())
        .get(`/digests/${triggerResponse.body.digest.id}`)
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(digestResponse.body.content).toBeDefined();
      console.log(`  ✓ Digest content length: ${digestResponse.body.content?.length} chars`);

      // Save results to output.txt
      const wikiItem = await request(app.getHttpServer())
        .get(`/content-items/${wikiResponse.body.id}`)
        .set("Authorization", "Bearer any-token")
        .expect(200);

      const ytItem = await request(app.getHttpServer())
        .get(`/content-items/${ytResponse.body.id}`)
        .set("Authorization", "Bearer any-token")
        .expect(200);

      const output = `
================================================================================
E2E TEST OUTPUT - ${new Date().toISOString()}
================================================================================

## 1. Wikipedia Article
URL: ${TEST_URLS.wikipedia}
Title: ${wikiItem.body.title}

### Fetched Content (first 2000 chars):
${wikiItem.body.fetchedContent?.slice(0, 2000)}...

### Summary:
${wikiItem.body.summary}

================================================================================

## 2. YouTube Video
URL: ${TEST_URLS.youtube}
Title: ${ytItem.body.title}

### Fetched Content (Transcript, first 2000 chars):
${ytItem.body.fetchedContent?.slice(0, 2000)}...

### Summary:
${ytItem.body.summary}

================================================================================

## 3. Combined Digest
Title: ${digestResponse.body.title}
Item Count: ${digestResponse.body.itemCount}

### Digest Content:
${digestResponse.body.content}

================================================================================
`;

      fs.writeFileSync(OUTPUT_FILE, output, "utf-8");
      console.log(`  ✓ Results saved to ${OUTPUT_FILE}`);
    }, 180000); // 3분 타임아웃 (2개 처리)
  });
});
