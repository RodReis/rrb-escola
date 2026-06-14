import { describe, it, expect } from "vitest";
import { estoqueParado, type VariacaoParadaInput } from "./estoque-parado";

const HOJE = "2026-06-14";

function v(p: Partial<VariacaoParadaInput>): VariacaoParadaInput {
  return { variacao_id: "x", rotulo: "X", saldo: 10, custo: 5, ultimaSaida: null, ...p };
}

describe("estoque parado", () => {
  it("nunca teve saída e tem saldo -> parado (diasParado null)", () => {
    const r = estoqueParado([v({ ultimaSaida: null })], HOJE, 60);
    expect(r.length).toBe(1);
    expect(r[0].diasParado).toBeNull();
  });

  it("saída recente (dentro da janela) -> não parado", () => {
    const r = estoqueParado([v({ ultimaSaida: "2026-06-01" })], HOJE, 60);
    expect(r.length).toBe(0);
  });

  it("saída antiga (além da janela) -> parado", () => {
    const r = estoqueParado([v({ ultimaSaida: "2026-01-01" })], HOJE, 60);
    expect(r.length).toBe(1);
    expect(r[0].diasParado).toBeGreaterThanOrEqual(60);
  });

  it("saldo zero -> fora do relatório", () => {
    const r = estoqueParado([v({ saldo: 0, ultimaSaida: null })], HOJE, 60);
    expect(r.length).toBe(0);
  });

  it("sazonalidade: saída em mês de baixa temporada não conta como giro", () => {
    // última saída em junho (mês 6, marcado baixa temporada) -> tratado como sem giro -> parado
    const r = estoqueParado([v({ ultimaSaida: "2026-06-10" })], HOJE, 60, [6]);
    expect(r.length).toBe(1);
    expect(r[0].diasParado).toBeNull();
  });

  it("valor imobilizado = saldo × custo", () => {
    const r = estoqueParado([v({ saldo: 4, custo: 25, ultimaSaida: null })], HOJE, 60);
    expect(r[0].valorImobilizado).toBe(100);
  });
});
