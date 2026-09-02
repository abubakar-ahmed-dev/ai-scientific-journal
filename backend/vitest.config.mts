import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      ...(process.env.RUN_SECURITY_RULES ? [] : ["tests/security/rules.test.ts"]),
    ],
    env: {
      NODE_ENV: "test",
      FIREBASE_PROJECT_ID: "demo-test",
    },
  },
});
