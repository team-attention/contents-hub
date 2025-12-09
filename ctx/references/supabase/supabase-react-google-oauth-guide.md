# Supabase Google OAuth in React

A comprehensive guide for implementing Google OAuth login with Supabase in a React (Vite) application.

## Overview

This guide covers how to implement Google OAuth authentication using Supabase in a React application with:
- TanStack Query for state management
- React Router for navigation
- Error boundaries for auth protection

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           User Flow                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Click "Sign in with Google"                                     │
│           ↓                                                         │
│  2. supabase.auth.signInWithOAuth({ provider: "google" })          │
│           ↓                                                         │
│  3. Redirect to Google OAuth consent screen                        │
│           ↓                                                         │
│  4. Google redirects back to /auth/callback                        │
│           ↓                                                         │
│  5. Callback page retrieves session via getSession()               │
│           ↓                                                         │
│  6. Redirect to app (session stored in localStorage)               │
│           ↓                                                         │
│  7. API calls include Bearer token from session                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Dependencies

```bash
pnpm add @supabase/supabase-js @tanstack/react-query react-router react-error-boundary
```

### Environment Variables

```env
# Vite uses VITE_ prefix for client-side env vars
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-anon-public-key
```

### Supabase Dashboard Setup

1. Go to **Authentication > Providers > Google**
2. Enable Google provider
3. Add your Google OAuth credentials (Client ID & Secret)
4. Configure redirect URLs: `https://your-domain.com/auth/callback`

---

## Project Structure

```
src/
├── lib/
│   └── supabase.ts              # Supabase client & utilities
├── api/
│   └── client.ts                # API client with token injection
├── hooks/
│   └── auth/
│       └── use-user.ts          # User state hook
├── components/
│   ├── shared/
│   │   └── auth-boundary.tsx    # Error boundary for auth
│   └── app/
│       └── app-layout.tsx       # Protected layout wrapper
├── routes/
│   └── auth/
│       ├── components/
│       │   └── sign-in-with-google-button.tsx
│       ├── sign-in/
│       │   └── signin-page.tsx
│       └── callback/
│           └── callback-page.tsx
└── App.tsx
```

---

## Step 1: Supabase Client Setup

```typescript
// src/lib/supabase.ts
import { createClient, type User } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: true,   // Automatically refresh tokens before expiration
    persistSession: true,     // Store session in localStorage
  },
});

// Helper to get current session
export async function getAuthSession() {
  return supabase.auth.getSession().then((res) => res.data.session);
}

// Sign out and redirect
export async function signout() {
  await supabase.auth.signOut();
  window.location.href = "/auth/signin";
}

// Detect if user just signed up (heuristic)
// Note: Supabase doesn't provide this info directly
export function checkIsNewUser(user: User): boolean {
  const createdAt = new Date(user.created_at).getTime();
  const lastSignInAt = new Date(user.last_sign_in_at ?? user.created_at).getTime();
  const diffSeconds = Math.abs(createdAt - lastSignInAt) / 1000;
  return diffSeconds <= 5; // New user if sign-in within 5 seconds of creation
}
```

### Configuration Options Explained

| Option | Purpose |
|--------|---------|
| `autoRefreshToken: true` | Automatically refreshes JWT before expiration |
| `persistSession: true` | Stores session in localStorage for page reload persistence |

---

## Step 2: Google Sign-In Button

