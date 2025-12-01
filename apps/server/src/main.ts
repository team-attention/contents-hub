import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { env } from "./env";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  await app.listen(env.PORT);

  console.log(`Server is running on http://localhost:${env.PORT}`);
}

bootstrap();
