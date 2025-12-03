# NestJS + Swagger + Orval: Type-Safe API Client Generation Pattern

A comprehensive guide for end-to-end type-safe API development.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          FLOW                                   │
└─────────────────────────────────────────────────────────────────┘

 NestJS Server                    Orval                    React Client
 ┌────────────────┐              ┌─────────────┐          ┌────────────────┐
 │ Controllers    │              │             │          │ Generated      │
 │ + @ApiTags     │ ──generates──▶ swagger.json ──reads──▶│ React Query    │
 │ + @ApiProperty │              │             │          │ Hooks + Types  │
 │ + DTOs         │              └─────────────┘          └────────────────┘
 └────────────────┘                                             │
                                                                 ▼
                                                          ┌────────────────┐
                                                          │ Custom Mutator │
                                                          │ - Auth Token   │
                                                          │ - Error Handle │
                                                          └────────────────┘
```

**Benefits:**
- Single Source of Truth: Swagger spec is the only API definition
- Type Safety: Server DTOs automatically sync with client types
- Better DX: IDE autocomplete and refactoring support
- Easy Maintenance: Client auto-updates when API changes

---

## 1. Server Setup (NestJS)

### 1.1 Dependencies

```bash
pnpm add @nestjs/swagger class-validator class-transformer
```

### 1.2 Swagger Generation Options

You can generate `swagger.json` in two ways:

#### Option A: Runtime Generation (in main.ts)

```typescript
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { VersioningType } from "@nestjs/common";
import { writeFileSync } from "fs";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // API Versioning (optional but recommended)
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
    prefix: "api/v",  // /api/v1/...
  });

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle("My API")
    .setDescription("API description")
    .setVersion("1.0")
    .addBearerAuth()  // JWT Auth support
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });

  // Swagger UI (development only recommended)
  if (process.env.NODE_ENV === "development") {
    SwaggerModule.setup("docs", app, () => document);

    // Generate swagger.json for Orval
    writeFileSync(
      "__generated__/swagger.json",
      JSON.stringify(document, null, 2)
    );
  }

  await app.listen(3000);
}
```

#### Option B: Manual Generation Script (Recommended for CI/CD)

Create a standalone script to generate swagger.json without running the full server:

**scripts/generate-swagger-docs.ts:**

```typescript
import { mkdirSync, writeFileSync } from "node:fs";
import { AppModule } from "@/app.module";
import { VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

async function generateSwaggerDocs() {
  // Create minimal app instance (no listening)
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
    prefix: "api/v",
  });

  const config = new DocumentBuilder()
    .setTitle("My API")
    .setDescription("API description")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
  });

  // Ensure output directory exists
  mkdirSync("__generated__", { recursive: true });
  writeFileSync(
    "__generated__/swagger.json",
    JSON.stringify(document, null, 2)
  );

  // Exit after generation (don't start server)
  await app.close();
  console.log("✨ Swagger documentation generated successfully!");
  process.exit(0);
}

generateSwaggerDocs();
```

**scripts/generate-swagger-docs.sh:**

```bash
#!/bin/bash

# Export required environment variables (minimal set for swagger generation)
export APP_ENV="development"
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
# Add other required env vars...

# Change to the server directory
cd "$(dirname "$0")/.." || exit

# Run the swagger generation script
# Using nest start with custom entry file
nest start --entryFile scripts/generate-swagger-docs.js

echo "✨ Swagger documentation generated successfully!"
```

**nest-cli.json configuration:**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "assets": ["**/*.json"],
    "plugins": [
      {
        "name": "@nestjs/swagger",
        "options": {
          "classValidatorShim": true,
          "introspectComments": true
        }
      }
    ]
  },
  "entryFile": "main"
}
```

**package.json scripts:**

```json
{
  "scripts": {
    "generate:swagger": "bash scripts/generate-swagger-docs.sh",
    "prebuild": "pnpm generate:swagger"
  }
}
```

