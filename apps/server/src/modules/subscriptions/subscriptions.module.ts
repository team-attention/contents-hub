import { DrizzleModule } from "@/db/drizzle.module";
import { AiModule } from "@/modules/ai/ai.module";
import { FetcherModule } from "@/modules/fetcher/fetcher.module";
import { Module } from "@nestjs/common";
import { ListDiffService } from "./list-diff";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";

@Module({
  imports: [DrizzleModule, AiModule, FetcherModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, ListDiffService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
