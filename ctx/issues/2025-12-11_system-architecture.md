# Contents Hub - System Architecture

> **Status**: Draft
> **Created**: 2025-12-11
> **Last Updated**: 2025-12-11

## Overview

콘텐츠 구독 및 다이제스트 시스템의 전체 아키텍처.

**핵심 컨셉**:
- 유저가 구독한 소스에서 새 콘텐츠를 감지하거나, 직접 "나중에 읽기"로 등록
- 모든 콘텐츠는 `ContentItem`으로 통합되어 한 번에 digest
- 아침 브리핑 형태로 personalized digest 제공

---

## User Flows

### Flow 1: 구독 (Watch for Updates)
```
User → "이 블로그 구독할래" (Extension)
     → Subscription 생성 (periodic)

Scheduler → 주기적 체크
         → 새 글 감지
         → ContentItem 생성 (source: 'subscription')
```

### Flow 2: 나중에 읽기 (Reading List)
```
User → "이 글 나중에 읽을래" (Extension)
     → ContentItem 생성 (source: 'direct')
```

### Flow 3: 아침 브리핑 (Digest)
```
Scheduler → 지정 시간 (예: 08:00)
         → pending ContentItems 수집
         → Fetch (아직 안 했으면)
         → 개별 요약 → 통합 Digest
         → 알림
```

---

## System Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              External                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │   Chrome     │  │   Web App    │  │   External   │                   │
│  │  Extension   │  │  (Dashboard) │  │    APIs      │                   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                   │
└─────────┼─────────────────┼─────────────────┼───────────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           NestJS Server                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                        API Layer                                 │    │
│  │  POST /subscriptions      POST /content-items                    │    │
│  │  GET  /digests/today      PATCH /content-items/:id              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                    │                                     │
│  ┌─────────────────────────────────┼───────────────────────────────┐    │
│  │                         Orchestrator                             │    │
│  │         (전체 파이프라인 조율 + 스케줄링)                           │    │
│  └─────────────────────────────────┼───────────────────────────────┘    │
│                                    │                                     │
│  ┌─────────────┬─────────────┬─────┴─────┬─────────────┐                │
│  │             │             │           │             │                │
│  ▼             ▼             ▼           ▼             ▼                │
│ ┌───────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│ │Checker│ │ Fetcher │ │ Digester │ │ Notifier │ │  Store   │           │
│ │       │ │         │ │          │ │          │ │          │           │
│ │ diff  │ │ http    │ │ summary  │ │ push     │ │ Supabase │           │
│ │ detect│ │ browser │ │ digest   │ │ email    │ │ Postgres │           │
│ │       │ │ api     │ │          │ │ extension│ │          │           │
│ └───────┘ └─────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Pipeline Interfaces

### 1. SubscriptionChecker

구독 리스트를 체크하고 새 아이템을 감지.

```typescript
interface ISubscriptionChecker {
  check(subscription: Subscription): Promise<CheckResult>;
  processAllDue(): Promise<void>;
}

interface CheckResult {
  subscriptionId: string;
  success: boolean;
  newItems?: DetectedItem[];    // 새로 감지된 아이템
  snapshot?: string;            // 현재 상태 (다음 diff용)
  error?: string;
}

interface DetectedItem {
  url: string;
  title?: string;
  detectedAt: Date;
}
```

### 2. Fetcher

URL에서 콘텐츠를 가져옴. 3가지 전략 지원.

```typescript
interface IFetcher {
  fetch(request: FetchRequest): Promise<FetchResult>;
}

type FetchMethod = 'http' | 'browser' | 'api';

interface FetchRequest {
  url: string;
  method: FetchMethod;

  // browser용
  browserOptions?: {
    waitForSelector?: string;
    timeout?: number;
  };

  // api용 (YouTube, etc.)
  apiOptions?: {
    provider: 'youtube' | 'twitter' | 'rss';  // 확장 가능
    resourceId?: string;
  };

  // 인증 (나중에)
  auth?: {
    type: 'cookie' | 'token';
    data: string;
  };
}

interface FetchResult {
  success: boolean;

  content?: {
    html?: string;          // http, browser
    text: string;           // 추출된 텍스트
    title?: string;
    metadata?: Record<string, unknown>;

    // api 전용
    structured?: unknown;   // API 응답 원본
  };

  error?: {
    code: 'TIMEOUT' | 'NOT_FOUND' | 'AUTH_REQUIRED' | 'RATE_LIMITED' | 'UNKNOWN';
    message: string;
  };

  fetchedAt: Date;
  durationMs: number;
}
```

