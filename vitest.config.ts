import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      // "server-only" lança erro em runtime mas não tem lógica — mock vazio no teste.
      "server-only": resolve(__dirname, "src/__mocks__/server-only.ts"),
    },
  },
});
