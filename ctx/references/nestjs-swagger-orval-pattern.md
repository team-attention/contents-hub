# NestJS + Swagger + Orval: Type-Safe API Client Generation Pattern

A comprehensive guide for end-to-end type-safe API development in pnpm monorepo.

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

## Quick Start Checklist

Use this checklist when setting up a new project or adding Swagger/Orval to an existing project.

### Phase 1: Server Setup (NestJS)

- [ ] **1.1 Install dependencies**
  ```bash
  pnpm --filter server add @nestjs/swagger class-validator class-transformer
  ```

- [ ] **1.2 Configure nest-cli.json** with Swagger plugin
  ```json
  {
    "$schema": "https://json.schemastore.org/nest-cli",
    "collection": "@nestjs/schematics",
    "sourceRoot": "src",
    "compilerOptions": {
      "deleteOutDir": true,
      "plugins": [
        {
          "name": "@nestjs/swagger",
          "options": {
            "classValidatorShim": true,
            "introspectComments": true,
            "dtoFileNameSuffix": [".dto.ts", ".entity.ts"],
            "controllerFileNameSuffix": [".controller.ts"]
          }
        }
      ]
    }
  }
  ```

- [ ] **1.3 Setup Swagger in main.ts**
  ```typescript
  import { NestFactory } from "@nestjs/core";
  import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
  import { writeFileSync, mkdirSync } from "node:fs";

  async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Swagger Configuration
    const config = new DocumentBuilder()
      .setTitle("Contents Hub API")
      .setDescription("API documentation")
      .setVersion("1.0")
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);

    // Swagger UI (development only)
    if (process.env.APP_ENV === "development") {
      SwaggerModule.setup("docs", app, document);

      // Generate swagger.json for Orval
      mkdirSync("__generated__", { recursive: true });
      writeFileSync(
        "__generated__/swagger.json",
        JSON.stringify(document, null, 2)
      );
    }

    await app.listen(env.PORT);
  }
  ```

- [ ] **1.4 Add Swagger decorators to controllers**
  ```typescript
  import { Controller, Get } from "@nestjs/common";
  import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";

  @Controller("auth")
  @ApiTags("auth")
  @ApiBearerAuth()
  export class AuthController {
    @Get("me")
    @ApiOperation({ summary: "Get current user" })
    getMe(@User() user: AuthUser): GetMeResponseDto {
      return { id: user.id, email: user.email };
    }
  }
  ```

- [ ] **1.5 Create DTOs with @ApiProperty**
  ```typescript
  import { ApiProperty } from "@nestjs/swagger";

  export class GetMeResponseDto {
    @ApiProperty({ example: "550e8400-e29b-41d4-a716-446655440000" })
    id: string;

    @ApiProperty({ example: "user@example.com" })
    email: string;
  }
  ```

- [ ] **1.6 Add generate:swagger script to package.json**
  ```json
  {
    "scripts": {
      "generate:swagger": "nest start --entryFile scripts/generate-swagger-docs"
    }
  }
  ```

### Phase 2: Client Setup (Orval)

- [ ] **2.1 Install Orval**
  ```bash
  pnpm --filter client add -D orval
  pnpm --filter client add @tanstack/react-query
  ```

- [ ] **2.2 Create orval.config.ts**
  ```typescript
  import { defineConfig } from "orval";

  export default defineConfig({
    api: {
      input: {
        target: "../server/__generated__/swagger.json",
      },
      output: {
        target: "src/api/__generated__/api.ts",
        schemas: "src/api/__generated__/models",
        client: "react-query",
        httpClient: "fetch",
        override: {
          mutator: {
            path: "src/api/client.ts",
            name: "apiClient",
          },
          query: {
            useQuery: true,
            useSuspenseQuery: true,
          },
        },
        biome: true,
      },
    },
  });
  ```

- [ ] **2.3 Create custom HTTP client (src/api/client.ts)**
  ```typescript
  const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

  export class ApiError extends Error {
    constructor(public message: string, public status: number) {
      super(message);
      this.name = "ApiError";
    }
  }

  export const apiClient = async <T>(
    url: string,
    options: RequestInit
  ): Promise<T> => {
    const requestUrl = new URL(url).pathname;
    const fullUrl = `${API_BASE}${requestUrl}`;

    const token = localStorage.getItem("accessToken");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(fullUrl, { ...options, headers });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(error.message ?? response.statusText, response.status);
    }

    if (response.status === 204) {
      return { status: response.status, data: null } as T;
    }

    const data = await response.json();
    return { status: response.status, data } as T;
  };
  ```

- [ ] **2.4 Add generate:api script**
  ```json
  {
    "scripts": {
      "generate:api": "orval"
    }
  }
  ```

### Phase 3: Workflow Integration

- [ ] **3.1 Add root-level scripts for monorepo**
  ```json
  {
    "scripts": {
      "generate:swagger": "pnpm --filter server generate:swagger",
      "generate:api": "pnpm --filter client generate:api",
      "generate": "pnpm generate:swagger && pnpm generate:api"
    }
  }
  ```

- [ ] **3.2 Test the workflow**
  ```bash
  pnpm generate:swagger  # Generate swagger.json
  pnpm generate:api      # Generate React Query hooks
  pnpm typecheck         # Verify type safety
  ```