**Fetch Method 선택 로직:**
```
URL 분석
  ├─ youtube.com/* → api (YouTube Data API)
  ├─ twitter.com/* → api (Twitter API) [나중에]
  ├─ *.xml (RSS)   → api (RSS Parser)
  ├─ SPA/동적 사이트 → browser (Playwright)
  └─ 기본          → http (simple fetch)
```

### 3. Digester

콘텐츠를 AI로 요약하고 통합 digest 생성.

```typescript
interface IDigester {
  summarize(request: SummarizeRequest): Promise<SummarizeResult>;
  digest(request: DigestRequest): Promise<DigestResult>;
}

interface SummarizeRequest {
  contentItemId: string;
  content: string;
  options?: {
    maxLength?: number;
    language?: string;
  };
}

interface SummarizeResult {
  success: boolean;
  summary?: string;
  tokensUsed?: number;
  error?: string;
}

interface DigestRequest {
  userId: string;
  items: Array<{
    contentItemId: string;
    url: string;
    title?: string;
    summary: string;
    source: 'subscription' | 'direct';
  }>;
  userPrompt?: string;          // personalized prompt
}

interface DigestResult {
  success: boolean;
  digest?: {
    text: string;
    sections?: DigestSection[];
  };
  tokensUsed?: number;
  error?: string;
}

interface DigestSection {
  title: string;
  items: Array<{
    contentItemId: string;
    highlight: string;
  }>;
}
```

### 4. Notifier

Digest 결과를 유저에게 전달.

```typescript
interface INotifier {
  notify(request: NotifyRequest): Promise<NotifyResult>;
}

type NotifyChannel = 'push' | 'email' | 'extension';

interface NotifyRequest {
  userId: string;
  digestId: string;
  channels: NotifyChannel[];
  content: {
    title: string;
    body: string;
    url?: string;
  };
}

interface NotifyResult {
  success: boolean;
  channelResults: Record<NotifyChannel, {
    sent: boolean;
    error?: string;
  }>;
}
```

### 5. Orchestrator

전체 파이프라인을 조율하는 메인 서비스.

```typescript
interface IOrchestrator {
  // 스케줄러에서 호출
  runSubscriptionCheck(): Promise<void>;      // 구독 체크 + 새 아이템 등록
  runFetchPending(): Promise<void>;           // pending 아이템 fetch
  runDigestForUser(userId: string): Promise<void>;  // 유저별 digest
  runMorningDigest(): Promise<void>;          // 전체 아침 브리핑
}
```

---

## Database Schema

### Entity Tables (핵심 데이터)

```sql
-- ─────────────────────────────────────────────────────────
-- subscriptions: 구독 소스 관리
-- ─────────────────────────────────────────────────────────
CREATE TABLE subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id),

  -- 기본 정보
  url               TEXT NOT NULL,
  name              TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active',  -- active | paused | error

  -- 체크 설정
  interval_minutes  INTEGER NOT NULL DEFAULT 60,
  selector          TEXT,                            -- CSS selector (optional)

  -- Fetch 설정
  fetch_method      TEXT NOT NULL DEFAULT 'http',    -- http | browser | api
  api_provider      TEXT,                            -- youtube | twitter | rss

  -- 상태 추적
  last_checked_at   TIMESTAMPTZ,
  next_check_at     TIMESTAMPTZ,
  last_snapshot     TEXT,
  error_count       INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_next_check
  ON subscriptions(next_check_at)
  WHERE status = 'active';


-- ─────────────────────────────────────────────────────────
-- content_items: digest 대상 콘텐츠 (통합)
-- ─────────────────────────────────────────────────────────
CREATE TABLE content_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id),

  -- 기본 정보
  url               TEXT NOT NULL,
  title             TEXT,

  -- 출처
  source            TEXT NOT NULL,                   -- subscription | direct
  subscription_id   UUID REFERENCES subscriptions(id) ON DELETE SET NULL,

  -- 상태: pending → fetched → digested → archived
  status            TEXT NOT NULL DEFAULT 'pending',

  -- Fetch 결과
  fetch_history_id  UUID,
  fetched_at        TIMESTAMPTZ,

  -- Digest 결과
  summary           TEXT,
  digest_id         UUID REFERENCES digests(id) ON DELETE SET NULL,
  digested_at       TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_items_pending
  ON content_items(user_id, status)
  WHERE status IN ('pending', 'fetched');


-- ─────────────────────────────────────────────────────────
-- digests: 최종 digest 결과
-- ─────────────────────────────────────────────────────────
CREATE TABLE digests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id),

  -- 결과
  result_text       TEXT NOT NULL,
  result_sections   JSONB,

  -- 메타
  item_count        INTEGER NOT NULL,
  tokens_used       INTEGER,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_digests_user_date
  ON digests(user_id, created_at DESC);
```

