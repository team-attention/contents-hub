import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { DrizzleModule } from "./db";
import { AuthModule } from "./modules/auth/auth.module";
import { ContentItemsModule } from "./modules/content-items/content-items.module";
import { DigestModule } from "./modules/digest/digest.module";
import { DigesterModule } from "./modules/digester/digester.module";
import { FetcherModule } from "./modules/fetcher/fetcher.module";
import { OrchestratorModule } from "./modules/orchestrator/orchestrator.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";

@Module({
  imports: [
    DrizzleModule,
    AuthModule,
    SubscriptionsModule,
    ContentItemsModule,
    FetcherModule,
    DigesterModule,
    OrchestratorModule,
    DigestModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
