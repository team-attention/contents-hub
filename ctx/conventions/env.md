---
when:
  - 환경변수를 사용하는 코드 작성 시
  - 새로운 환경변수 추가 시
  - 코드 리뷰에서 환경변수 접근 방식 확인 시

what: |
  환경변수 접근 규칙. process.env 대신 타입 안전한 env 객체 사용.
---

# 환경변수 규칙

## Rule

`process.env.VAR_NAME` 대신 `env.VAR_NAME` 사용

## Why

- 타입 안전성 (TypeScript 자동완성)
- 중앙 집중 관리 (`src/env.ts`)
- 필수 변수 누락 시 빌드 타임 에러

## Example

```typescript
// ❌ Bad
const apiKey = process.env.GEMINI_API_KEY;

// ✅ Good
import { env } from '@/env';
const apiKey = env.GEMINI_API_KEY;
```

## 새 환경변수 추가 시

1. `.env.local`에 값 추가
2. `src/env.ts`에 스키마 정의 추가
3. 코드에서 `env.NEW_VAR` 로 접근
