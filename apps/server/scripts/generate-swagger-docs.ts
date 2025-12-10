// Set dummy env vars for swagger generation (no actual DB connection needed)
process.env.APP_ENV ??= "development";
process.env.DATABASE_URL ??= "postgresql://dummy:dummy@localhost:5432/dummy";
process.env.SUPABASE_URL ??= "http://localhost:54321";
process.env.SUPABASE_ANON_KEY ??= "dummy";
process.env.SUPABASE_JWT_SECRET ??= "dummy";
process.env.ANTHROPIC_API_KEY ??= "dummy";

import { mkdirSync, writeFileSync } from "node:fs";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "../src/app.module";

async function generateSwaggerDocs() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle("Contents Hub API")
    .setDescription("API documentation for Contents Hub")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  mkdirSync("__generated__", { recursive: true });
  writeFileSync("__generated__/swagger.json", JSON.stringify(document, null, 2));

  console.log("Swagger docs generated at __generated__/swagger.json");

  await app.close();
  process.exit(0);
}

generateSwaggerDocs();
