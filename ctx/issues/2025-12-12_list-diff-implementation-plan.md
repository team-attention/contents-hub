# List Diff 구현 계획

> **Status**: Approved
> **Created**: 2025-12-12
> **Related**: [subscription-scheduler-design.md](./2025-12-10_subscription-scheduler-design.md)

---

## 1. 문제 정의

### URL만 저장하면 생기는 문제

```
현재 스키마:
subscriptions.url = "https://blog.example.com/posts"
subscriptions.lastContentHash = "abc123"

→ 전체 페이지 hash만으로는:
  - 무엇이 "리스트 아이템"인지 모름
  - 어떤 URL이 새로 추가되었는지 알 수 없음
  - 광고/날짜 변경으로 인한 false positive
```

### 필요한 것

1. **아이템 식별**: 어떤 요소가 리스트 아이템인지
2. **URL 추출**: 각 아이템의 링크
3. **변경 감지**: 이전 URL 목록과 비교

---

## 2. 해결책: Selector Picker + URL Anchor

### 핵심 아이디어

```
기존: Selector → URLs (selector 깨지면 끝)
새로운: Selector → URLs → (저장) → URLs로 역추적 → 새 Selector

URL은 콘텐츠의 identity - DOM 구조가 바뀌어도 /post/123 같은 URL은 안 바뀜
```

### Client UX

```
1. 사용자가 "Watch this page" 클릭
2. Selector Picker 모드 활성화
   - 마우스 hover 시 요소 하이라이트
   - 클릭 시 해당 영역의 selector 캡처
3. Server에 URL + Selector 전송
```

---

## 3. 전체 흐름

### 3.1 Initialize (구독 생성 시)

```
┌─────────────────────────────────────────────────────────┐
│ Client → Server: URL + Selector                         │
│                                                         │
│ Server:                                                 │
│ 1. fetch(URL)                                           │
│ 2. Selector로 리스트 컨테이너 찾기                        │
│ 3. 컨테이너 내 모든 <a href> 추출 → urls[]               │
│ 4. AI로 stableSelectors[] 추출                          │
│ 5. DOM 구조 → selectorHierarchy 생성                    │
│ 6. subscription_history에 저장                          │
│                                                         │
│ 실패 시 (아이템 0개):                                    │
│ → Error response, 사용자에게 재선택 요청                  │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Scheduler Check (주기적 체크)

```
┌─────────────────────────────────────────────────────────┐
│ 1. fetch(URL)                                           │
│ 2. 최신 subscription_history에서 urls 가져오기           │
│                                                         │
│ 3. URL 역추적 (1차 시도):                                │
│    urls[0] 찾기 → 없으면 urls[1] → ... → urls[n]        │
│    ├─ 하나라도 찾음 → LCA 찾기로                         │
│    └─ 전부 없음 → 2차 시도로                             │
│                                                         │
│ 4. Stable Selector (2차 시도, fallback):                │
│    stableSelectors[0] 시도 → ... → stableSelectors[n]  │
│    ├─ 성공 → LCA 찾기로                                 │
│    └─ 전부 실패 → status="broken", 종료                 │
│                                                         │
│ 5. LCA 찾기 (LLM):                                      │
│    - Input: 찾은 URL 위치 + selectorHierarchy           │
│    - 여러 컨테이너면 → 가장 많이 포함한 것 선택           │
│    - Output: LCA selector                               │
│                                                         │
│ 6. LCA 내에서 모든 URLs 추출                             │
│                                                         │
│ 7. Diff:                                                │
│    이전: [A, B, C, D, E]                                │
│    현재: [X, A, B, C, D]                                │
│    → 새 URL: X → content_items에 추가                   │
│                                                         │
│ 8. subscription_history에 새로 저장                      │
└─────────────────────────────────────────────────────────┘
```

---

## 4. 의사결정 사항

### 4.1 Status 추가

```typescript
// 기존
type SubscriptionStatus = "active" | "paused";

// 변경
type SubscriptionStatus = "active" | "paused" | "broken";

// paused: 사용자가 직접 일시정지
// broken: URL/Selector 못 찾아서 자동 정지 (에러 메시지 포함)
```

### 4.2 Stable Selector 용도

**결정**: URL 역추적 완전 실패 시 fallback으로 사용

```
1차: URL 역추적
     ↓ 실패
2차: stableSelectors로 시도
     ↓ 실패
status="broken" + 에러 메시지
```

### 4.3 LLM 호출 빈도

**결정**: 매번 호출 (비용 많이 나오면 그때 조정)

- LCA 찾기: 매 체크마다 LLM 호출
- Stable Selector 추출: Initialize 시에만

### 4.4 selectorHierarchy 형태

**결정**: DOM 구조화 (옵션 C)

```html
<!-- 저장 형태 예시 -->
<main class="content">
  <section class="posts">
    <article class="post-item">
      <a href="/post/1">Title 1</a>
    </article>
    <article class="post-item">
      <a href="/post/2">Title 2</a>
    </article>
  </section>