### History Tables (파이프라인 기록)

```sql
-- ─────────────────────────────────────────────────────────
-- fetch_history: fetch 실행 기록
-- ─────────────────────────────────────────────────────────
CREATE TABLE fetch_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 대상
  url               TEXT NOT NULL,
  content_item_id   UUID REFERENCES content_items(id) ON DELETE CASCADE,
  subscription_id   UUID REFERENCES subscriptions(id) ON DELETE CASCADE,

  -- 요청
  method            TEXT NOT NULL DEFAULT 'http',    -- http | browser | api
  api_provider      TEXT,

  -- 결과
  success           BOOLEAN NOT NULL,
  status_code       INTEGER,

  content_text      TEXT,
  content_hash      TEXT,

  error_code        TEXT,
  error_message     TEXT,

  duration_ms       INTEGER,
  fetched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fetch_history_content_item
  ON fetch_history(content_item_id, fetched_at DESC);


-- ─────────────────────────────────────────────────────────
-- digest_history: digest 실행 기록
-- ─────────────────────────────────────────────────────────
CREATE TABLE digest_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  content_item_id   UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  digest_id         UUID REFERENCES digests(id) ON DELETE SET NULL,

  -- 입력
  input_text        TEXT NOT NULL,
  input_tokens      INTEGER,

  -- 결과
  success           BOOLEAN NOT NULL,
  summary           TEXT,
  output_tokens     INTEGER,

  error_message     TEXT,

  model             TEXT,
  duration_ms       INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────
-- subscription_check_history: 구독 체크 기록
-- ─────────────────────────────────────────────────────────
CREATE TABLE subscription_check_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id   UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,

  success           BOOLEAN NOT NULL,
  items_detected    INTEGER DEFAULT 0,
  new_items         JSONB,                           -- [{url, title}, ...]

  error_message     TEXT,

  snapshot_before   TEXT,
  snapshot_after    TEXT,
  checked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sub_check_history
  ON subscription_check_history(subscription_id, checked_at DESC);
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Morning Digest Flow                              │
└─────────────────────────────────────────────────────────────────────────┘

1. Subscription Check (매 시간)
   ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
   │ subscriptions │────▶│   Checker   │────▶│ content_items│
   │   (active)   │     │  (diff 감지) │     │  (pending)   │
   └──────────────┘     └─────────────┘     └──────────────┘
                               │
                               ▼
                        subscription_check_history

2. Fetch (digest 전 또는 별도 스케줄)
   ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
   │ content_items │────▶│   Fetcher   │────▶│ content_items│
   │  (pending)   │     │(http/api/brw)│     │  (fetched)   │
   └──────────────┘     └─────────────┘     └──────────────┘
                               │
                               ▼
                          fetch_history

3. Digest (아침 08:00)
   ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
   │ content_items │────▶│  Digester   │────▶│   digests    │
   │  (fetched)   │     │  (Claude)   │     │              │
   └──────────────┘     └─────────────┘     └──────────────┘
          │                    │                    │
          │                    ▼                    │
          │             digest_history              │
          │                                         │
          └────────────────────┬────────────────────┘
                               │
                               ▼
                      content_items (digested)

4. Notify
   ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
   │   digests    │────▶│  Notifier   │────▶│     User     │
   │              │     │             │     │ (push/email) │
   └──────────────┘     └─────────────┘     └──────────────┘
```

