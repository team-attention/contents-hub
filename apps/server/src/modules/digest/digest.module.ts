import { DrizzleModule } from "@/db";
import { OrchestratorModule } from "@/modules/orchestrator/orchestrator.module";
import { Module } from "@nestjs/common";
import { DigestController } from "./digest.controller";
import { DigestService } from "./digest.service";

@Module({
  imports: [DrizzleModule, OrchestratorModule],
  controllers: [DigestController],
  providers: [DigestService],
  exports: [DigestService],
})
export class DigestModule {}
