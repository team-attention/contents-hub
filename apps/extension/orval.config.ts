import { defineConfig } from "orval";

export default defineConfig({
  api: {
    input: {
      target: "../server/__generated__/swagger.json",
      filters: {
        tags: [/^(?!.*system|admin).*$/],
      },
    },
    output: {
      target: "src/lib/api/__generated__/api.ts",
      schemas: "src/lib/api/__generated__/models",
      client: "react-query",
      httpClient: "fetch",
      override: {
        operationName: (operation) => {
          const originalName = operation.operationId ?? "";
          const action = originalName.replace(/.*Controller_/gi, "");

          // 태그에서 도메인 이름 추출 (첫 번째 태그 사용)
          const tag = operation.tags?.[0];
          if (!tag) return action;

          // subscriptions → Subscription (단수형 + PascalCase)
          const domain = tag.endsWith("s")
            ? tag.slice(0, -1).charAt(0).toUpperCase() + tag.slice(1, -1)
            : tag.charAt(0).toUpperCase() + tag.slice(1);

          // delete → remove (reserved word)
          if (action === "delete") return `remove${domain}`;
          return `${action}${domain}`;
        },
        mutator: {
          path: "src/lib/api/client.ts",
          name: "apiClient",
        },
        query: {
          useQuery: true,
          useInfinite: false,
          useSuspenseQuery: true,
        },
      },
      biome: true,
    },
  },
});