```typescript
// src/routes/auth/components/sign-in-with-google-button.tsx
import { supabase } from "@/lib/supabase";

interface SignInWithGoogleButtonProps {
  className?: string;
  text?: string;
  redirectTo?: string;
}

export function SignInWithGoogleButton({
  className,
  text,
  redirectTo,
}: SignInWithGoogleButtonProps) {
  const handleOAuthSignIn = () =>
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo ?? `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: "select_account", // Always show account picker
        },
      },
    });

  return (
    <button className={className} onClick={handleOAuthSignIn}>
      <GoogleIcon />
      {text ?? "Sign in with Google"}
    </button>
  );
}
```

### Key Options

| Option | Purpose |
|--------|---------|
| `provider: "google"` | Use Google as OAuth provider |
| `redirectTo` | Where to redirect after OAuth completes |
| `prompt: "select_account"` | Force Google account selection dialog |

---

## Step 3: OAuth Callback Handler

```typescript
// src/routes/auth/callback/callback-page.tsx
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { supabase, checkIsNewUser } from "@/lib/supabase";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;

        if (!session) {
          navigate("/auth/signin");
          return;
        }

        // Track signup vs signin (optional)
        const isNewUser = checkIsNewUser(session.user);
        if (isNewUser) {
          // Track signup event
          console.log("New user signed up:", session.user.email);
        } else {
          // Track signin event
          console.log("User signed in:", session.user.email);
        }

        // Redirect to original URL or home
        if (redirectUrl) {
          window.location.href = redirectUrl;
        } else {
          navigate("/");
        }
      } catch (error) {
        console.error("Auth callback error:", error);
        navigate("/auth/signin");
      }
    };

    handleCallback();
  }, [navigate, redirectUrl]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner />
    </div>
  );
}
```

### Callback Flow

1. User returns from Google OAuth
2. Supabase handles the token exchange automatically
3. `getSession()` retrieves the new session
4. App redirects user to their destination

---

## Step 4: User State Hook

```typescript
// src/hooks/auth/use-user.ts
import { useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { User as SupabaseUser, UserIdentity } from "@supabase/supabase-js";

// Extend Supabase user type with your app's fields
export interface User extends SupabaseUser {
  user_metadata: {
    name?: string;
    avatar_url?: string;
    picture?: string;
  };
  identities?: UserIdentity[];
}

export function useUser() {
  const { data } = useSuspenseQuery<User | null>({
    queryKey: useUser.queryKey(),
    queryFn: () =>
      supabase.auth.getUser().then((res) => res.data.user as User),
  });

  if (data == null) {
    throw new AuthError("Unauthorized");
  }

  return { data };
}

// Static query key for cache invalidation
useUser.queryKey = () => ["user"];

// Custom error for auth failures
export class AuthError extends Error {
  redirectUrl?: string;

  constructor(message: string, redirectUrl?: string) {
    super(message);
    this.name = "AuthError";
    this.redirectUrl = redirectUrl;
  }

  static is(error: unknown): error is AuthError {
    return error instanceof AuthError;
  }
}
```

### Key Points

- Uses TanStack Query's `useSuspenseQuery` for Suspense integration
- Throws `AuthError` when user is not authenticated
- Static `queryKey` method enables easy cache invalidation

---

## Step 5: API Client with Token Injection

```typescript
// src/api/client.ts
import { supabase } from "@/lib/supabase";

const API_BASE = import.meta.env.VITE_API_BASE;

async function getHeaders(headers?: HeadersInit): Promise<HeadersInit> {
  const session = (await supabase.auth.getSession()).data.session;
  const accessToken = session?.access_token;

  return {
    ...headers,
    ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
  };
}

export async function apiClient<T>(
  url: string,
  options: RequestInit
): Promise<T> {
  const requestHeaders = await getHeaders(options.headers);

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: requestHeaders,
  });

  if (response.status === 401) {
    throw new AuthError("Unauthorized", window.location.href);
  }

  if (!response.ok) {
    throw new Error(response.statusText);
  }

  return response.json();
}

export class AuthError extends Error {
  redirectUrl?: string;

  constructor(message: string, redirectUrl?: string) {
    super(message);
    this.name = "AuthError";
    this.redirectUrl = redirectUrl;
  }

  static is(error: unknown): error is AuthError {
    return error instanceof AuthError;
  }
}
```

### Token Flow

1. Every API call retrieves current session
2. Access token is injected as `Authorization: Bearer` header
3. Supabase's `autoRefreshToken` handles token refresh automatically
4. 401 responses throw `AuthError` caught by error boundary

---

## Step 6: Auth Error Boundary

```typescript
// src/components/shared/auth-boundary.tsx
import { ErrorBoundary } from "react-error-boundary";
import { AuthError } from "@/api/client";

