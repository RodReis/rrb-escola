import { describe, expect, it } from "vitest";
import { dataDeVencimento, planejarCompetencia, recorrenteVigente, type Recorrente } from "@/lib/previsto/recorrencia";

const rec = (over: Partial<Recorrente> = {}): Recorrente => ({
  id: "r1",
  escolaId: "e1",
  companyId: "c1",
  descricao: "Aluguel",
  categoriaId: "cat1",
  contraparte: null,
  valorReferencia: 5000,
  diaVencimento: 10,
  classeDespesa: "fixa",
  ativo: true,
  inicioCompetencia: "2026-01",
  fimCompetencia: null,
  ...over,
});

describe("dataDeVencimento", () => {
  it("usa o dia pedido", () => {
    expect(dataDeVencimento("2026-10", 18)).toBe("2026-10-18");
  });
  it("dia 31 em mês curto cai no último dia", () => {
    expect(dataDeVencimento("2026-02", 31)).toBe("2026-02-28");
    expect(dataDeVencimento("2028-02", 30)).toBe("2028-02-29");
    expect(dataDeVencimento("2026-04", 31)).toBe("2026-04-30");
  });
});

describe("recorrenteVigente", () => {
  it("respeita início, fim e ativo", () => {
    expect(recorrenteVigente(rec(), "2026-10")).toBe(true);
    expect(recorrenteVigente(rec({ inicioCompetencia: "2026-11" }), "2026-10")).toBe(false);
    expect(recorrenteVigente(rec({ fimCompetencia: "2026-09" }), "2026-10")).toBe(false);
    expect(recorrenteVigente(rec({ fimCompetencia: "2026-10" }), "2026-10")).toBe(true);
    expect(recorrenteVigente(rec({ ativo: false }), "2026-10")).toBe(false);
  });
});

describe("planejarCompetencia", () => {
  it("gera título para recorrente com valor de referência", () => {
    const { gerar, aguardandoValor } = planejarCompetencia([rec()], "2026-10");
    expect(aguardandoValor).toEqual([]);
    expect(gerar).toEqual([
      {
        escola_id: "e1",
        tipo: "despesa",
        competencia: "2026-10",
        descricao: "Aluguel",
        categoria_id: "cat1",
        company_id: "c1",
        classe_despesa: "fixa",
        contraparte: null,
        valor: 5000,
        data_vencimento: "2026-10-10",
        status: "aberta",
        origem_tipo: "manual",
        recorrente_id: "r1",
      },
    ]);
  });

  it("valor de referência nulo NÃO gera título — vai para 'aguardando valor'", () => {
    const { gerar, aguardandoValor } = planejarCompetencia([rec({ valorReferencia: null })], "2026-10");
    expect(gerar).toEqual([]);
    expect(aguardandoValor.map((r) => r.id)).toEqual(["r1"]);
  });

  it("ignora recorrente fora da vigência", () => {
    const r = planejarCompetencia([rec({ fimCompetencia: "2026-09" })], "2026-10");
    expect(r.gerar).toEqual([]);
    expect(r.aguardandoValor).toEqual([]);
  });
});
