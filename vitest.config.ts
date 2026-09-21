import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // tsconfig usa jsx:"preserve" (Next compila o JSX ele mesmo); vite/vitest
  // não lê essa opção, então sem este plugin um .test.tsx com <Button/> falha
  // no parse do vite-import-analysis antes mesmo de rodar.
  plugins: [react()],
  test: {
    // environmentMatchGlobs foi removido no vitest 4 (era do vitest 1-3).
    // Ambiente por arquivo agora é docblock `// @vitest-environment jsdom`
    // no topo do .test.tsx — ver docs/config/environment.md do vitest 4.
    environment: "node",
    setupFiles: ["src/test-setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
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
