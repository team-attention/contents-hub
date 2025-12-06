import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock chrome API
globalThis.chrome = {
  storage: {
    local: {
      get: vi.fn().mockImplementation((keys) => {
        return Promise.resolve({});
      }),
      set: vi.fn().mockImplementation(() => Promise.resolve()),
      remove: vi.fn().mockImplementation(() => Promise.resolve()),
    },
  },
  identity: {
    launchWebAuthFlow: vi.fn(),
    getRedirectURL: vi.fn(() => "https://test-extension-id.chromiumapp.org/"),
  },
  runtime: {
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    sendMessage: vi.fn(),
    onInstalled: {
      addListener: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn().mockImplementation((_query, callback) => {
      callback([{ url: "https://example.com" }]);
    }),
  },
} as unknown as typeof chrome;

// Mock import.meta.env
vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
