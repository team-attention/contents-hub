import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-http-bearer";
import { env } from "../../env";

export const MOCK_STRATEGY = "mock";

@Injectable()
export class MockStrategy extends PassportStrategy(Strategy, MOCK_STRATEGY) {
  async validate(_token: string): Promise<{ id: string; email: string }> {
    return {
      id: env.MOCK_USER_ID ?? "mock-user-id",
      email: "mock@example.com",
    };
  }
}