This approach is useful when:
- You need to generate swagger.json in CI/CD without starting the server
- You want to avoid side effects from full server initialization
- You need to generate docs before deployment

### 1.3 Controller Decorators

```typescript
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";

@Controller("users")
@ApiTags("users")           // Swagger UI grouping
@ApiBearerAuth()            // Requires auth
export class UserController {

  @Get()
  @ApiOperation({ summary: "Get all users" })
  async getUsers(): Promise<GetUsersResponseDto> {
    // ...
  }

  @Get(":id")
  @ApiOperation({ summary: "Get user by ID" })
  @ApiResponse({ status: 404, description: "User not found" })
  async getUser(@Param("id") id: string): Promise<UserDto> {
    // ...
  }

  @Post()
  @ApiOperation({ summary: "Create a new user" })
  @ApiResponse({ status: 201, description: "User created" })
  async createUser(@Body() dto: CreateUserDto): Promise<UserDto> {
    // ...
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete user" })
  @HttpCode(HttpStatus.NO_CONTENT)  // 204 response
  async deleteUser(@Param("id") id: string): Promise<void> {
    // ...
  }
}
```

### 1.4 DTO Patterns

**Response DTO (documentation-focused):**

```typescript
import { ApiProperty } from "@nestjs/swagger";

export class UserDto {
  @ApiProperty({
    description: "User unique identifier",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id: string;

  @ApiProperty({
    description: "User email address",
    example: "user@example.com",
  })
  email: string;

  @ApiProperty({
    description: "User role",
    enum: ["admin", "member", "viewer"],
    example: "member",
  })
  role: string;

  @ApiProperty({
    description: "Profile image URL",
    required: false,  // optional field
  })
  avatarUrl?: string;
}

// List response wrapper pattern
export class GetUsersResponseDto {
  @ApiProperty({
    description: "List of users",
    type: [UserDto],  // array syntax
  })
  items: UserDto[];
}
```

**Request DTO (validation-focused):**

```typescript
import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsString,
  IsEnum,
  IsOptional,
  MinLength,
} from "class-validator";

export class CreateUserDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "John Doe" })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ enum: ["admin", "member", "viewer"] })
  @IsEnum(["admin", "member", "viewer"])
  role: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
```

### 1.5 @ApiProperty Options Reference

| Option | Type | Description |
|--------|------|-------------|
| `description` | string | Field description |
| `example` | any | Example value (shown in Swagger UI) |
| `type` | Type or [Type] | Type specification, use `[UserDto]` for arrays |
| `required` | boolean | Required field (default: true) |
| `enum` | array | Allowed values list |
| `nullable` | boolean | Allow null values |
| `default` | any | Default value |

---

## 2. Orval Setup (Client Generation)

### 2.1 Dependencies

```bash
pnpm add -D orval
pnpm add @tanstack/react-query
```

### 2.2 orval.config.ts

```typescript
import { defineConfig } from "orval";

export default defineConfig({
  api: {
    input: {
      // Swagger JSON path (generated by server)
      target: "../server/__generated__/swagger.json",

      // Tag-based filtering (optional)
      filters: {
        tags: [/^(?!.*internal|admin).*$/],  // exclude internal, admin
      },
    },
    output: {
      // Generated file path
      target: "src/api/__generated__/api.ts",
      schemas: "src/api/__generated__/models",

      // Base URL (can be overridden by mutator)
      baseUrl: "http://localhost:3000",

      // React Query + fetch combination
      client: "react-query",
      httpClient: "fetch",

      override: {
        // Clean up operation names (optional)
        operationName: (operation, route, verb) => {
          const name = operation.operationId ?? "";
          return name.replace(/Controller_|_api\/v\d+/g, "");
        },

        // Custom HTTP Client
        mutator: {
          path: "src/api/client.ts",
          name: "apiClient",
        },

        // React Query options
        query: {
          useQuery: true,
          useSuspenseQuery: true,  // React 18+
          useInfinite: false,
        },
      },

      // Formatter (optional)
      biome: true,  // or prettier: true
    },
  },
});
```

