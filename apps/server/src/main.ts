import { mkdirSync, writeFileSync } from "node:fs";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { env } from "./env";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle("Contents Hub API")
    .setDescription("API documentation for Contents Hub")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Swagger UI (development only)
  if (env.APP_ENV === "development") {
    SwaggerModule.setup("docs", app, document);

    // Generate swagger.json for Orval
    mkdirSync("__generated__", { recursive: true });
    writeFileSync("__generated__/swagger.json", JSON.stringify(document, null, 2));
  }

  await app.listen(env.PORT);

  console.log(`Server is running on http://localhost:${env.PORT}`);
  if (env.APP_ENV === "development") {
    console.log(`Swagger docs: http://localhost:${env.PORT}/docs`);
  }
}

bootstrap();
