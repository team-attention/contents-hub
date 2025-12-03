module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testEnvironment: "node",
  testRegex: ".e2e-spec.ts$",
  testTimeout: 30000,
  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
  globalSetup: "./test/jest-global-setup.ts",
  globalTeardown: "./test/jest-global-teardown.ts",
  setupFilesAfterEnv: ["./test/env-setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
