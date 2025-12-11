# Subscription Scheduler Design Discussion

> **Status**: Draft
> **Created**: 2025-12-10
> **Last Updated**: 2025-12-10

## Overview

NestJS 서버에 스케줄러를 붙여서 구독 기반 웹 페칭 시스템을 구현하는 설계 논의.

---

## Use Cases

### UC1: Reading List (나중에 읽기)
- 사용자가 링크를 저장하면 다음날 아침에 브리핑
- 변경 감지 X, 단순히 콘텐츠를 가져와서 요약/저장

### UC2: Watch for Updates (새 글 알림)
- 블로그/리스트 페이지를 주기적으로 모니터링
- 새 아이템이 추가되면 알림

---

## Decided Items

| 항목 | 결정 |
|-----|-----|
| Fetch 방식 | Server-side fetch |
| Cookie 인증 | 인터페이스만 열어두고 구현은 나중에 |
| Playwright (SSR) | 인터페이스만 열어두고 구현은 나중에 |
| 알림 채널 | 인터페이스만 열어두고 구현은 나중에 |
| 스케줄 타입 | `one_off` (한 번) / `periodic` (반복) |
| 콘텐츠 전략 | `snapshot` (페이지 저장) / `list_diff` (리스트 변경 감지) |

---

## Proposed Domain Model

### Schedule Types

```typescript
type ScheduleType = 'one_off' | 'periodic';

interface OneOffSchedule {
  type: 'one_off';
  executeAt: Date;        // 실행 시점 (예: 내일 아침 8시)
}

interface PeriodicSchedule {
  type: 'periodic';
  intervalMinutes: number; // 최소 60 (1시간)
  startAt?: Date;          // 시작 시점 (없으면 즉시)
  endAt?: Date;            // 종료 시점 (없으면 무기한)
}

type Schedule = OneOffSchedule | PeriodicSchedule;
```

### Content Strategy

```typescript
type ContentStrategy = 'snapshot' | 'list_diff';

interface SnapshotConfig {
  strategy: 'snapshot';
  // 향후 확장: summarize: boolean, extractImages: boolean 등
}

interface ListDiffConfig {
  strategy: 'list_diff';
  selector?: string;       // 리스트 아이템 CSS selector (없으면 AI가 추론)
  // 향후 확장: uniqueKey: 'url' | 'title' | 'hash'
}

type ContentConfig = SnapshotConfig | ListDiffConfig;
```

### Fetch & Auth (확장용)

```typescript
type FetchMethod = 'http' | 'browser';  // browser = Playwright (나중에)
type AuthMethod = 'none' | 'cookie';    // cookie = 나중에
type NotifyChannel = 'none' | 'push' | 'email';
```

### Main Entity

```typescript
interface Subscription {
  id: string;
  userId: string;

  // 기본 정보
  url: string;
  name: string;
  status: 'active' | 'paused' | 'completed' | 'error';

  // 핵심 설정
  schedule: Schedule;
  content: ContentConfig;

  // Fetch 설정 (확장용)
  fetchMethod: FetchMethod;    // default: 'http'
  authMethod: AuthMethod;      // default: 'none'

  // 알림 설정 (확장용)
  notifyChannels: NotifyChannel[];  // default: ['none']

  // 상태 추적
  lastCheckedAt?: Date;
  nextCheckAt?: Date;
  errorCount: number;
  lastError?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

---

## Proposed API

### UC1: Reading List 추가

```http
POST /api/subscriptions/reading-list
```

```typescript
interface AddToReadingListRequest {
  url: string;
  name?: string;              // 없으면 페이지 title에서 추출
  briefingTime?: string;      // "08:00" 형식, 기본값: 다음날 08:00
}
```

내부 변환:
```typescript
{
  schedule: { type: 'one_off', executeAt: 내일 08:00 },
  content: { strategy: 'snapshot' },
  fetchMethod: 'http',
  authMethod: 'none',
  notifyChannels: ['none'],
}
```

### UC2: Watch for Updates

```http
POST /api/subscriptions/watch
```

```typescript
interface WatchForUpdatesRequest {
  url: string;
  name?: string;
  intervalHours?: number;     // 기본값: 1, 최소: 1
  selector?: string;          // 리스트 아이템 selector (옵션)
}
```

내부 변환:
```typescript
{
  schedule: { type: 'periodic', intervalMinutes: 60 },
  content: { strategy: 'list_diff', selector?: },
  fetchMethod: 'http',
  authMethod: 'none',
  notifyChannels: ['none'],
}
```

### 공통 CRUD

```http
GET    /api/subscriptions          # 목록 조회
GET    /api/subscriptions/:id      # 상세 조회
PATCH  /api/subscriptions/:id      # 수정 (고급 사용자용)
DELETE /api/subscriptions/:id      # 삭제
```

---

## Proposed DB Schema

```typescript
// subscriptions 테이블
{
  id: uuid,
  userId: uuid,                    // 추가 필요!

  url: text,
  name: text,
  status: text,                    // 'active' | 'paused' | 'completed' | 'error'

  schedule: jsonb,                 // Schedule union type
  content: jsonb,                  // ContentConfig union type

  fetchMethod: text,               // default: 'http'
  authMethod: text,                // default: 'none'
  authData: text,                  // 암호화된 쿠키 등 (나중에)

  notifyChannels: jsonb,           // default: ['none']

  lastCheckedAt: timestamptz,
  nextCheckAt: timestamptz,        // 인덱스 필요
  errorCount: integer,
  lastError: text,

  createdAt: timestamptz,
  updatedAt: timestamptz,
}

