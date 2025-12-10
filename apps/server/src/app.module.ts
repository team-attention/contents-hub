import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { DrizzleModule } from "./db";
import { SubscriptionsModule } from "./subscriptions/subscriptions.module";

@Module({
  imports: [DrizzleModule, AuthModule, SubscriptionsModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