export function AuthBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallbackRender={({ error }) => {
        if (AuthError.is(error)) {
          const redirectUrl = error.redirectUrl;

          // Avoid redirect loops for auth pages
          if (!redirectUrl || redirectUrl.includes("/auth/")) {
            window.location.href = "/auth/signin";
            return null;
          }

          // Preserve original URL for post-login redirect
          window.location.href = `/auth/signin?redirect_url=${encodeURIComponent(redirectUrl)}`;
          return null;
        }

        // Re-throw non-auth errors
        throw error;
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
```

---

## Step 7: Protected Layout

```typescript
// src/components/app/app-layout.tsx
import { Suspense } from "react";
import { Outlet } from "react-router";
import { ErrorBoundary } from "react-error-boundary";
import { useUser } from "@/hooks/auth/use-user";

export function AppLayout() {
  return (
    <>
      {/* Auth check runs in Suspense boundary */}
      <ErrorBoundary fallbackRender={() => null}>
        <Suspense fallback={null}>
          <AuthCheck />
        </Suspense>
      </ErrorBoundary>

      <Sidebar />
      <main>
        <Outlet />
      </main>
    </>
  );
}

function AuthCheck() {
  // This throws AuthError if user is not authenticated
  const { data: user } = useUser();

  // Optional: Set up error tracking context
  // setupUserContext(user);

  return null;
}
```

### How Protection Works

1. `AppLayout` wraps protected routes
2. `AuthCheck` component calls `useUser()` hook
3. If no user, `AuthError` is thrown
4. `AuthBoundary` catches error and redirects to sign-in

---

## Step 8: App Setup

```typescript
// src/App.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router";
import { AuthBoundary } from "@/components/shared/auth-boundary";
import { AppLayout } from "@/components/app/app-layout";
import { AuthCallbackPage } from "@/routes/auth/callback/callback-page";
import { SignInPage } from "@/routes/auth/sign-in/signin-page";
import { HomePage } from "@/routes/home/home-page";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBoundary>
        <BrowserRouter>
          <Routes>
            {/* Public auth routes */}
            <Route path="/auth/signin" element={<SignInPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />

            {/* Protected routes */}
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomePage />} />
              {/* Add more protected routes here */}
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthBoundary>
    </QueryClientProvider>
  );
}

export default App;
```

---

## Step 9: Auth State Change Listener (Optional)

Listen for auth state changes globally (useful for analytics, multi-tab sync):

```typescript
// src/lib/auth-listener.ts
import { supabase } from "@/lib/supabase";

export function initAuthListener() {
  supabase.auth.onAuthStateChange((event, session) => {
    switch (event) {
      case "SIGNED_IN":
        console.log("User signed in:", session?.user.email);
        // Track with analytics
        // mixpanel.identify(session?.user.id);
        break;

      case "SIGNED_OUT":
        console.log("User signed out");
        // Clear analytics identity
        // mixpanel.reset();
        break;

      case "TOKEN_REFRESHED":
        console.log("Token refreshed");
        break;

      case "USER_UPDATED":
        console.log("User updated:", session?.user);
        break;
    }
  });
}

// Call in your app initialization
// initAuthListener();
```

### Usage with Analytics (e.g., Mixpanel)

```typescript
// src/lib/track/mixpanel.ts
import mixpanel from "mixpanel-browser";
import { supabase } from "@/lib/supabase";

export function initializeMixpanel() {
  mixpanel.init(import.meta.env.VITE_MIXPANEL_TOKEN);

  supabase.auth.onAuthStateChange((_, session) => {
    if (session?.user) {
      mixpanel.identify(session.user.id);
      mixpanel.people.set({
        $email: session.user.email,
        $name: session.user.user_metadata.name,
      });
    }
  });
}
```

---

## Sign-In Page Example

```typescript
// src/routes/auth/sign-in/signin-page.tsx
import { useSearchParams } from "react-router";
import { SignInWithGoogleButton } from "../components/sign-in-with-google-button";

