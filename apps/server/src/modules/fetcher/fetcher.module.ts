import { DrizzleModule } from "@/db";
import { Module } from "@nestjs/common";
import { BrowserPoolService } from "./browser-pool.service";
import { FetcherService } from "./fetcher.service";

@Module({
  imports: [DrizzleModule],
  providers: [FetcherService, BrowserPoolService],
  exports: [FetcherService, BrowserPoolService],
})
export class FetcherModule {}
