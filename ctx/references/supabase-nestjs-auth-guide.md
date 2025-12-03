# Supabase Authentication in NestJS

A comprehensive guide for integrating Supabase Auth with NestJS using Passport.js.

## Overview

This guide covers how to set up Supabase as an authentication provider in a NestJS application. Supabase handles user authentication (signup, login, JWT tokens), while NestJS manages authorization and business logic.

### What This Guide Covers

- Supabase Passport strategy setup
- JWT token verification
- Custom auth decorators
- Role-based authorization guards
- Mock authentication for development/testing

---

## Prerequisites

### Dependencies

```bash
pnpm add @supabase/supabase-js nestjs-supabase-auth passport-jwt @nestjs/passport
pnpm add -D @types/passport-jwt
```

### Environment Variables

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-public-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Optional: For development/testing
MOCK_USER_ID=test-user-uuid
```

---

## Project Structure

```
src/
├── auth/
│   ├── strategies/
│   │   ├── supabase.strategy.ts    # Supabase Passport strategy
│   │   └── mock.strategy.ts        # Mock strategy for dev/test
│   ├── guards/
│   │   ├── role.guard.ts           # Role-based authorization
│   │   └── admin.guard.ts          # Admin-only access
│   ├── decorators/
│   │   ├── auth.decorator.ts       # @Auth() decorator
│   │   └── roles.decorator.ts      # @Roles() decorator
│   └── enums/
│       └── role.enum.ts            # Role definitions
├── common/
│   ├── decorators/
│   │   └── user.decorator.ts       # @User(), @UserId() decorators
│   └── config/
│       └── env.ts                  # Environment validation
└── app.module.ts
```

---

## Step 1: Environment Configuration

Create a validated environment configuration using Zod:

```typescript
// src/common/config/env.ts
import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_KEY: z.string(),
  SUPABASE_JWT_SECRET: z.string(),
  MOCK_USER_ID: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = envSchema.parse(process.env);

export const appEnv = {
  isDevelopment: env.NODE_ENV === "development",
  isTest: env.NODE_ENV === "test",
  isProduction: env.NODE_ENV === "production",
};
```

---

## Step 2: Supabase Passport Strategy

The core authentication strategy that verifies JWT tokens with Supabase:

```typescript
// src/auth/strategies/supabase.strategy.ts
import { env } from "@/common/config/env";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { createClient } from "@supabase/supabase-js";
import type { Request } from "express";
import { SupabaseAuthStrategy } from "nestjs-supabase-auth";
import { ExtractJwt } from "passport-jwt";

export const SUPABASE_STRATEGY = "supabase";
@Injectable()
export class SupabaseStrategy extends PassportStrategy(SupabaseAuthStrategy, SUPABASE_STRATEGY) {
  private supabaseClient: ReturnType<typeof createClient>;

  public constructor() {
    super({
      supabaseUrl: env.SUPABASE_URL,
      supabaseKey: env.SUPABASE_KEY,
      supabaseOptions: {},
      supabaseJwtSecret: env.SUPABASE_JWT_SECRET,
      extractor: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });

    this.supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
  }

