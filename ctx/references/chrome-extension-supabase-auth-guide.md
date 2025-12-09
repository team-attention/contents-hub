# Chrome Extension Supabase OAuth Guide

Complete guide for implementing Supabase Google OAuth in Chrome Extensions.

## Key Point: Use New Tab Instead of Popup

> **Important**: The traditional `chrome.identity.launchWebAuthFlow` (popup-based) approach is **unreliable** in Chrome Extensions.
> - OAuth callback fails if popup is closed
> - Authentication fails when user clicks outside the popup
> - `chromiumapp.org` URL is not a real website, making detection difficult
>
> **Solution**: Open a new tab and detect OAuth callback via `chrome.webNavigation` API in the background script.
>
> Reference: [beastx.ro - Supabase login with OAuth in Chrome extensions](https://beastx.ro/supabase-login-with-oauth-in-chrome-extensions)

## References

- [Supabase Official Docs - Google OAuth (Chrome Extensions)](https://supabase.com/docs/guides/auth/social-login/auth-google?queryGroups=platform&platform=chrome-extensions)
- [beastx.ro - Supabase login with OAuth in Chrome extensions](https://beastx.ro/supabase-login-with-oauth-in-chrome-extensions)

---

## Web App vs Chrome Extension Comparison

| Aspect | Web App | Chrome Extension |
|--------|---------|------------------|
| Redirect URL | `https://your-domain.com/auth/callback` | `https://<extension-id>.chromiumapp.org/` |
| OAuth Flow | Browser redirect | **New tab + background script detection** |
| Callback Handling | React Router | `chrome.webNavigation.onBeforeNavigate` |
| Session Storage | localStorage | chrome.storage.local (ChromeStorageAdapter) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Chrome Extension OAuth Flow                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. User clicks "Sign in with Google" (Popup)                       │
│           ↓                                                          │
│  2. supabase.auth.signInWithOAuth({                                 │
│       provider: "google",                                            │
│       options: { redirectTo, skipBrowserRedirect: true }            │
│     })                                                               │
│           ↓                                                          │
│  3. chrome.tabs.create({ url: data.url }) - Open new tab            │
│           ↓                                                          │
│  4. User authenticates with Google                                   │
│           ↓                                                          │
│  5. Redirect to: https://<ext-id>.chromiumapp.org/#access_token=... │
│           ↓                                                          │
│  6. Background script detects via chrome.webNavigation              │
│           ↓                                                          │
│  7. Extract tokens from URL hash, call setSession()                 │
│           ↓                                                          │
│  8. Close OAuth tab, session stored in chrome.storage               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

Implementation checklist that other agents can follow step by step:

### Phase 1: External Services Setup

#### Google Cloud Console
- [ ] APIs & Services → Credentials → Create Credentials → OAuth client ID
- [ ] Application type: Select **Web application** (NOT Chrome Extension type!)
- [ ] Add to Authorized redirect URIs:
  ```
  https://<YOUR-SUPABASE-PROJECT>.supabase.co/auth/v1/callback
  ```
- [ ] Copy Client ID and Client Secret

#### Supabase Dashboard
- [ ] Authentication → Providers → Google → Toggle Enable ON
- [ ] Enter Client ID (the value copied above)
- [ ] Enter Client Secret (the value copied above)
- [ ] Add to Authentication → URL Configuration → Redirect URLs:
  ```
  https://<YOUR-EXTENSION-ID>.chromiumapp.org/
  ```

### Phase 2: Extension Setup

#### manifest.json Permissions
- [ ] `"storage"` - for chrome.storage.local
- [ ] `"identity"` - for chrome.identity.getRedirectURL()
- [ ] `"tabs"` - for chrome.tabs.create/remove
- [ ] `"webNavigation"` - for OAuth callback detection (required!)

```json
{
  "permissions": ["activeTab", "storage", "identity", "tabs", "webNavigation"]
}
```

#### Extension ID Verification
- [ ] Build and load at `chrome://extensions`
- [ ] Check Extension ID (e.g., `bdjllndlkpkmeanafkkpiefafjbmnkbo`)
- [ ] Or check in console:
  ```javascript
  console.log(chrome.identity.getRedirectURL());
  // https://bdjllndlkpkmeanafkkpiefafjbmnkbo.chromiumapp.org/
  ```

### Phase 3: Code Implementation

#### File Creation Order
- [ ] `src/lib/chrome-storage-adapter.ts` - Storage adapter for Supabase
- [ ] `src/lib/supabase.ts` - Supabase client (using ChromeStorageAdapter)
- [ ] `src/lib/auth.ts` - signInWithGoogle, handleOAuthCallback, signOut
- [ ] `src/background/index.ts` - Add webNavigation listener

#### auth.ts Key Points
- [ ] Use `supabase.auth.signInWithOAuth()` (do not construct URL manually)
- [ ] `skipBrowserRedirect: true` option is required
- [ ] Open new tab with `chrome.tabs.create({ url: data.url })`
- [ ] Extract tokens from URL hash in `handleOAuthCallback()`

#### background/index.ts Key Points
- [ ] Use `chrome.webNavigation.onBeforeNavigate` (NOT tabs.onUpdated!)
- [ ] URL filter option: `{ url: [{ urlPrefix: redirectUrl }] }`
- [ ] Check for `access_token` presence
- [ ] Close tab with `chrome.tabs.remove(details.tabId)` after callback handling

### Phase 4: Testing

#### Chrome API Mock Setup (test/setup.ts)
- [ ] `chrome.identity.getRedirectURL` mock
- [ ] `chrome.tabs.create` mock
- [ ] `chrome.tabs.remove` mock
- [ ] `chrome.webNavigation.onBeforeNavigate.addListener` mock

#### Manual Testing
- [ ] Build and load extension
- [ ] Click "Login with Google"
- [ ] Complete Google login in new tab
- [ ] Verify tab closes automatically after login
- [ ] Verify logged in state in extension popup

#### Background Script Debugging
- [ ] `chrome://extensions` → Click Service Worker link
- [ ] Check logs in Console:
  ```
  ✅ "Listening for redirect URL: https://xxx.chromiumapp.org/"
  ✅ "Navigation detected: https://xxx.chromiumapp.org/#access_token=..."
  ✅ "OAuth callback detected: ..."
  ✅ "OAuth callback handled successfully"
  ✅ "Auth state changed: SIGNED_IN user@email.com"
  ```

---

## Implementation Code

### 1. Chrome Storage Adapter

Store Supabase session in `chrome.storage.local`:

```typescript
// src/lib/chrome-storage-adapter.ts
export class ChromeStorageAdapter {
  async getItem(key: string): Promise<string | null> {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async removeItem(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }
}
```

### 2. Supabase Client

```typescript
// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
import { ChromeStorageAdapter } from "./chrome-storage-adapter";
import { env } from "./env";

const storage = new ChromeStorageAdapter();

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important: must be false for Extensions
  },
});
```

### 3. Auth Functions

```typescript
// src/lib/auth.ts
import { supabase } from "./supabase";

export async function signInWithGoogle(): Promise<void> {
  const redirectUrl = chrome.identity.getRedirectURL();

  const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true, // Important: prevent automatic redirect
    },
  });

  if (oauthError) throw oauthError;
  if (!data.url) throw new Error("No OAuth URL returned");

  // Open OAuth page in new tab (background script handles callback)
  await chrome.tabs.create({ url: data.url });
}

export async function handleOAuthCallback(url: string): Promise<void> {
  const hashParams = new URLSearchParams(new URL(url).hash.slice(1));

  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");

  if (!accessToken || !refreshToken) {
    const error = hashParams.get("error_description") || hashParams.get("error");
    throw new Error(error || "Failed to get authentication tokens");
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
```

### 4. Background Script

```typescript
// src/background/index.ts
import { handleOAuthCallback } from "../lib/auth";
import { supabase } from "../lib/supabase";

console.log("Background service worker started");

// Detect OAuth callback redirect
const redirectUrl = chrome.identity.getRedirectURL();
console.log("Listening for redirect URL:", redirectUrl);

chrome.webNavigation.onBeforeNavigate.addListener(
  async (details) => {
    console.log("Navigation detected:", details.url);

    if (details.url?.startsWith(redirectUrl) && details.url.includes("access_token")) {
      console.log("OAuth callback detected:", details.url);

      try {
        await handleOAuthCallback(details.url);
        console.log("OAuth callback handled successfully");

        // Close OAuth tab
        await chrome.tabs.remove(details.tabId);
      } catch (error) {
        console.error("OAuth callback error:", error);
      }
    }
  },
  {
    url: [{ urlPrefix: redirectUrl }], // Optimize performance with URL filter
  }
);

// Auth state change listener
supabase.auth.onAuthStateChange((event, session) => {
  console.log("Auth state changed:", event, session?.user?.email);

  // Broadcast to all extension pages
  chrome.runtime.sendMessage({
    type: "AUTH_STATE_CHANGE",
    event,
    session,
  }).catch(() => {
    // Ignore error when no listener
  });
});
```

---

## Troubleshooting

### 1. "Authorization page could not be loaded"

**Cause**: Missing required parameters when manually constructing OAuth URL

**Incorrect Code**:
```typescript
// ❌ Do not do this
const authUrl = new URL(`${SUPABASE_URL}/auth/v1/authorize`);
authUrl.searchParams.set("provider", "google");
authUrl.searchParams.set("redirect_to", redirectUrl);
```

**Correct Code**:
```typescript
// ✅ Use Supabase SDK
const { data } = await supabase.auth.signInWithOAuth({
  provider: "google",
  options: {
    redirectTo: redirectUrl,
    skipBrowserRedirect: true,
  },
});
// Use data.url
```

### 2. "This site can't be reached" (chromiumapp.org)

**Cause**: `chrome.tabs.onUpdated` does not detect virtual URLs

**Incorrect Code**:
```typescript
// ❌ chromiumapp.org is not a real site, so event does not fire
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url?.startsWith(redirectUrl)) {
    // Never reached!
  }
});
```

**Correct Code**:
```typescript
// ✅ Use webNavigation.onBeforeNavigate
chrome.webNavigation.onBeforeNavigate.addListener(
  async (details) => {
    if (details.url?.startsWith(redirectUrl)) {
      // Works correctly!
    }
  },
  { url: [{ urlPrefix: redirectUrl }] }
);
```

**Required Permissions**:
```json
{
  "permissions": ["webNavigation"]
}
```

### 3. "Unsupported provider: missing OAuth secret"

**Cause**: Google OAuth Client Secret is not set in Supabase

**Solution**:
1. Create OAuth Client of type **Web Application** in Google Cloud Console
2. Copy Client ID and Client Secret
3. Enter in Supabase Dashboard → Authentication → Providers → Google

> Chrome Extension type OAuth Client does not have a Secret, so a separate Web Application Client is required for Supabase

### 4. OAuth fails when Popup is closed

**Cause**: `chrome.identity.launchWebAuthFlow` callback fails if popup is closed

**Solution**: Use New Tab method (method used in this guide)

```typescript
// ❌ Fails if popup receives focus loss or closes
const responseUrl = await chrome.identity.launchWebAuthFlow({
  url: authUrl,
  interactive: true,
});

// ✅ New tab is independent of popup
await chrome.tabs.create({ url: data.url });
// background script handles callback
```

### 5. Session not saved

**Cause**: Need to use chrome.storage instead of localStorage

**Solution**: Use ChromeStorageAdapter (see implementation above)

---

## Debugging Guide

### Check Background Script Logs

1. Open `chrome://extensions`
2. Find Contents Hub extension
3. Click **Service Worker** link
4. Check logs in Console tab

### Logs to Verify

```
✅ "Contents Hub background service worker started"
✅ "Listening for redirect URL: https://xxx.chromiumapp.org/"
✅ "Navigation detected: https://xxx.chromiumapp.org/#access_token=..."
✅ "OAuth callback detected: ..."
✅ "OAuth callback handled successfully"
✅ "Auth state changed: SIGNED_IN user@email.com"
```

---

## Full File Structure

```
apps/extension/
├── manifest.json                    # permissions setup
├── src/
│   ├── background/
│   │   └── index.ts                 # OAuth callback detection
│   ├── lib/
│   │   ├── auth.ts                  # signInWithGoogle, handleOAuthCallback
│   │   ├── supabase.ts              # Supabase client with ChromeStorageAdapter
│   │   ├── chrome-storage-adapter.ts
│   │   └── env.ts
│   ├── components/
│   │   └── SignIn.tsx               # Login button UI
│   └── popup/
│       └── Popup.tsx
└── test/
    └── setup.ts                     # Chrome API mocks
```

---

## Summary

| Phase | Key Point |
|-------|-----------|
| 1. GCP Setup | Chrome Extension type + Web Application type (for Supabase) |
| 2. Supabase Setup | Add `chromiumapp.org` to Redirect URL |
| 3. manifest.json | `webNavigation` permission required |
| 4. Start OAuth | `signInWithOAuth` + `skipBrowserRedirect: true` |
| 5. Open New Tab | Use `chrome.tabs.create` |
| 6. Detect Callback | `chrome.webNavigation.onBeforeNavigate` |
| 7. Save Session | `supabase.auth.setSession` + ChromeStorageAdapter |
