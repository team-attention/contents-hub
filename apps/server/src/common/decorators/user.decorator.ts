import { type ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { Request } from "express";

export interface AuthUser {
  id: string;
  email?: string;
}

export const User = createParamDecorator((_: undefined, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return request.user as AuthUser;
});

export const UserId = createParamDecorator((_: undefined, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request>();
  return (request.user as AuthUser)?.id;
});
