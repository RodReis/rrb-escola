import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["src/test-setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    passWithNoTests: true,
    fileParallelism: false,
    // @ts-ignore - environmentMatchGlobs is available in vitest 4.1+ but types haven't caught up
    environmentMatchGlobs: [["src/**/*.test.tsx", "jsdom"]],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      // "server-only" lança erro em runtime mas não tem lógica — mock vazio no teste.
      "server-only": resolve(__dirname, "src/__mocks__/server-only.ts"),
    },
  },
});
