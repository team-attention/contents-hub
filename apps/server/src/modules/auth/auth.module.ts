import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { MockStrategy } from "./strategies/mock.strategy";
import { SupabaseStrategy } from "./strategies/supabase.strategy";

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [SupabaseStrategy, MockStrategy],
  exports: [SupabaseStrategy, MockStrategy],
})
export class AuthModule {}
