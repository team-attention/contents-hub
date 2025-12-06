---
title: Add Supabase authentication to server
source: local
provider: local
created_at: 2025-12-03T03:49:37Z
updated_at: 2025-12-03T12:38:36Z
status: completed
completed_at: 2025-12-03T12:38:36Z
git_branch: main
---

# Spec

server쪽에 Supabase 인증 구현

## Reference

- `ctx/references/supabase-nestjs-auth-guide.md` - Auth 구현 가이드
- `ctx/references/e2e-test-scaffolding-guide.md` - E2E 테스트 가이드

## Requirements

- Supabase Passport strategy 설정
- JWT token 검증
- Custom auth decorators (@Auth, @User, @UserId)
- Role-based authorization guards
- Mock authentication for development/testing
- **E2E 테스트로 auth 동작 검증 (TestContainers 사용)**

---

# Implementation Plan

_Generated at 2025-12-03T03:59:12Z_
_Last updated at 2025-12-03T04:31:43Z_

## Q&A

**Q: Admin Guard (email domain restriction)가 필요한가요?**
A: No - Admin Guard 없이 기본 인증만 구현

**Q: Role enum에 어떤 역할들이 필요한가요?**
A: Skip Role - Role-based auth 없이 기본 인증만 구현

## Phases

### Phase 1: Dependencies & Environment

**Step 1: Install auth dependencies**
- [ ] `pnpm add nestjs-supabase-auth passport-jwt @nestjs/passport passport-http-bearer -F server`
- [ ] `pnpm add -D @types/passport-jwt -F server`

**Step 2: Install E2E test dependencies**
- [ ] `pnpm add -D @testcontainers/postgresql testcontainers supertest @types/supertest @nestjs/testing -F server`

**Step 3: Update environment configuration**
- [ ] Add `SUPABASE_JWT_SECRET` to `env.ts` zod schema
- [ ] Add optional `MOCK_USER_ID` for dev/test
- [ ] Add `.env.example` update with new variables

### Phase 2: Auth Module Structure

**Step 4: Create auth module directory structure**
```
apps/server/src/auth/
├── auth.module.ts
├── auth.controller.ts
├── strategies/
│   ├── supabase.strategy.ts
│   └── mock.strategy.ts
└── decorators/
    └── auth.decorator.ts
```

**Step 5: Implement Supabase Strategy**
- [ ] Create `supabase.strategy.ts` with `nestjs-supabase-auth`
- [ ] Implement JWT extraction from Bearer token
- [ ] Validate token via `supabase.auth.getUser(token)`

**Step 6: Implement Mock Strategy**
- [ ] Create `mock.strategy.ts` for dev/test
- [ ] Return mock user with `MOCK_USER_ID`

### Phase 3: Decorators & Module Registration

**Step 7: Create User decorators**
- [ ] Create `@User()` param decorator (full user object)
- [ ] Create `@UserId()` param decorator (just ID)
- [ ] Place in `apps/server/src/common/decorators/user.decorator.ts`

**Step 8: Create Auth decorator**
- [ ] Create `@Auth()` method decorator
- [ ] Auto-switch between Supabase and Mock strategy based on env

**Step 9: Register Auth Module**
- [ ] Create `auth.module.ts` with PassportModule import
- [ ] Create `auth.controller.ts` with `GET /auth/me` endpoint
- [ ] Register strategies as providers
- [ ] Import AuthModule in AppModule

### Phase 4: E2E Test Setup (TestContainers)

**Step 10: Create E2E test infrastructure**
```
apps/server/
├── test/
│   ├── e2e/
│   │   └── auth.e2e-spec.ts
│   ├── utils/
│   │   ├── global.ts           # Container management
│   │   └── helpers.ts          # App creation & test helpers
│   ├── env-setup.ts
│   ├── jest-global-setup.ts
│   └── jest-global-teardown.ts
├── jest-e2e.config.js
└── .env.test
```

**Step 11: Configure Jest E2E**
- [ ] Create `jest-e2e.config.js` with global setup/teardown
- [ ] Create `.env.test` with test DATABASE_URL and MOCK_USER_ID

**Step 12: Create test utilities**
- [ ] Create `test/utils/global.ts` - TestContainer management
- [ ] Create `test/utils/helpers.ts` - `createTestApp()`, `cleanAndSetupTestData()`
- [ ] Create `test/env-setup.ts` - Load .env.test
- [ ] Create `test/jest-global-setup.ts` - Start PostgreSQL container
- [ ] Create `test/jest-global-teardown.ts` - Stop container

**Step 13: Write auth E2E tests**
- [ ] Create `test/e2e/auth.e2e-spec.ts`
- [ ] Test: `GET /auth/me` returns 401 without token
- [ ] Test: `GET /auth/me` returns user with valid mock token
- [ ] Test: Protected endpoint works with auth

**Step 14: Add test script**
- [ ] Add `"test:e2e": "APP_ENV=test jest --config ./jest-e2e.config.js --runInBand"` to package.json

## Files to Modify

- `apps/server/src/env.ts` - Add SUPABASE_JWT_SECRET, MOCK_USER_ID
- `apps/server/src/app.module.ts` - Import AuthModule
- `apps/server/.env` - Add new env vars
- `apps/server/.env.example` - Document new env vars
- `apps/server/package.json` - Add test:e2e script

## Files to Create

### Auth Module
- `apps/server/src/auth/auth.module.ts` - Auth module registration
- `apps/server/src/auth/auth.controller.ts` - Auth controller with /me endpoint
- `apps/server/src/auth/strategies/supabase.strategy.ts` - Supabase Passport strategy
- `apps/server/src/auth/strategies/mock.strategy.ts` - Mock strategy for dev
- `apps/server/src/auth/decorators/auth.decorator.ts` - @Auth() decorator
- `apps/server/src/common/decorators/user.decorator.ts` - @User(), @UserId() decorators

### E2E Test Infrastructure
- `apps/server/jest-e2e.config.js` - Jest E2E configuration
- `apps/server/.env.test` - Test environment variables
- `apps/server/test/env-setup.ts` - Environment loading
- `apps/server/test/utils/global.ts` - Container management
- `apps/server/test/utils/helpers.ts` - Test helpers
- `apps/server/test/jest-global-setup.ts` - Global setup
- `apps/server/test/jest-global-teardown.ts` - Global teardown
- `apps/server/test/e2e/auth.e2e-spec.ts` - Auth E2E tests

## Files/Objects to Reuse

- `apps/server/src/env.ts` - Extend existing Zod schema with auth env vars
- `@supabase/supabase-js` - Already installed, use for token verification
- `apps/server/src/db/` - Reuse Drizzle schema and connection for tests

## Notes

- Role-based authorization은 이번 구현에서 제외 (사용자 요청)
- Admin Guard도 이번 구현에서 제외 (사용자 요청)
- Mock strategy는 `NODE_ENV=development|test` + `MOCK_USER_ID` 설정시에만 활성화
- Supabase JWT secret은 Supabase Dashboard > Settings > API > JWT Secret에서 확인
- E2E 테스트는 `--runInBand` 필수 (single process에서 global container 공유)
- TestContainers는 Docker 실행 필요
