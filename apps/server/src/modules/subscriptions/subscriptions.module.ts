import { DrizzleModule } from "@/db/drizzle.module";
import { Module } from "@nestjs/common";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";

@Module({
  imports: [DrizzleModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
