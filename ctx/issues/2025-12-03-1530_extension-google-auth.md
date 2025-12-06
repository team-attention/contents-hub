---
title: Add Google OAuth authentication to Chrome extension
source: local
provider: local
created_at: 2025-12-03T06:30:00Z
updated_at: 2025-12-03T14:20:34Z
status: in_progress
git_branch: "issue-2025-12-03-1530_extension-google-auth"
---

# Spec

Chrome Extension에서 Google OAuth 로그인 구현 (Supabase 연동)

## Reference

- `ctx/references/supabase-react-google-oauth-guide.md` - Supabase OAuth 기본 가이드
- Chrome Extension OAuth: `chrome.identity.launchWebAuthFlow` API 사용

## Overview

Chrome Extension에서는 일반 웹앱과 달리 redirect 방식의 OAuth를 직접 사용할 수 없음.
`chrome.identity.launchWebAuthFlow`를 사용하여 OAuth를 처리하고,
받은 토큰으로 Supabase session을 생성해야 함.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Chrome Extension OAuth Flow                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. User clicks "Sign in with Google" in popup                      │
│           ↓                                                         │
│  2. chrome.identity.launchWebAuthFlow() opens auth window           │
│           ↓                                                         │
│  3. User authenticates with Google                                  │
│           ↓                                                         │
│  4. Redirect to Supabase callback URL                               │
│           ↓                                                         │
│  5. Extract tokens from redirect URL                                │
│           ↓                                                         │
│  6. supabase.auth.setSession() with tokens                          │
│           ↓                                                         │
│  7. Store session in chrome.storage.local                           │
│           ↓                                                         │
│  8. Extension is now authenticated                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Q&A

**Q: Supabase Dashboard에 Google OAuth provider가 이미 설정되어 있나요?**
A: Yes - 이미 설정됨

**Q: Extension 로그인 후 어떤 화면을 보여줄 건가요?**
A: 사용자 정보 표시 추가 (프로필 이미지, 이메일 등) + 기존 구독 UI

**Q: 로그아웃 버튼이 필요한가요?**
A: Yes - Popup에 로그아웃 버튼 추가

## Requirements

### Core Authentication
- [ ] Google OAuth login via `chrome.identity.launchWebAuthFlow`
- [ ] Supabase session creation from OAuth tokens
- [ ] Session persistence using `chrome.storage.local`
- [ ] Auto session refresh handling
- [ ] Logout functionality

### UI Components
- [ ] Sign-in screen (when not authenticated)
- [ ] User profile display (avatar, email) when authenticated
- [ ] Logout button
- [ ] Authenticated popup view with subscription UI
- [ ] Loading states during auth flow

### Background Service Worker
- [ ] Handle auth state changes
- [ ] Token refresh in background
- [ ] Sync auth state across popup/content scripts

## Technical Considerations

### Chrome Extension Specific

1. **Manifest V3 Permissions Required**
   ```json
   {
     "permissions": ["identity", "storage"]
   }
   ```

2. **launchWebAuthFlow**
   - Works with Supabase redirect flow
   - Use `chrome.identity.getRedirectURL()` for dynamic redirect URL
   - Redirect URL format: `https://<extension-id>.chromiumapp.org/`

3. **Storage**
   - `chrome.storage.local`: Persists across browser sessions
   - Required because service workers don't have localStorage access

### Supabase Integration

1. **OAuth Flow with Extension**
   - Build OAuth URL manually with Supabase credentials
   - Use `launchWebAuthFlow` to handle the OAuth dance
   - Parse access_token/refresh_token from redirect URL fragment
   - Set session via `supabase.auth.setSession()`

2. **Token Storage Strategy**
   - Store in `chrome.storage.local`
   - Create custom storage adapter for Supabase client

---

# Implementation Plan

_Generated at 2025-12-03T14:20:34Z_

## Q&A

**Q: Should we use inline styles (current pattern) or add Tailwind CSS for auth UI components?**
A: Add Tailwind CSS - better styling experience, consistent with client app approach.

## Phases

### Phase 1: Dependencies & Configuration

**Step 1: Install dependencies**
- [ ] `pnpm add @supabase/supabase-js -F extension`
- [ ] `pnpm add -D tailwindcss @tailwindcss/vite -F extension`

**Step 2: Configure Tailwind CSS**
- [ ] Update `vite.config.ts` to add `@tailwindcss/vite` plugin
- [ ] Create `src/index.css` with `@import "tailwindcss"`
- [ ] Import CSS in popup entry point (`src/popup/index.tsx`)

