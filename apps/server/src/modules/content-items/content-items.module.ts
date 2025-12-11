import { DrizzleModule } from "@/db";
import { Module } from "@nestjs/common";
import { ContentItemsController } from "./content-items.controller";
import { ContentItemsService } from "./content-items.service";

@Module({
  imports: [DrizzleModule],
  controllers: [ContentItemsController],
  providers: [ContentItemsService],
  exports: [ContentItemsService],
})
export class ContentItemsModule {}
