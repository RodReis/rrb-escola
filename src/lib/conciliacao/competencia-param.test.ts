import { describe, expect, it } from "vitest";
import { parseCompetencia } from "@/lib/conciliacao/competencia-param";

const HOJE = new Date("2026-09-23T12:00:00Z");

describe("parseCompetencia", () => {
  it("aceita uma competência passada", () => {
    expect(parseCompetencia("8", "2026", HOJE)).toEqual({ ok: true, mes: 8, ano: 2026 });
  });

  it("aceita o mês corrente", () => {
    expect(parseCompetencia("9", "2026", HOJE)).toEqual({ ok: true, mes: 9, ano: 2026 });
  });

  it("recusa competência futura, que o banco não tem como ter", () => {
    expect(parseCompetencia("10", "2026", HOJE)).toEqual({
      ok: false,
      erro: "Competência 10/2026 é futura.",
    });
  });

  it("recusa mês fora de 1 a 12", () => {
    expect(parseCompetencia("13", "2026", HOJE)).toEqual({ ok: false, erro: "Mês inválido: 13." });
    expect(parseCompetencia("0", "2026", HOJE)).toEqual({ ok: false, erro: "Mês inválido: 0." });
  });

  it("recusa ano anterior ao início da operação no sistema", () => {
    expect(parseCompetencia("8", "2019", HOJE)).toEqual({ ok: false, erro: "Ano inválido: 2019." });
  });

  it("recusa parâmetro ausente", () => {
    expect(parseCompetencia(null, "2026", HOJE)).toEqual({
      ok: false,
      erro: "Informe mes e ano na querystring.",
    });
    expect(parseCompetencia("8", null, HOJE)).toEqual({
      ok: false,
      erro: "Informe mes e ano na querystring.",
    });
  });

  it("recusa parâmetro não numérico em vez de virar NaN", () => {
    expect(parseCompetencia("agosto", "2026", HOJE)).toEqual({
      ok: false,
      erro: "Mês inválido: agosto.",
    });
  });
});
