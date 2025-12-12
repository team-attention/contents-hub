/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // ESM 모듈을 Jest가 변환할 수 있도록 설정 (pnpm 구조 지원)
  transformIgnorePatterns: [
    "/node_modules/(?!.pnpm)(?!(@extractus|linkedom|html-entities))",
    "/node_modules/.pnpm/(?!(@extractus|linkedom|html-entities))",
  ],
  collectCoverageFrom: ["src/**/*.(t|j)s", "!src/**/*.d.ts"],
  coverageDirectory: "./coverage",
  testEnvironment: "node",
};