---

## Detailed Configuration

### nest-cli.json Options

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@nestjs/swagger",
        "options": {
          "classValidatorShim": true,
          "introspectComments": true,
          "dtoFileNameSuffix": [".dto.ts", ".entity.ts"],
          "controllerFileNameSuffix": [".controller.ts"]
        }
      }
    ]
  }
}
```

| Option | Description |
|--------|-------------|
| `classValidatorShim` | Auto-infer validation from class-validator decorators |
| `introspectComments` | Use JSDoc comments as descriptions |
| `dtoFileNameSuffix` | Files to scan for DTO classes |
| `controllerFileNameSuffix` | Files to scan for controller classes |

### Controller Decorators Reference

```typescript
@Controller("users")
@ApiTags("users")               // Swagger UI grouping
@ApiBearerAuth()                // Requires JWT auth
export class UserController {

  @Get()
  @ApiOperation({ summary: "List users" })
  async getUsers(): Promise<GetUsersResponseDto> {}

  @Get(":id")
  @ApiOperation({ summary: "Get user by ID" })
  @ApiResponse({ status: 404, description: "User not found" })
  async getUser(@Param("id") id: string): Promise<UserDto> {}

  @Post()
  @ApiOperation({ summary: "Create user" })
  @ApiResponse({ status: 201, description: "User created" })
  async createUser(@Body() dto: CreateUserDto): Promise<UserDto> {}

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete user" })
  async deleteUser(@Param("id") id: string): Promise<void> {}
}
```

### DTO Patterns

**Response DTO:**
```typescript
import { ApiProperty } from "@nestjs/swagger";

export class UserDto {
  @ApiProperty({ example: "uuid-string" })
  id: string;

  @ApiProperty({ example: "user@example.com" })
  email: string;

  @ApiProperty({ enum: ["admin", "member"], example: "member" })
  role: string;

  @ApiProperty({ required: false })
  avatarUrl?: string;
}

export class GetUsersResponseDto {
  @ApiProperty({ type: [UserDto] })
  items: UserDto[];
}
```

**Request DTO:**
```typescript
import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, IsEnum, IsOptional } from "class-validator";

export class CreateUserDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: ["admin", "member"] })
  @IsEnum(["admin", "member"])
  role: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
```

### orval.config.ts Options

```typescript
import { defineConfig } from "orval";

export default defineConfig({
  api: {
    input: {
      target: "../server/__generated__/swagger.json",
      // Optional: Filter out internal APIs
      filters: {
        tags: [/^(?!.*internal).*$/],
      },
    },
    output: {
      target: "src/api/__generated__/api.ts",
      schemas: "src/api/__generated__/models",
      client: "react-query",
      httpClient: "fetch",
      override: {
        // Clean operation names
        operationName: (operation) => {
          const name = operation.operationId ?? "";
          return name.replace(/Controller_/g, "");
        },
        mutator: {
          path: "src/api/client.ts",
          name: "apiClient",
        },
        query: {
          useQuery: true,
          useSuspenseQuery: true,
          useInfinite: false,
        },
      },
      biome: true,  // Use Biome for formatting
    },
  },
});
```

---

## Client Usage

### Query Hooks

```typescript
import { useGetUsers, useGetUsersSuspense } from "@/api/__generated__/api";

// Standard hook
function UserList() {
  const { data, isLoading, error } = useGetUsers();
  if (isLoading) return <Spinner />;
  return <ul>{data?.data.items.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}

// Suspense hook
function UserListSuspense() {
  const { data } = useGetUsersSuspense();
  return <ul>{data?.data.items.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

### Mutation Hooks

```typescript
import { useCreateUser, getGetUsersQueryKey } from "@/api/__generated__/api";
import { useQueryClient } from "@tanstack/react-query";

function CreateUserForm() {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useCreateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
      },
    },
  });

  const handleSubmit = async (formData: CreateUserInput) => {
    await mutateAsync({ data: formData });
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

---

## CI/CD Integration

```yaml
# .github/workflows/ci.yml
jobs:
  build:
    steps:
      - name: Generate Swagger
        run: pnpm generate:swagger

      - name: Generate API Client
        run: pnpm generate:api

      - name: Type Check
        run: pnpm typecheck

      - name: Check Generated Files
        run: |
          if [[ -n $(git status --porcelain) ]]; then
            echo "Generated files are out of sync!"
            exit 1
          fi
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Types don't match server | Re-run `pnpm generate:swagger && pnpm generate:api` |
| Duplicate operation names | Add unique `operationId` in `@ApiOperation()` |
| Optional field not nullable | Use `@ApiProperty({ required: false, nullable: true })` |
| Empty swagger.json | Check nest-cli.json plugin config |

---

## Summary

| Layer | Responsibility | Key Files |
|-------|---------------|-----------|
| **Server** | API + Swagger generation | `main.ts`, `*.controller.ts`, `*.dto.ts` |
| **Config** | Swagger plugin | `nest-cli.json` |
| **Orval** | Code generation | `orval.config.ts`, `client.ts` |
| **Generated** | Type-safe hooks | `__generated__/api.ts` |
