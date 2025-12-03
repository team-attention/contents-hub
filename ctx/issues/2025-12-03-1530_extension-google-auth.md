---
title: Add Google OAuth authentication to Chrome extension
source: local
provider: local
created_at: 2025-12-03T06:30:00Z
updated_at: 2025-12-03T06:30:00Z
status: draft
git_branch: ""
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

_To be generated after spec approval_

## Phases (draft)

### Phase 1: Dependencies & Configuration

**Step 1: Install Supabase client**
- [ ] `pnpm add @supabase/supabase-js -F extension`

**Step 2: Update manifest.json**
- [ ] Add `identity` permission

**Step 3: Environment setup**
- [ ] Create env configuration for SUPABASE_URL, SUPABASE_KEY
- [ ] Handle env vars in Vite build

### Phase 2: Supabase Client Setup

**Step 4: Create custom storage adapter**
- [ ] Implement `chrome.storage.local` based storage adapter
- [ ] Handle async storage operations

**Step 5: Initialize Supabase client**
- [ ] Create `lib/supabase.ts` with custom storage
- [ ] Configure for extension environment

### Phase 3: Auth Implementation

**Step 6: Implement OAuth flow**
- [ ] Create `auth/google-auth.ts` with `launchWebAuthFlow` logic
- [ ] Build Supabase OAuth URL
- [ ] Parse tokens from redirect URL
- [ ] Set session in Supabase client

**Step 7: Auth state management**
- [ ] Create auth state hook for popup
- [ ] Handle loading, authenticated, unauthenticated states
- [ ] Implement logout

### Phase 4: UI Updates

**Step 8: Create SignIn component**
- [ ] Google sign-in button
- [ ] Loading state during auth
- [ ] Error handling

**Step 9: Create UserProfile component**
- [ ] Display avatar image
- [ ] Display email
- [ ] Logout button

**Step 10: Update Popup component**
- [ ] Show SignIn when not authenticated
- [ ] Show UserProfile + subscription UI when authenticated

### Phase 5: Background Service Worker

**Step 11: Auth handling in background**
- [ ] Listen for auth state changes
- [ ] Handle token refresh

## Files to Create

- `apps/extension/src/lib/supabase.ts` - Supabase client with custom storage
- `apps/extension/src/lib/chrome-storage-adapter.ts` - Storage adapter for chrome.storage
- `apps/extension/src/auth/google-auth.ts` - OAuth flow implementation
- `apps/extension/src/hooks/use-auth.ts` - Auth state hook
- `apps/extension/src/components/SignIn.tsx` - Sign-in UI component
- `apps/extension/src/components/UserProfile.tsx` - User profile with logout

## Files to Modify

- `apps/extension/manifest.json` - Add identity permission
- `apps/extension/src/popup/Popup.tsx` - Integrate auth check, show user info
- `apps/extension/src/background/index.ts` - Add auth state handling
- `apps/extension/package.json` - Add @supabase/supabase-js

## Setup Notes

- Chrome extension redirect URL (`https://<extension-id>.chromiumapp.org/`)을 Supabase Dashboard > Authentication > URL Configuration에 추가 필요
- Development 중 extension ID가 변경될 수 있으므로 `chrome.identity.getRedirectURL()` 사용 권장