---

## Module Structure

```
apps/server/src/
├── orchestrator/
│   ├── orchestrator.module.ts
│   ├── orchestrator.service.ts      # 전체 플로우 조율
│   └── scheduler.service.ts         # @nestjs/schedule 기반
│
├── subscription/
│   ├── subscription.module.ts
│   ├── subscription.controller.ts
│   ├── subscription.service.ts
│   └── checker/
│       ├── checker.service.ts       # ISubscriptionChecker
│       └── strategies/
│           ├── html-diff.strategy.ts
│           └── ai-diff.strategy.ts
│
├── content/
│   ├── content.module.ts
│   ├── content.controller.ts        # content-items API
│   └── content.service.ts
│
├── fetcher/
│   ├── fetcher.module.ts
│   ├── fetcher.service.ts           # IFetcher (전략 라우팅)
│   └── strategies/
│       ├── http.strategy.ts
│       ├── browser.strategy.ts      # Playwright (나중에)
│       └── api/
│           ├── youtube.strategy.ts
│           ├── rss.strategy.ts
│           └── twitter.strategy.ts  # (나중에)
│
├── digester/
│   ├── digester.module.ts
│   ├── digester.service.ts          # IDigester
│   └── prompts/
│       ├── summarize.prompt.ts
│       └── digest.prompt.ts
│
├── notification/
│   ├── notification.module.ts
│   ├── notification.service.ts      # INotifier
│   └── channels/
│       ├── push.channel.ts
│       ├── email.channel.ts
│       └── extension.channel.ts
│
└── digest/
    ├── digest.module.ts
    ├── digest.controller.ts         # digests API
    └── digest.service.ts
```

---

## API Endpoints

```typescript
// ─────────────────────────────────────────────────────────
// Subscriptions
// ─────────────────────────────────────────────────────────
POST   /api/subscriptions              // 구독 추가
GET    /api/subscriptions              // 내 구독 목록
GET    /api/subscriptions/:id          // 구독 상세
PATCH  /api/subscriptions/:id          // 구독 수정
DELETE /api/subscriptions/:id          // 구독 삭제

// ─────────────────────────────────────────────────────────
// Content Items (나중에 읽기 + 구독에서 감지된 것)
// ─────────────────────────────────────────────────────────
POST   /api/content-items              // 나중에 읽기 추가
GET    /api/content-items              // 내 콘텐츠 목록 (status 필터)
PATCH  /api/content-items/:id          // 상태 변경 (archived 등)
DELETE /api/content-items/:id          // 삭제

// ─────────────────────────────────────────────────────────
// Digests
// ─────────────────────────────────────────────────────────
GET    /api/digests                    // 내 digest 목록
GET    /api/digests/today              // 오늘의 digest
GET    /api/digests/:id                // digest 상세
```

---

## Implementation Phases

| Phase | 항목 | 설명 |
|-------|------|------|
| **1** | DB Schema | 위 스키마 적용 |
| **1** | Content Items API | 나중에 읽기 CRUD |
| **1** | HTTP Fetcher | 기본 fetch |
| **1** | Basic Summarizer | Claude 단일 요약 |
| **2** | Subscriptions API | 구독 CRUD |
| **2** | Subscription Checker | HTML diff 기반 |
| **2** | Orchestrator + Scheduler | 전체 플로우 |
| **2** | Digest API | 통합 digest |
| **3** | API Fetcher | YouTube, RSS |
| **3** | Browser Fetcher | Playwright |
| **3** | Notifier | Push, Email |
| **3** | AI Diff | CSS selector 없이 AI로 감지 |

---

## Open Questions

- [ ] **User Settings**: digest 시간, personalized prompt 저장 위치?
- [ ] **Rate Limiting**: 동일 도메인 요청 제한?
- [ ] **Cost Control**: AI 토큰 사용량 제한?
- [ ] **Retention Policy**: history 테이블 보관 기간?

---

## References

- [이전 설계 논의](./2025-12-10_subscription-scheduler-design.md)
- [NestJS Schedule](https://docs.nestjs.com/techniques/task-scheduling)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
