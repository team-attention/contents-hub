import { UseGuards, applyDecorators } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth } from "@nestjs/swagger";
import { appEnv, env } from "../../env";
import { MOCK_STRATEGY } from "../strategies/mock.strategy";
import { SUPABASE_STRATEGY } from "../strategies/supabase.strategy";

export function Auth() {
  const strategy =
    (appEnv.isDevelopment || appEnv.isTest) && env.MOCK_USER_ID ? MOCK_STRATEGY : SUPABASE_STRATEGY;

  return applyDecorators(ApiBearerAuth(), UseGuards(AuthGuard(strategy)));
}
