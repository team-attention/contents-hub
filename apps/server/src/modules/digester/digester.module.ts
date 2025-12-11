import { DrizzleModule } from "@/db";
import { Module } from "@nestjs/common";
import { DigesterService } from "./digester.service";

@Module({
  imports: [DrizzleModule],
  providers: [DigesterService],
  exports: [DigesterService],
})
export class DigesterModule {}
