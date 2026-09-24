import { describe, expect, it } from "vitest";
import { classificarPorRegra, type Regra, type DebitoParaRegra } from "@/lib/conciliacao/classificar-regra";

const base = (over: Partial<Regra> = {}): Regra => ({
  id: "r1",
  tipoMatch: "documento",
  documento: "01816875000129",
  padraoTexto: null,
  valorEsperado: null,
  diaInicio: null,
  diaFim: null,
  contaId: null,
  categoriaId: "cat-fornecedor",
  companyId: null,
  classeDespesa: null,
  ...over,
});

const debito = (over: Partial<DebitoParaRegra> = {}): DebitoParaRegra => ({
  id: "d1",
  contaId: "A",
  data: "2026-08-05",
  valor: 1000,
  descricao: "PIX EMITIDO OUTRA IF",
  documento: "01816875000129",
  ...over,
});

describe("classificarPorRegra", () => {
  it("casa por documento", () => {
    expect(classificarPorRegra(debito(), [base()])?.categoriaId).toBe("cat-fornecedor");
  });

  it("não casa documento diferente", () => {
    expect(classificarPorRegra(debito({ documento: "99999999999999" }), [base()])).toBeNull();
  });

  it("casa por texto, ignorando caixa e acento", () => {
    const r = base({ tipoMatch: "texto", documento: null, padraoTexto: "tributos federais", categoriaId: "cat-imposto" });
    const d = debito({ documento: null, descricao: "DÉB.CONV.TRIBUTOS FEDERAIS - RFB" });
    expect(classificarPorRegra(d, [r])?.categoriaId).toBe("cat-imposto");
  });

  it("documento vence texto quando as duas casam", () => {
    const porTexto = base({ id: "t", tipoMatch: "texto", documento: null, padraoTexto: "pix emitido", categoriaId: "cat-texto" });
    const porDoc = base({ id: "d", categoriaId: "cat-doc" });
    expect(classificarPorRegra(debito(), [porTexto, porDoc])?.categoriaId).toBe("cat-doc");
  });

  it("regra restrita à conta vence a regra geral do mesmo documento", () => {
    const geral = base({ id: "g", categoriaId: "cat-geral" });
    const daConta = base({ id: "c", contaId: "A", categoriaId: "cat-conta" });
    expect(classificarPorRegra(debito(), [geral, daConta])?.categoriaId).toBe("cat-conta");
  });

  it("regra de outra conta não casa", () => {
    expect(classificarPorRegra(debito(), [base({ contaId: "B" })])).toBeNull();
  });

  // D7: pró-labore casa por VALOR EXATO em janela de dias.
  it("casa pró-labore: valor exato dentro da janela", () => {
    const r = base({ valorEsperado: 4000, diaInicio: 1, diaFim: 9, categoriaId: "cat-prolabore" });
    expect(classificarPorRegra(debito({ valor: 4000, data: "2026-08-05" }), [r])?.categoriaId).toBe("cat-prolabore");
  });

  it("NÃO casa retirada extraordinária do mesmo sócio no mesmo dia", () => {
    const r = base({ valorEsperado: 4000, diaInicio: 1, diaFim: 9, categoriaId: "cat-prolabore" });
    expect(classificarPorRegra(debito({ valor: 15000, data: "2026-08-05" }), [r])).toBeNull();
  });

  it("NÃO casa valor certo fora da janela de dias", () => {
    const r = base({ valorEsperado: 4000, diaInicio: 1, diaFim: 9, categoriaId: "cat-prolabore" });
    expect(classificarPorRegra(debito({ valor: 4000, data: "2026-08-22" }), [r])).toBeNull();
  });

  it("a regra com valor esperado vence a regra genérica do mesmo documento", () => {
    const generica = base({ id: "g", categoriaId: "cat-socio-geral" });
    const prolabore = base({ id: "p", valorEsperado: 4000, diaInicio: 1, diaFim: 9, categoriaId: "cat-prolabore" });
    expect(classificarPorRegra(debito({ valor: 4000 }), [generica, prolabore])?.categoriaId).toBe("cat-prolabore");
  });

  it("débito sem documento não casa regra de documento", () => {
    expect(classificarPorRegra(debito({ documento: null }), [base()])).toBeNull();
  });
});