// contentHistory 테이블
{
  id: uuid,
  subscriptionId: uuid,            // FK → subscriptions.id (CASCADE)

  contentHash: text,
  rawContent: text,                // 원본 HTML (옵션)
  summary: text,                   // AI 요약

  detectedItems: jsonb,            // list_diff용: 감지된 아이템
  newItems: jsonb,                 // list_diff용: 새로 추가된 아이템

  checkedAt: timestamptz,
}
```

---

## Proposed Module Structure

```
apps/server/src/
├── subscription/
│   ├── subscription.module.ts
│   ├── subscription.controller.ts
│   ├── subscription.service.ts
│   └── dto/
│       ├── add-reading-list.dto.ts
│       └── watch-updates.dto.ts
│
├── scheduler/
│   ├── scheduler.module.ts
│   └── scheduler.service.ts          # @nestjs/schedule
│
├── fetcher/
│   ├── fetcher.module.ts
│   ├── fetcher.service.ts            # 전략 라우팅
│   ├── strategies/
│   │   ├── http-fetcher.ts           # 기본 fetch
│   │   └── browser-fetcher.ts        # Playwright (나중에)
│   └── fetcher.interface.ts
│
├── content/
│   ├── content.module.ts
│   ├── content.service.ts
│   ├── strategies/
│   │   ├── snapshot.strategy.ts
│   │   └── list-diff.strategy.ts
│   └── content.interface.ts
│
└── notification/                      # 나중에
    ├── notification.module.ts
    └── channels/
        ├── push.channel.ts
        └── email.channel.ts
```

---

## Processing Flow

```
Scheduler (매분 실행)
    │
    ▼
SELECT subscriptions WHERE status='active' AND next_check_at <= NOW()
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│ For each subscription:                                  │
│   1. FetcherService.fetch(url, fetchMethod, authMethod) │
│   2. ContentService.process(html, contentConfig)        │
│      ├─ snapshot: 요약 생성                              │
│      └─ list_diff: 이전과 비교, 새 아이템 감지            │
│   3. if (hasChanges || isOneOff):                       │
│        NotificationService.notify(channels, result)     │
│   4. Update subscription (nextCheckAt, status, etc)     │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Priority

| Phase | 항목 | 상세 |
|-------|-----|-----|
| **1** | DB 스키마 | userId 추가, schedule/content jsonb 컬럼 |
| **1** | Subscription CRUD | 기본 API + reading-list, watch 엔드포인트 |
| **1** | HTTP Fetcher | 단순 fetch 구현 |
| **1** | Snapshot Strategy | HTML → 저장 (요약은 Phase 2) |
| **2** | Scheduler | @nestjs/schedule 기반 주기적 체크 |
| **2** | List Diff Strategy | CSS selector 기반 아이템 추출 + diff |
| **2** | AI 요약 | Claude로 콘텐츠 요약 |
| **3** | Browser Fetcher | Playwright 통합 |
| **3** | Cookie Auth | 암호화 저장 + 인젝션 |
| **3** | Push Notification | Web Push 또는 Extension API |

---

## Open Questions

### High Priority (Phase 1 전에 결정 필요)

- [ ] **Q1**: `userId`를 어떻게 연결할 것인가?
  - Supabase의 auth.users 테이블과 FK?
  - 아니면 별도 users 테이블?
  - 현재 스키마에 userId가 없음

- [ ] **Q2**: Reading List의 "다음날 아침 브리핑" 구현 방식?
  - 특정 시간에 모아서 보여주는 대시보드?
  - 아니면 Extension badge로 알림?
  - 아니면 이메일?

- [ ] **Q3**: `list_diff`에서 "새 아이템"을 어떻게 판별?
  - URL 기준? 제목 기준? Hash 기준?
  - 순서만 바뀐 경우는?
  - 페이지네이션이 있는 경우는?

- [ ] **Q4**: `one_off` 완료 후 상태 처리?
  - status를 `completed`로 변경?
  - 아니면 삭제?
  - 사용자가 다시 실행하고 싶으면?

### Medium Priority (Phase 2 전에 결정)

- [ ] **Q5**: Scheduler가 실패한 구독을 어떻게 처리?
  - `errorCount` 임계값 (예: 5회 연속 실패)?
  - 자동으로 `paused` 또는 `error`로 전환?
  - 사용자에게 알림?

- [ ] **Q6**: `list_diff`에서 selector가 없을 때 AI 추론?
  - 어떤 프롬프트로?
  - 비용 vs 정확도 트레이드오프?
  - 한 번 추론하면 저장?

- [ ] **Q7**: 콘텐츠 히스토리 보관 정책?
  - 무제한 저장?
  - N개만 보관?
  - N일 후 삭제?

### Low Priority (Phase 3)

- [ ] **Q8**: Cookie 저장 시 암호화 방식?
  - 사용자별 키?
  - 서버 마스터 키?
  - 키 로테이션?

- [ ] **Q9**: Playwright 리소스 관리?
  - Browser pool 크기?
  - Timeout 설정?
  - 동시 실행 제한?

- [ ] **Q10**: Push Notification 구현 방식?
  - Web Push API?
  - Extension API (chrome.notifications)?
  - 둘 다?

---

## Notes & Considerations

### 보안
- Cookie 저장 시 서버가 해킹되면 모든 사용자 세션 노출 위험
- 대안: Extension이 대신 fetch하고 결과만 서버로 전송

### 비용
- Playwright: 메모리/CPU 높음 → 필요한 경우에만
- Claude API: 토큰당 과금 → 변경 있을 때만 요약

### 확장성
- 스케줄러 분산 처리 고려 (수천 개 구독 동시 처리)
- Rate limiting 필요 (동일 도메인 과도한 요청 방지)

---

## References

- [NestJS Schedule](https://docs.nestjs.com/techniques/task-scheduling)
- [Drizzle ORM](https://orm.drizzle.team/)
- Current schema: `apps/server/src/db/schema.ts`
