import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { DrizzleModule } from "./db";

@Module({
  imports: [DrizzleModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
