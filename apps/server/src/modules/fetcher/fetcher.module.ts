import { DrizzleModule } from "@/db";
import { Module } from "@nestjs/common";
import { FetcherService } from "./fetcher.service";

@Module({
  imports: [DrizzleModule],
  providers: [FetcherService],
  exports: [FetcherService],
})
export class FetcherModule {}
