const useMocks = process.env.USE_MOCKS !== "false";

module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testEnvironment: "node",
  testRegex: ".e2e-spec.ts$",
  testTimeout: useMocks ? 30000 : 120000,
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  // ESM 모듈들을 transform (real API 테스트용) - pnpm 구조 고려
  transformIgnorePatterns: [
    "/node_modules/(?!.pnpm)(?!(@extractus|youtube-transcript-plus))",
    "/node_modules/.pnpm/(?!(@extractus|youtube-transcript-plus))",
  ],
  globalSetup: "./test/jest-global-setup.ts",
  globalTeardown: "./test/jest-global-teardown.ts",
  setupFilesAfterEnv: useMocks
    ? ["./test/env-setup.ts", "./test/setup-mocks.ts"]
    : ["./test/env-setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