</main>
```

- DOM parser로 추출 & 구조화
- 불필요한 속성 제거, 텍스트 단순화

### 4.5 URL 매칭 규칙

**결정**: href exact match

```html
<a href="/post/1">...</a>
<a href="/post/1?ref=sidebar">...</a>
<!-- 위 두 개는 다른 URL로 취급 -->
```

- 쿼리스트링 포함하여 exact match
- 추후 필요시 정규화 로직 추가

### 4.6 리스트 정렬 가정

**결정**: 최신순 정렬 가정

- urls[0]이 가장 최신 글
- 삭제된 글은 고려 (역추적 시 없으면 다음 URL로)

### 4.7 페이지네이션

**결정**: TODO (나중에)

- MVP에서는 1페이지만 모니터링
- 데이터 보고 필요시 확장

---

## 5. DB 스키마 변경

### 5.1 subscriptions 테이블

```typescript
// status 타입 변경
status: text("status").$type<"active" | "paused" | "broken">()

// 새 컬럼 추가 (optional)
initialSelector: text("initial_selector"),  // 사용자가 선택한 원본 selector
```

### 5.2 subscription_history 테이블

```typescript
// 새 컬럼 추가
urls: jsonb("urls").$type<string[]>(),                    // 발견한 URL들 (최신순)
stableSelectors: jsonb("stable_selectors").$type<string[]>(), // AI가 추출한 안정적 selector들
selectorHierarchy: text("selector_hierarchy"),            // DOM 구조 (HTML 형태)
```

---

## 6. 파일 구조

```
apps/server/src/modules/
├── subscriptions/
│   ├── subscriptions.service.ts      # initialize 로직 추가
│   ├── subscriptions.controller.ts   # watch 엔드포인트 추가
│   └── dto/
│       ├── create-subscription.dto.ts
│       └── watch-subscription.dto.ts  # 새로 생성 (url + selector)
│
├── fetcher/
│   └── strategies/
│       └── list-diff.strategy.ts     # 새로 생성
│
└── ai/
    └── prompts/
        ├── find-lca.prompt.ts        # LCA 찾기 프롬프트
        └── extract-stable-selectors.prompt.ts  # Stable selector 추출
```

---

## 7. 구현 순서

| Phase | 작업 | 상세 |
|-------|-----|------|
| **1** | DB 스키마 변경 | status에 "broken" 추가, subscription_history 컬럼 추가 |
| **1** | DOM 파싱 라이브러리 | cheerio 또는 linkedom 설치 |
| **2** | List Diff Strategy | URL 추출, 역추적, selectorHierarchy 생성 |
| **2** | Initialize 로직 | URL + Selector → URLs, stableSelectors 추출 |
| **3** | LLM 프롬프트 | LCA 찾기, stable selector 추출 |
| **3** | Scheduler Check 로직 | URL 역추적 → Diff → content_items 추가 |
| **4** | Client Selector Picker | Extension에 UI 추가 |

---

## 8. Edge Cases

| Case | 처리 방법 |
|------|----------|
| **URL 전부 삭제됨** | 2차 fallback (stableSelectors) → 실패 시 broken |
| **URL 형식 변경** | exact match 실패 → 2차 fallback |
| **리스트가 여러 개** | LCA 찾을 때 "가장 많은 URL 포함하는 컨테이너" 선택 |
| **동적 로딩 (lazy load)** | 현재 미지원, 추후 Playwright 고려 |
| **사이드바 중복 URL** | LCA로 올바른 컨테이너 구분 |
| **순서만 변경** | URL 집합 비교로 새 URL만 감지 (순서 무시) |

---

## 9. LLM 프롬프트 설계 (초안)

### 9.1 LCA 찾기

```
Input:
- selectorHierarchy (DOM 구조)
- 찾은 URL들의 위치 (어떤 요소 안에 있는지)

Output:
- LCA selector (예: "section.posts")

Prompt:
"다음 HTML 구조에서 [URL1, URL2, URL3]를 포함하는 가장 가까운 공통 부모 요소의
CSS selector를 찾아주세요. 여러 컨테이너에 분산되어 있다면 가장 많은 URL을
포함하는 컨테이너를 선택하세요."
```

### 9.2 Stable Selector 추출

```
Input:
- selectorHierarchy (DOM 구조)
- 현재 사용 중인 selector

Output:
- stableSelectors[] (안정적인 selector 목록)

Prompt:
"다음 HTML 구조에서 리스트 컨테이너를 찾을 수 있는 안정적인 CSS selector들을
추출해주세요. 해시가 포함된 클래스명(예: sc-abc123, _1a2b3c)은 제외하고,
의미 있는 이름(post, article, entry 등)을 우선하세요."
```

---

## 10. Open Questions

- [ ] **Q1**: selectorHierarchy를 얼마나 단순화할지? (depth 제한? 속성 제거?)
- [ ] **Q2**: content_items에 추가할 때 source="subscription" 외에 다른 메타데이터?
- [ ] **Q3**: broken 상태에서 복구하는 UI/UX?

---

## References

- [subscription-scheduler-design.md](./2025-12-10_subscription-scheduler-design.md) - 초기 설계 문서
- Current schema: `apps/server/src/db/schema.ts`