**Step 3: Update manifest.json**
- [ ] Add `identity` permission for `chrome.identity.launchWebAuthFlow`
- [ ] Keep existing `storage` permission (already present)

**Step 4: Environment setup**
- [ ] Create `.env.example` for extension
- [ ] Configure Vite to handle `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Create `src/lib/env.ts` for type-safe env access

### Phase 2: Supabase Client Setup

**Step 5: Create Chrome storage adapter**
- [ ] Implement `ChromeStorageAdapter` class in `src/lib/chrome-storage-adapter.ts`
- [ ] Wrap `chrome.storage.local` with Promise-based async interface
- [ ] Implement `getItem`, `setItem`, `removeItem` methods matching Supabase storage interface

**Step 6: Initialize Supabase client**
- [ ] Create `src/lib/supabase.ts` with custom storage adapter
- [ ] Configure `autoRefreshToken: true`, `persistSession: true`
- [ ] Use `ChromeStorageAdapter` as storage backend

### Phase 3: OAuth Flow Implementation

**Step 7: Create Google OAuth flow**
- [ ] Create `src/lib/auth.ts` with OAuth utilities
- [ ] Implement `signInWithGoogle()`:
  - Build Supabase OAuth URL with `provider=google`
  - Use `chrome.identity.launchWebAuthFlow({ interactive: true })`
  - Parse `access_token` and `refresh_token` from redirect URL hash fragment
  - Call `supabase.auth.setSession()` with parsed tokens
- [ ] Implement `signOut()` function
- [ ] Handle error cases (user cancellation, network errors)

**Step 8: Create auth state hook**
- [ ] Create `src/hooks/useAuth.ts`
- [ ] Use `useState` for session/user state
- [ ] Use `useEffect` to:
  - Initialize session from storage on mount
  - Subscribe to `supabase.auth.onAuthStateChange`
- [ ] Return `{ user, session, isLoading, signInWithGoogle, signOut }`

### Phase 4: UI Components

**Step 9: Create SignIn component**
- [ ] Create `src/components/SignIn.tsx`
- [ ] Google sign-in button with Google logo/icon
- [ ] Loading spinner during auth flow
- [ ] Error message display

**Step 10: Create UserProfile component**
- [ ] Create `src/components/UserProfile.tsx`
- [ ] Display user avatar (from `user.user_metadata.avatar_url`)
- [ ] Display user email
- [ ] Logout button with confirmation

**Step 11: Update Popup component**
- [ ] Integrate `useAuth` hook
- [ ] Show loading state during initial auth check
- [ ] Show `SignIn` when not authenticated
- [ ] Show `UserProfile` + subscription UI when authenticated
- [ ] Convert existing inline styles to Tailwind classes

### Phase 5: Background Service Worker

**Step 12: Add auth handling to background**
- [ ] Initialize Supabase client in background worker
- [ ] Listen for `chrome.runtime.onMessage` for auth-related messages
- [ ] Handle token refresh proactively before expiration
- [ ] Broadcast auth state changes to popup via messages

## Files to Create

| File | Purpose |
|------|---------|
| `apps/extension/src/lib/env.ts` | Type-safe environment variable access |
| `apps/extension/src/lib/chrome-storage-adapter.ts` | Storage adapter for `chrome.storage.local` |
| `apps/extension/src/lib/supabase.ts` | Supabase client configured for extension |
| `apps/extension/src/lib/auth.ts` | OAuth flow utilities (signIn, signOut) |
| `apps/extension/src/hooks/useAuth.ts` | React hook for auth state management |
| `apps/extension/src/components/SignIn.tsx` | Sign-in UI with Google button |
| `apps/extension/src/components/UserProfile.tsx` | User profile with logout |
| `apps/extension/src/index.css` | Tailwind CSS entry point |
| `apps/extension/.env.example` | Environment variable template |

## Files to Modify

| File | Changes |
|------|---------|
| `apps/extension/manifest.json` | Add `identity` permission |
| `apps/extension/package.json` | Add `@supabase/supabase-js`, `tailwindcss`, `@tailwindcss/vite` |
| `apps/extension/vite.config.ts` | Add Tailwind plugin |
| `apps/extension/src/popup/index.tsx` | Import CSS file |
| `apps/extension/src/popup/Popup.tsx` | Integrate auth, convert to Tailwind |
| `apps/extension/src/background/index.ts` | Add auth handling, token refresh |

## Files/Objects to Reuse

| Source | Usage |
|--------|-------|
| `ctx/references/supabase-react-google-oauth-guide.md` | Reference for Supabase auth patterns |
| `apps/server/src/env.ts` | Pattern for env validation (adapt for client) |

## Technical Notes

### Chrome Extension OAuth Specifics
- `chrome.identity.launchWebAuthFlow` requires `identity` permission
- Redirect URL format: `https://<extension-id>.chromiumapp.org/`
- Use `chrome.identity.getRedirectURL()` to get dynamic redirect URL
- Must register redirect URL in Supabase Dashboard > Authentication > URL Configuration