  // TO FIX https://github.com/hiro1107/nestjs-supabase-auth/issues/7
  async authenticate(req: Request): Promise<void> {
    const extractor = ExtractJwt.fromAuthHeaderAsBearerToken();
    const token = extractor(req);

    if (!token) {
      return this.fail("No auth token provided", 401);
    }

    try {
      const {
        data: { user },
        error,
      } = await this.supabaseClient.auth.getUser(token);

      if (error || !user) {
        return this.fail("Invalid token", 401);
      }

      return this.success(user, null);
    } catch (error) {
      return this.fail("Authentication failed", 401);
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  async validate(payload: any): Promise<any> {
    const user = await super.validate(payload);
    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}

```

### Key Points

- **Token Extraction**: Uses `ExtractJwt.fromAuthHeaderAsBearerToken()` to get JWT from `Authorization: Bearer <token>` header
- **Token Verification**: Calls `supabaseClient.auth.getUser(token)` - Supabase validates the token server-side
- **User Object**: Returns the full Supabase user object on success

---

## Step 3: Mock Strategy for Development

Create a mock strategy that bypasses Supabase for local development:

```typescript
// src/auth/strategies/mock.strategy.ts
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-http-bearer";
import { env } from "@/common/config/env";

export const MOCK_STRATEGY = "mock";

@Injectable()
export class MockStrategy extends PassportStrategy(Strategy, MOCK_STRATEGY) {
  async validate(payload: any): Promise<any> {
    // Return a mock user with the configured user ID
    return {
      id: env.MOCK_USER_ID,
      email: "mock@example.com",
      // Add any other user properties your app needs
    };
  }
}
```

---

## Step 4: User Decorators

Create parameter decorators to extract user information in controllers:

```typescript
// src/common/decorators/user.decorator.ts
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { SupabaseAuthUser } from "nestjs-supabase-auth";

// Extend the Supabase user type with your app's custom fields
export type User = SupabaseAuthUser & {
  workspaceId?: string;
  role?: string;
};

// Get the full user object
export const User = createParamDecorator(
  (_: undefined, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as User;
  }
);

// Get just the user ID
export const UserId = createParamDecorator(
  (_: undefined, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request.user as User)?.id!;
  }
);
```

---

## Step 5: Auth Decorator

Create a unified auth decorator that handles strategy selection:

```typescript
// src/auth/decorators/auth.decorator.ts
import { applyDecorators, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth } from "@nestjs/swagger";
import { appEnv, env } from "@/common/config/env";
import { SUPABASE_STRATEGY } from "../strategies/supabase.strategy";
import { MOCK_STRATEGY } from "../strategies/mock.strategy";
import { RoleGuard } from "../guards/role.guard";
import { Roles } from "./roles.decorator";
import type { RoleEnum } from "../enums/role.enum";

export function Auth(role?: RoleEnum) {
  // Use mock strategy in dev/test when MOCK_USER_ID is set
  const strategy =
    (appEnv.isDevelopment || appEnv.isTest) && env.MOCK_USER_ID
      ? MOCK_STRATEGY
      : SUPABASE_STRATEGY;

  const decorators: Array<ClassDecorator | MethodDecorator | PropertyDecorator> = [
    ApiBearerAuth(),
    UseGuards(AuthGuard(strategy)),
  ];

  // Add role-based guard if role is specified
  if (role) {
    decorators.push(Roles(role), UseGuards(RoleGuard));
  }

  return applyDecorators(...decorators);
}
```

---

## Step 6: Role-Based Authorization

### Role Enum

```typescript
// src/auth/enums/role.enum.ts
export enum RoleEnum {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
}

// Define role hierarchy (lower number = higher privilege)
const roleOrder = {
  [RoleEnum.OWNER]: 1,
  [RoleEnum.ADMIN]: 2,
  [RoleEnum.MEMBER]: 3,
};

// Check if user has required role or higher
export const hasRole = (requiredRole: RoleEnum, userRole: RoleEnum): boolean => {
  return roleOrder[requiredRole] >= roleOrder[userRole];
};
```

### Roles Decorator

```typescript
// src/auth/decorators/roles.decorator.ts
import { SetMetadata } from "@nestjs/common";
import type { RoleEnum } from "../enums/role.enum";

export const ROLES_KEY = "role";
export const Roles = (role: RoleEnum) => SetMetadata(ROLES_KEY, role);
```

### Role Guard

```typescript
// src/auth/guards/role.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { RoleEnum, hasRole } from "../enums/role.enum";

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    // Inject your database connection if checking roles from DB
    // @Inject(DB_CONNECTION) private readonly db: DbConnection,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.getAllAndOverride<RoleEnum>(ROLES_KEY, [
      context.getClass(),
      context.getHandler(),
    ]);

    if (!requiredRole) {
      return false;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;
    const resourceId = request.params.workspaceId; // Or whatever resource

    if (!resourceId) {
      throw new BadRequestException("Resource ID is required");
    }

    // Fetch user's role from database
    // const membership = await this.db.query.members.findFirst({
    //   where: (m, { eq, and }) => and(eq(m.userId, user.id), eq(m.resourceId, resourceId)),
    // });

    // if (!membership) {
    //   throw new ForbiddenException("Access denied");
    // }

    // Example: Assuming role is already on user object
    const userRole = user.role as RoleEnum;

    // Inject role info into user for downstream use
    request.user.workspaceId = resourceId;
    request.user.role = userRole;

    return hasRole(requiredRole, userRole);
  }
}
```

---

## Step 7: Admin Domain Guard

Restrict access to specific email domains (useful for internal admin panels):

```typescript
// src/auth/guards/admin.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { SUPABASE_STRATEGY } from "../strategies/supabase.strategy";

const ALLOWED_DOMAINS = ["@yourcompany.com", "@admin.yourcompany.com"];

@Injectable()
export class AdminGuard extends AuthGuard(SUPABASE_STRATEGY) {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First, run standard auth
    const result = await super.canActivate(context);
    if (!result) {
      return false;
    }

    // Check email domain
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.email) {
      throw new UnauthorizedException("No email found in user profile");
    }

    const emailDomain = user.email.substring(user.email.lastIndexOf("@"));
    const isAllowed = ALLOWED_DOMAINS.includes(emailDomain);

    if (!isAllowed) {
      throw new UnauthorizedException(
        `Access denied. Only ${ALLOWED_DOMAINS.join(", ")} domains are allowed.`
      );
    }

    return true;
  }
}
```

### Admin Decorator

```typescript
// src/auth/decorators/admin.decorator.ts
import { applyDecorators, UseGuards } from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { AdminGuard } from "../guards/admin.guard";

