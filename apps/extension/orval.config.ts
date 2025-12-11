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

          // content-items → ContentItem (하이픈 처리 + 단수형 + PascalCase)
          const toPascalCase = (str: string) =>
            str
              .split("-")
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
              .join("");

          const pascalTag = toPascalCase(tag);
          // 단수형으로 변환 (s 제거)
          const domain = pascalTag.endsWith("s") ? pascalTag.slice(0, -1) : pascalTag;

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
