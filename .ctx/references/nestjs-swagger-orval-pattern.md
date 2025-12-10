# NestJS Swagger + Orval Pattern

This document describes the improved pattern for generating type-safe API clients from NestJS Swagger documentation using Orval.

## Overview

This pattern uses Orval to automatically generate React Query hooks and TypeScript types from NestJS Swagger documentation, with custom naming conventions and filtering to produce clean, domain-focused API clients.

## Key Improvements

### 1. Tag Filtering

Exclude admin and system endpoints from client generation using regex filters:

```typescript
filters: {
  tags: [/^(?!.*system|admin).*$/]
}
```

This ensures only public-facing API endpoints are included in the generated client.

### 2. Custom Operation Naming

Remove controller prefixes and add domain suffixes based on tags for cleaner function names:

```typescript
operationName: (operation) => {
  const originalName = operation.operationId ?? "";
  const action = originalName.replace(/.*Controller_/gi, "");

  // Extract domain name from tags (uses first tag)
  const tag = operation.tags?.[0];
  if (!tag) return action;

  // Convert to singular PascalCase: subscriptions → Subscription
  const domain = tag.endsWith("s")
    ? tag.slice(0, -1).charAt(0).toUpperCase() + tag.slice(1, -1)
    : tag.charAt(0).toUpperCase() + tag.slice(1);

  // Handle reserved words: delete → remove
  if (action === "delete") return `remove${domain}`;
  return `${action}${domain}`;
}
```

**Results:**
- `SubscriptionsController_create` → `createSubscription`
- `SubscriptionsController_findAll` → `findAllSubscription`
- `SubscriptionsController_findOne` → `findOneSubscription`
- `SubscriptionsController_update` → `updateSubscription`
- `SubscriptionsController_delete` → `removeSubscription`

### 3. Disable Infinite Queries

Explicitly disable infinite query generation to keep the API surface simple:

```typescript
query: {
  useQuery: true,
  useInfinite: false,
  // ... other options
}
```

## Complete Configuration Example

```typescript
import { defineConfig } from "orval";

export default defineConfig({
  api: {
    input: {
      target: "http://localhost:3000/api-json",
      filters: {
        tags: [/^(?!.*system|admin).*$/],
      },
    },
    output: {
      mode: "tags-split",
      target: "./src/lib/api/endpoints",
      schemas: "./src/lib/api/model",
      client: "react-query",
      override: {
        mutator: {
          path: "./src/lib/api/client.ts",
          name: "customInstance",
        },
        query: {
          useQuery: true,
          useInfinite: false,
          options: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
        operationName: (operation) => {
          const originalName = operation.operationId ?? "";
          const action = originalName.replace(/.*Controller_/gi, "");

          // Extract domain name from tags (uses first tag)
          const tag = operation.tags?.[0];
          if (!tag) return action;

          // Convert to singular PascalCase: subscriptions → Subscription
          const domain = tag.endsWith("s")
            ? tag.slice(0, -1).charAt(0).toUpperCase() + tag.slice(1, -1)
            : tag.charAt(0).toUpperCase() + tag.slice(1);

          // Handle reserved words: delete → remove
          if (action === "delete") return `remove${domain}`;
          return `${action}${domain}`;
        },
      },
    },
  },
});
```

## NestJS Backend Requirements

### 1. Controller Tags

Use `@ApiTags()` decorator to group endpoints by domain:

```typescript
@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  // ...
}
```

### 2. Swagger Setup

Configure Swagger in your NestJS application:

```typescript
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('API Documentation')
    .setDescription('API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
}
```

### 3. DTO Decorators

Use Swagger decorators on DTOs for proper type generation:

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubscriptionDto {
  @ApiProperty()
  feedUrl: string;

  @ApiProperty({ required: false })
  tags?: string[];
}
```

## Custom Instance (Mutator)

The mutator provides a custom axios instance with authentication:

```typescript
import type { QueryClient } from "@tanstack/react-query";
import axios, { type AxiosRequestConfig } from "axios";

export const AXIOS_INSTANCE = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Add auth interceptor
AXIOS_INSTANCE.interceptors.request.use(
  async (config) => {
    // Add your auth token logic here
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  const source = axios.CancelToken.source();
  const promise = AXIOS_INSTANCE({
    ...config,
    ...options,
    cancelToken: source.token,
  }).then(({ data }) => data);

  // @ts-expect-error - Adding cancel method for query cancellation
  promise.cancel = () => {
    source.cancel("Query was cancelled");
  };

  return promise;
};

export type ErrorType<Error> = Error;
export type BodyType<BodyData> = BodyData;
```

## Usage Example

After generating the client, use the hooks in your React components:

```typescript
import { useCreateSubscription, useFindAllSubscription, useRemoveSubscription } from '@/lib/api/endpoints/subscriptions/subscriptions';

function SubscriptionManager() {
  // Fetch all subscriptions
  const { data: subscriptions, isLoading } = useFindAllSubscription();

  // Create mutation
  const createMutation = useCreateSubscription();

  // Delete mutation
  const deleteMutation = useRemoveSubscription();

  const handleCreate = async (feedUrl: string) => {
    await createMutation.mutateAsync({
      data: { feedUrl }
    });
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync({
      id
    });
  };

  // ... component JSX
}
```

## Benefits

1. **Type Safety**: Full TypeScript support from backend DTOs to frontend hooks
2. **Clean Names**: Domain-focused naming without controller prefixes
3. **Automatic Generation**: No manual API client code to maintain
4. **React Query Integration**: Built-in caching, loading states, and error handling
5. **Selective Generation**: Filter out internal/admin endpoints
6. **Reserved Word Handling**: Automatically converts problematic names (delete → remove)

## Maintenance

1. Run Orval generation after backend API changes:
   ```bash
   pnpm orval
   ```

2. Commit generated files to version control for type safety across the team

3. Update the `operationName` function if you need different naming conventions

4. Add more regex patterns to `filters.tags` to exclude other endpoint groups as needed
