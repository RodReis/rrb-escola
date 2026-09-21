import { describe, expect, it } from "vitest";
import { competenciasDaJanela, extrairEndToEndId, parseValor } from "@/lib/conciliacao/sync-extrato";

describe("parseValor", () => {
  it("aceita número já tipado", () => {
    expect(parseValor(1234.56)).toBe(1234.56);
  });

  it("converte valor em formato brasileiro", () => {
    expect(parseValor("1.234,56")).toBe(1234.56);
  });

  it("aceita valor negativo, que indica débito", () => {
    expect(parseValor("-49,90")).toBe(-49.9);
  });

  it("rejeita o texto fictício do sandbox em vez de virar NaN", () => {
    expect(parseValor("ut velit incididunt ullamco")).toBeNull();
  });

  it("rejeita valor ausente", () => {
    expect(parseValor(undefined)).toBeNull();
    expect(parseValor("")).toBeNull();
  });
});

describe("competenciasDaJanela", () => {
  it("usa só o mês corrente quando a janela de 3 dias não cruza o mês", () => {
    expect(competenciasDaJanela(new Date("2026-09-11T12:00:00"))).toEqual([{ mes: 9, ano: 2026 }]);
  });

  it("inclui o mês anterior quando a janela cruza a virada", () => {
    expect(competenciasDaJanela(new Date("2026-09-02T12:00:00"))).toEqual([
      { mes: 8, ano: 2026 },
      { mes: 9, ano: 2026 },
    ]);
  });

  it("trata a virada de ano", () => {
    expect(competenciasDaJanela(new Date("2026-01-02T12:00:00"))).toEqual([
      { mes: 12, ano: 2025 },
      { mes: 1, ano: 2026 },
    ]);
  });
});

describe("extrairEndToEndId", () => {
  const e2e = "E12345678202609111230abcdefghijk";

  it("encontra o end-to-end id no texto complementar", () => {
    expect(extrairEndToEndId({ descInfComplementar: `PIX RECEBIDO ${e2e}` })).toBe(e2e);
  });

  it("encontra também na descrição", () => {
    expect(extrairEndToEndId({ descricao: `TRANSF ${e2e}` })).toBe(e2e);
  });

  it("devolve null quando o movimento não é Pix", () => {
    expect(extrairEndToEndId({ descricao: "TARIFA MENSAL", descInfComplementar: "cesta basica" })).toBeNull();
  });
});
