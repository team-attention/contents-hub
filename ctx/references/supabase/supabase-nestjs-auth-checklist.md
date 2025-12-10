# Supabase NestJS Auth Checklist

> **Reference**: [supabase-nestjs-auth-guide.md](./supabase-nestjs-auth-guide.md)

---

## Initial Setup Checklist

새 프로젝트에서 Supabase Auth 설정 시 확인할 항목들:

### Dependencies

- [ ] `@supabase/supabase-js` 설치
- [ ] `nestjs-supabase-auth` 설치
- [ ] `passport-jwt` 설치
- [ ] `@nestjs/passport` 설치
- [ ] `@types/passport-jwt` devDependency 설치

### Environment Variables

- [ ] `SUPABASE_URL` 설정
- [ ] `SUPABASE_KEY` 설정 (anon public key)
- [ ] `SUPABASE_JWT_SECRET` 설정
- [ ] `MOCK_USER_ID` 설정 (dev/test 용)

### Strategy Implementation

- [ ] `SupabaseStrategy` 구현 (`src/auth/strategies/supabase.strategy.ts`)
- [ ] `MockStrategy` 구현 (`src/auth/strategies/mock.strategy.ts`)
- [ ] `AuthModule`에 두 strategy provider 등록

### Auth Decorator

- [ ] `@Auth()` 데코레이터가 `ApiBearerAuth()` 포함
- [ ] `@Auth()` 데코레이터가 `UseGuards(AuthGuard(strategy))` 포함
- [ ] Mock strategy 자동 전환 로직 구현 (dev/test 환경)

### User Decorators

- [ ] `@User()` 파라미터 데코레이터 구현
- [ ] `@UserId()` 파라미터 데코레이터 구현

---

## Code Review Checklist

PR 리뷰 시 확인할 항목들:

### Controller 패턴

- [ ] `@ApiBearerAuth()` 단독 사용 금지 - `@Auth()`만 사용
- [ ] 인증이 필요한 엔드포인트에 `@Auth()` 적용 확인
- [ ] `@User()` 또는 `@UserId()`로 사용자 정보 추출

### 보안

- [ ] `SUPABASE_JWT_SECRET`이 클라이언트에 노출되지 않음
- [ ] 토큰 검증이 서버 사이드에서 수행됨 (`auth.getUser(token)`)
- [ ] Role 기반 접근 제어가 필요한 경우 `@Auth(RoleEnum.XXX)` 사용

---

## Anti-Patterns

하면 안 되는 것들:

### Controller

```typescript
// BAD - @ApiBearerAuth() 단독 사용
@ApiBearerAuth()
@Auth()
@Get("me")
getMe() { ... }

// GOOD - @Auth()만 사용 (ApiBearerAuth 포함됨)
@Auth()
@Get("me")
getMe() { ... }
```

### Auth Decorator

```typescript
// BAD - ApiBearerAuth 누락
export function Auth() {
  return applyDecorators(UseGuards(AuthGuard(strategy)));
}

// GOOD - ApiBearerAuth 포함
export function Auth() {
  return applyDecorators(ApiBearerAuth(), UseGuards(AuthGuard(strategy)));
}
```

### Token Validation

```typescript
// BAD - JWT 디코딩만 수행 (토큰 유효성 미검증)
const payload = jwt.decode(token);

// GOOD - Supabase에서 토큰 검증
const { data: { user } } = await supabase.auth.getUser(token);
```

---

## Quick Reference

| 사용 목적 | 데코레이터 |
|----------|-----------|
| 기본 인증 | `@Auth()` |
| Role 기반 인증 | `@Auth(RoleEnum.ADMIN)` |
| Admin 전용 | `@AdminAuth()` |
| 사용자 객체 | `@User() user: AuthUser` |
| 사용자 ID만 | `@UserId() userId: string` |
