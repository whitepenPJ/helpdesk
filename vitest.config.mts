import { defineConfig } from "vitest/config";

const rootDir = import.meta.dirname;

// Unit tests for the pure helpers in app/lib/. Playwright owns e2e/ (see
// playwright.config.ts, testDir "./e2e"); Vitest only picks up test/**.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // Mirror the tsconfig "@/*" -> "./*" path mapping.
      "@": rootDir,
      // Some lib modules guard against client bundling with `import
      // "server-only"`, which throws outside a React Server Component
      // graph. Swap it for a no-op so the pure exports stay testable.
      "server-only": `${rootDir}/test/stubs/server-only.ts`,
    },
  },
});