### Token Parsing from Redirect URL
The redirect URL contains tokens in the hash fragment:
```
https://xxx.chromiumapp.org/#access_token=xxx&refresh_token=xxx&...
```
Parse using `URLSearchParams` on the hash portion.

### Storage Considerations
- Service workers don't have `localStorage` access
- Must use `chrome.storage.local` which is async
- Supabase client needs custom storage adapter wrapping `chrome.storage.local`

### Session Flow
1. User clicks "Sign in with Google"
2. `launchWebAuthFlow` opens Google OAuth popup
3. User authenticates with Google
4. Supabase handles OAuth callback, generates tokens
5. Extension extracts tokens from redirect URL
6. `supabase.auth.setSession()` stores session
7. Session persisted in `chrome.storage.local`
8. Background worker handles token refresh

### Edge Cases
- Handle user canceling OAuth flow
- Handle network errors during auth
- Handle expired/invalid tokens gracefully
- Support multiple tabs/popups sharing auth state

---

## Phase 6: Testing

**Step 13: Unit tests for auth utilities**
- [ ] Create `src/lib/__tests__/chrome-storage-adapter.test.ts`
  - Mock `chrome.storage.local` API
  - Test `getItem`, `setItem`, `removeItem` methods
  - Test error handling scenarios
- [ ] Create `src/lib/__tests__/auth.test.ts`
  - Mock `chrome.identity.launchWebAuthFlow`
  - Test OAuth URL construction
  - Test token parsing from redirect URL
  - Test error handling (user cancel, network error)

**Step 14: Component tests**
- [ ] Create `src/components/__tests__/SignIn.test.tsx`
  - Test Google sign-in button renders
  - Test loading state during auth flow
  - Test error message display
  - Test sign-in click handler
- [ ] Create `src/components/__tests__/UserProfile.test.tsx`
  - Test avatar and email display
  - Test logout button functionality
- [ ] Create `src/popup/__tests__/Popup.test.tsx`
  - Test unauthenticated state (shows SignIn)
  - Test authenticated state (shows UserProfile + subscription UI)
  - Test loading state

**Step 15: Hook tests**
- [ ] Create `src/hooks/__tests__/useAuth.test.ts`
  - Test initial loading state
  - Test session restoration from storage
  - Test auth state change subscription
  - Test signInWithGoogle and signOut functions

**Step 16: E2E test setup (optional)**
- [ ] Add Playwright extension testing config if needed
- [ ] Create basic E2E test for popup rendering

## Test Files to Create

| File | Purpose |
|------|---------|
| `apps/extension/src/lib/__tests__/chrome-storage-adapter.test.ts` | Storage adapter unit tests |
| `apps/extension/src/lib/__tests__/auth.test.ts` | OAuth flow unit tests |
| `apps/extension/src/components/__tests__/SignIn.test.tsx` | SignIn component tests |
| `apps/extension/src/components/__tests__/UserProfile.test.tsx` | UserProfile component tests |
| `apps/extension/src/popup/__tests__/Popup.test.tsx` | Popup integration tests |
| `apps/extension/src/hooks/__tests__/useAuth.test.ts` | Auth hook tests |

## Test Dependencies

Extension package.json에 추가할 테스트 의존성:
```json
{
  "devDependencies": {
    "@testing-library/react": "^14.x",
    "@testing-library/jest-dom": "^6.x",
    "vitest": "^1.x",
    "jsdom": "^24.x"
  }
}
```

## Chrome API Mocking Strategy

테스트에서 Chrome Extension API를 모킹하기 위한 전략:
```typescript
// test/setup.ts
global.chrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
  identity: {
    launchWebAuthFlow: vi.fn(),
    getRedirectURL: vi.fn(() => 'https://test-extension-id.chromiumapp.org/'),
  },
  runtime: {
    onMessage: { addListener: vi.fn() },
    sendMessage: vi.fn(),
  },
};
```