### 2.3 Custom HTTP Client (Mutator)

`src/api/client.ts`:

```typescript
// Custom client handling auth token injection, error handling, URL transformation

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// Auth token getter (implement according to your project)
const getAuthToken = async (): Promise<string | null> => {
  // Supabase example
  // return (await supabase.auth.getSession()).data.session?.access_token;

  // localStorage example
  return localStorage.getItem("accessToken");
};

// Custom Error Classes
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }

  static is(error: unknown): error is ApiError {
    return error instanceof ApiError;
  }
}

export class AuthError extends ApiError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
    this.name = "AuthError";
  }
}

// Main HTTP Client
export const apiClient = async <T>(
  url: string,
  options: RequestInit
): Promise<T> => {
  // URL transformation (dev proxy, etc.)
  const requestUrl = new URL(url).pathname;
  const fullUrl = `${API_BASE}${requestUrl}`;

  // Auth header injection
  const token = await getAuthToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Execute fetch
  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  // Error handling
  if (response.status === 401) {
    throw new AuthError();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      error.message ?? response.statusText,
      response.status
    );
  }

  // Empty response handling (204, etc.)
  if (response.status === 204) {
    return { status: response.status, data: null } as T;
  }

  const data = await response.json();
  return { status: response.status, data, headers: response.headers } as T;
};
```

### 2.4 Generate Client

```bash
# package.json scripts
{
  "scripts": {
    "generate:api": "orval"
  }
}

# Run
pnpm generate:api
```

---

## 3. Client Usage (React)

### 3.1 Query Hook (GET)

```typescript
import { useGetUsers } from "@/api/__generated__/api";

function UserList() {
  const { data, isLoading, error } = useGetUsers();

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <ul>
      {data?.data.items.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

### 3.2 Suspense Query Hook

```typescript
import { useGetUsersSuspense } from "@/api/__generated__/api";
import { Suspense } from "react";