export function SignInPage() {
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url");

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1>Sign In</h1>

      <SignInWithGoogleButton
        redirectTo={
          redirectUrl
            ? `${window.location.origin}/auth/callback?redirect_url=${redirectUrl}`
            : undefined
        }
      />

      <div className="divider">OR</div>

      {/* Email/password form if needed */}
    </div>
  );
}
```

---

## Complete Data Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1. User visits protected route /dashboard                            │
│    └─> AppLayout renders                                             │
│        └─> AuthCheck calls useUser()                                 │
│            └─> No session → throws AuthError                         │
│                └─> AuthBoundary catches                              │
│                    └─> Redirects to /auth/signin?redirect_url=...   │
├──────────────────────────────────────────────────────────────────────┤
│ 2. User clicks "Sign in with Google"                                 │
│    └─> supabase.auth.signInWithOAuth({ provider: "google" })        │
│        └─> Browser redirects to Google OAuth                         │
├──────────────────────────────────────────────────────────────────────┤
│ 3. User authenticates with Google                                    │
│    └─> Google redirects to /auth/callback                           │
│        └─> Supabase exchanges code for tokens (automatic)           │
├──────────────────────────────────────────────────────────────────────┤
│ 4. Callback page                                                     │
│    └─> supabase.auth.getSession()                                   │
│        └─> Session now available (stored in localStorage)           │
│            └─> Redirect to original /dashboard                      │
├──────────────────────────────────────────────────────────────────────┤
│ 5. Protected route renders successfully                              │
│    └─> AuthCheck succeeds                                            │
│        └─> API calls include Bearer token                            │
│            └─> Server validates JWT via Supabase                     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Potential Improvements

### Current Implementation Analysis

| Aspect | Current Approach | Potential Issue |
|--------|-----------------|-----------------|
| Session retrieval | `getSession()` on every API call | Multiple async calls |
| User state | TanStack Query with Suspense | Works well, but adds complexity |
| New user detection | Time-based heuristic (5 sec) | Can be inaccurate |
| Auth state sync | No cross-tab sync | Logout doesn't sync across tabs |

### Recommended Improvements

#### 1. Centralized Auth Context

Instead of calling `getSession()` on every API call, create a centralized auth context:

```typescript
// src/contexts/auth-context.tsx
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
```

#### 2. Optimized API Client

Use the auth context instead of calling `getSession()` every time:

```typescript
// Modified API client
import { useAuth } from "@/contexts/auth-context";

// Create a module-level variable updated by auth context
let currentAccessToken: string | null = null;

export function setAccessToken(token: string | null) {
  currentAccessToken = token;
}

export async function apiClient<T>(url: string, options: RequestInit): Promise<T> {
  const headers: HeadersInit = {
    ...options.headers,
    ...(currentAccessToken && { Authorization: `Bearer ${currentAccessToken}` }),
  };

  // ... rest of implementation
}
```

#### 3. Cross-Tab Logout Sync

```typescript
// In AuthProvider
useEffect(() => {
  const channel = new BroadcastChannel("auth");

  channel.onmessage = (event) => {
    if (event.data === "SIGNED_OUT") {
      supabase.auth.signOut();
      window.location.href = "/auth/signin";
    }
  };

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      channel.postMessage("SIGNED_OUT");
    }
  });

  return () => {
    subscription.unsubscribe();
    channel.close();
  };
}, []);
```

#### 4. Server-Side New User Detection

Instead of client-side heuristics, let the server determine if a user is new:

```typescript
// Backend: Add isNewUser to login response
// Or use Supabase webhooks to track first login
```

---

## Security Considerations

1. **Never expose Supabase service role key** - Only use the anon key on client
2. **Validate tokens server-side** - Always verify JWTs on your backend
3. **Use HTTPS** - Required for OAuth redirects in production
4. **Set proper redirect URLs** - Configure allowed URLs in Supabase dashboard
5. **Handle token expiration** - `autoRefreshToken: true` handles this automatically

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid redirect URL" | Add URL to Supabase dashboard > Authentication > URL Configuration |
| Session not persisting | Check `persistSession: true` and localStorage access |
| Token not refreshing | Ensure `autoRefreshToken: true` in client config |
| CORS errors | Configure allowed origins in Supabase dashboard |
| Infinite redirect loop | Check AuthBoundary isn't wrapping auth pages |

---

## Summary

| Component | Purpose |
|-----------|---------|
| `supabase.ts` | Client setup with auto-refresh and persistence |
| `SignInWithGoogleButton` | Triggers OAuth flow with Google |
| `AuthCallbackPage` | Handles OAuth redirect and session retrieval |
| `useUser` | TanStack Query hook for user state |
| `apiClient` | Injects Bearer token into API requests |
| `AuthBoundary` | Error boundary for auth failures |
| `AppLayout` | Protected route wrapper with auth check |
| `onAuthStateChange` | Listener for auth state changes (analytics, sync) |

This architecture provides a robust OAuth implementation with automatic token refresh, session persistence, and proper error handling.