export function AdminAuth() {
  return applyDecorators(ApiBearerAuth(), UseGuards(AdminGuard));
}
```

---

## Step 8: Module Setup

Register all strategies in a module:

```typescript
// src/auth/auth.module.ts
import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { SupabaseStrategy } from "./strategies/supabase.strategy";
import { MockStrategy } from "./strategies/mock.strategy";

@Module({
  imports: [PassportModule],
  providers: [SupabaseStrategy, MockStrategy],
  exports: [SupabaseStrategy, MockStrategy],
})
export class AuthModule {}
```

Import in your app module:

```typescript
// src/app.module.ts
import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [AuthModule],
})
export class AppModule {}
```

---

## Usage Examples

### Basic Protected Endpoint

```typescript
import { Controller, Get, Delete } from "@nestjs/common";
import { Auth } from "@/auth/decorators/auth.decorator";
import { User, UserId } from "@/common/decorators/user.decorator";

@Controller("users")
export class UserController {
  @Auth()
  @Get("me")
  getProfile(@User() user: User) {
    return { id: user.id, email: user.email };
  }

  @Auth()
  @Delete()
  deleteAccount(@UserId() userId: string) {
    return this.userService.delete(userId);
  }
}
```

### Role-Protected Endpoint

```typescript
import { Controller, Put, Param, Body } from "@nestjs/common";
import { Auth } from "@/auth/decorators/auth.decorator";
import { RoleEnum } from "@/auth/enums/role.enum";

@Controller("workspaces")
export class WorkspaceController {
  @Auth(RoleEnum.ADMIN) // Requires ADMIN or OWNER role
  @Put(":workspaceId")
  updateWorkspace(
    @Param("workspaceId") workspaceId: string,
    @Body() data: UpdateWorkspaceDto
  ) {
    return this.workspaceService.update(workspaceId, data);
  }

  @Auth(RoleEnum.OWNER) // Only OWNER can delete
  @Delete(":workspaceId")
  deleteWorkspace(@Param("workspaceId") workspaceId: string) {
    return this.workspaceService.delete(workspaceId);
  }
}
```

### Admin-Only Endpoint

```typescript
import { Controller, Get } from "@nestjs/common";
import { AdminAuth } from "@/auth/decorators/admin.decorator";

@Controller("admin")
export class AdminController {
  @AdminAuth()
  @Get("users")
  getAllUsers() {
    return this.userService.findAll();
  }
}
```

---

## Testing

### Test Environment

```env
# .env.test
NODE_ENV=test
SUPABASE_URL=http://localhost:54321
SUPABASE_KEY=test-key
SUPABASE_JWT_SECRET=test-secret
MOCK_USER_ID=test-user-uuid
```

### E2E Test Example

```typescript
import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "@/app.module";

describe("UserController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it("/users/me (GET) - should return user profile", () => {
    return request(app.getHttpServer())
      .get("/users/me")
      .set("Authorization", "Bearer any-token") // Mock strategy accepts any token
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe("test-user-uuid");
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

---

## Security Considerations

1. **Never expose `SUPABASE_JWT_SECRET`** - Only use on server-side
2. **Validate tokens server-side** - Always use `auth.getUser(token)`, not just JWT decoding
3. **Use HTTPS in production** - JWT tokens should only be transmitted over secure connections
4. **Set proper CORS** - Restrict origins that can make authenticated requests
5. **Token expiration** - Supabase handles this, but be aware of refresh token flows

---

## Troubleshooting

### Common Issues

1. **"No auth token provided"**
   - Ensure `Authorization: Bearer <token>` header is set
   - Check for typos in header name

2. **"Invalid token"**
   - Token may be expired - client needs to refresh
   - Verify `SUPABASE_URL` and `SUPABASE_KEY` are correct

3. **Mock strategy not working**
   - Ensure `NODE_ENV` is `development` or `test`
   - Verify `MOCK_USER_ID` is set in environment

4. **Role guard returning 403**
   - Check that the route parameter matches what guard expects (e.g., `:workspaceId`)
   - Verify user has correct role in database

---

## Summary

| Component | Purpose |
|-----------|---------|
| `SupabaseStrategy` | Validates JWT tokens via Supabase |
| `MockStrategy` | Bypasses auth in dev/test environments |
| `@Auth()` | Decorator for protected routes |
| `@Auth(Role)` | Decorator with role requirement |
| `@AdminAuth()` | Decorator for admin-only routes |
| `@User()` | Parameter decorator for user object |
| `@UserId()` | Parameter decorator for user ID |
| `RoleGuard` | Enforces role-based access |
| `AdminGuard` | Restricts by email domain |

This architecture provides a clean separation between Supabase (authentication) and your application (authorization), making it easy to extend with additional auth providers or authorization rules.
