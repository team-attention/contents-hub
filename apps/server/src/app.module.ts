import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { DrizzleModule } from "./db";

@Module({
  imports: [DrizzleModule, AuthModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
