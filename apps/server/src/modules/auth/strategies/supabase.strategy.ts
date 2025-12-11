import { env } from "@/env";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

export const SUPABASE_STRATEGY = "supabase";

interface JwtPayload {
  sub: string;
  email?: string;
  aud: string;
  role?: string;
  iat: number;
  exp: number;
}

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy, SUPABASE_STRATEGY) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: env.SUPABASE_JWT_SECRET,
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<{ id: string; email?: string }> {
    if (!payload.sub) {
      throw new UnauthorizedException("Invalid token");
    }

    return {
      id: payload.sub,
      email: payload.email,
    };
  }
}
