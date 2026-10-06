import { describe, expect, it } from "vitest";
import { config } from "./middleware";

// O matcher do Next é um path-to-regexp; aqui o padrão é um regex puro, então
// ancorar basta pra simular. Rotas fora do matcher não passam pelo login.
const passaPeloMiddleware = (path: string) =>
  new RegExp(`^${config.matcher[0]}$`).test(path);

describe("middleware matcher", () => {
  it("não intercepta o cron dispatcher (autentica por Bearer CRON_SECRET)", () => {
    expect(passaPeloMiddleware("/api/jobs/dispatch")).toBe(false);
  });

  it("continua protegendo as demais rotas", () => {
    expect(passaPeloMiddleware("/alunos")).toBe(true);
    expect(passaPeloMiddleware("/api/comunicados/processar")).toBe(true);
  });
});