function UserListContent() {
  // Loading handled by Suspense boundary
  const { data } = useGetUsersSuspense();

  return (
    <ul>
      {data?.data.items.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

function UserList() {
  return (
    <Suspense fallback={<Spinner />}>
      <UserListContent />
    </Suspense>
  );
}
```

### 3.3 Mutation Hook (POST/PUT/DELETE)

```typescript
import {
  useCreateUser,
  getGetUsersQueryKey
} from "@/api/__generated__/api";
import { useQueryClient } from "@tanstack/react-query";

function CreateUserForm() {
  const queryClient = useQueryClient();

  const { mutateAsync, isPending } = useCreateUser({
    mutation: {
      onSuccess: async () => {
        // Invalidate related queries -> auto refetch
        await queryClient.invalidateQueries({
          queryKey: getGetUsersQueryKey(),
        });
      },
      onError: (error) => {
        if (ApiError.is(error)) {
          toast.error(error.message);
        }
      },
    },
  });

  const handleSubmit = async (formData: CreateUserInput) => {
    await mutateAsync({ data: formData });
    toast.success("User created!");
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button disabled={isPending}>
        {isPending ? "Creating..." : "Create"}
      </button>
    </form>
  );
}
```

### 3.4 With Path Parameters

```typescript
import { useGetUser, useDeleteUser } from "@/api/__generated__/api";

function UserDetail({ userId }: { userId: string }) {
  // Pass path parameter
  const { data: user } = useGetUser(userId);

  const { mutateAsync: deleteUser } = useDeleteUser();

  const handleDelete = async () => {
    await deleteUser({ id: userId });
  };

  return (
    <div>
      <h1>{user?.data.name}</h1>
      <button onClick={handleDelete}>Delete</button>
    </div>
  );
}
```

---

## 4. Best Practices

### 4.1 Response Wrapper Pattern

Use wrapper DTOs for consistent response structure:

```typescript
// Single item
export class GetUserResponseDto {
  @ApiProperty({ type: UserDto })
  item: UserDto;
}

// List
export class GetUsersResponseDto {
  @ApiProperty({ type: [UserDto] })
  items: UserDto[];
}

// Paginated
export class PaginatedUsersResponseDto {
  @ApiProperty({ type: [UserDto] })
  items: UserDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}
```

### 4.2 OperationId for Unique Names

When multiple controllers have methods with the same name:

```typescript
@Controller("admin/users")
export class AdminUserController {
  @Get()
  @ApiOperation({
    summary: "Get all users (admin)",
    operationId: "getAdminUsers"  // Specify unique name
  })
  async getUsers(): Promise<GetUsersResponseDto> { }
}

@Controller("users")
export class UserController {
  @Get()
  @ApiOperation({
    summary: "Get all users",
    operationId: "getUsers"
  })
  async getUsers(): Promise<GetUsersResponseDto> { }
}
```

### 4.3 Error Response Documentation

```typescript
@Get(":id")
@ApiOperation({ summary: "Get user by ID" })
@ApiResponse({
  status: 200,
  type: UserDto,
  description: "User found"
})
@ApiResponse({
  status: 404,
  description: "User not found"
})
@ApiResponse({
  status: 401,
  description: "Unauthorized"
})
async getUser(@Param("id") id: string): Promise<UserDto> { }
```

### 4.4 Tag Organization

```typescript
// Feature-based grouping
@ApiTags("users")           // /users/*
@ApiTags("users/profile")   // /users/:id/profile/*
@ApiTags("auth")            // /auth/*

// Separate public/internal with Orval filter
@ApiTags("internal/metrics")  // filtered out by Orval
```

---

## 5. Development Workflow

```bash
# 1. Server: Modify API and restart server (runtime generation)
pnpm --filter server dev

# OR: Generate swagger.json manually (without running server)
pnpm --filter server generate:swagger

# 2. swagger.json is generated in __generated__/swagger.json

# 3. Client: Regenerate API client
pnpm --filter web generate:api

# 4. Check TypeScript errors -> Immediately detect API changes
pnpm type-check
```

### CI/CD Integration

```yaml
# GitHub Actions example
jobs:
  build:
    steps:
      - name: Generate Swagger docs
        run: pnpm --filter server generate:swagger

      - name: Generate API client
        run: pnpm --filter web generate:api

      - name: Type check
        run: pnpm type-check

      - name: Check for uncommitted changes
        run: |
          if [[ -n $(git status --porcelain) ]]; then
            echo "Generated files are out of sync!"
            exit 1
          fi
```

---

## 6. Troubleshooting

### Generated types don't match server

```bash
# Regenerate swagger.json
pnpm --filter server generate:swagger

# Regenerate API client
pnpm generate:api
```

### Duplicate operation names

```typescript
// Solution: Specify operationId
@ApiOperation({
  summary: "Get items",
  operationId: "getWorkspaceItems"  // Unique name
})
```

### Optional fields not nullable in client

```typescript
// Explicitly specify nullable in DTO
@ApiProperty({ required: false, nullable: true })
avatarUrl?: string | null;
```

---

## Summary

| Layer | Responsibility | Key Files |
|-------|---------------|-----------|
| **Server** | API definition + Swagger generation | `main.ts`, `*.controller.ts`, `*.dto.ts`, `scripts/generate-swagger-docs.ts` |
| **Orval** | Code generation config | `orval.config.ts` |
| **Client** | Custom HTTP logic | `client.ts` (mutator) |
| **Generated** | Type-safe hooks | `__generated__/api.ts` |

This pattern enables compile-time detection of client errors when APIs change, significantly reducing runtime errors.
