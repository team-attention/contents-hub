import type { INestApplication } from "@nestjs/common";
import * as supertestModule from "supertest";
import { AppModule } from "../../src/app.module";
import { env } from "../../src/env";
import type { TestDb } from "../utils/global";
import { cleanAndSetupTestData, createTestApp } from "../utils/helpers";

const request =
  "default" in supertestModule
    ? (supertestModule.default as typeof supertestModule)
    : supertestModule;

describe("Auth (e2e)", () => {
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

  describe("GET /auth/me", () => {
    it("should return 401 without token", async () => {
      await request(app.getHttpServer()).get("/auth/me").expect(401);
    });

    it("should return user with valid mock token", async () => {
      const response = await request(app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(response.body).toHaveProperty("id");
      expect(response.body.id).toBe(env.MOCK_USER_ID);
      expect(response.body).toHaveProperty("email");
    });
  });

  describe("GET /auth/me/id", () => {
    it("should return 401 without token", async () => {
      await request(app.getHttpServer()).get("/auth/me/id").expect(401);
    });

    it("should return userId with valid mock token", async () => {
      const response = await request(app.getHttpServer())
        .get("/auth/me/id")
        .set("Authorization", "Bearer any-token")
        .expect(200);

      expect(response.body).toHaveProperty("userId");
      expect(response.body.userId).toBe(env.MOCK_USER_ID);
    });
  });
});
