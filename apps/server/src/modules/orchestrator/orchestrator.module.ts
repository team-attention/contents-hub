import { ContentItemsModule } from "@/modules/content-items/content-items.module";
import { DigesterModule } from "@/modules/digester/digester.module";
import { FetcherModule } from "@/modules/fetcher/fetcher.module";
import { Module } from "@nestjs/common";
import { OrchestratorService } from "./orchestrator.service";

@Module({
  imports: [ContentItemsModule, FetcherModule, DigesterModule],
  providers: [OrchestratorService],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
