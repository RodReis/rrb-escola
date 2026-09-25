import { describe, expect, it } from "vitest";
import { classificarDebitos } from "@/lib/conciliacao/pipeline-debitos";
import type { Regra } from "@/lib/conciliacao/classificar-regra";
import type { MovimentoConta } from "@/lib/conciliacao/transferencia-interna";
import type { PrevistoAberto } from "@/lib/conciliacao/baixa-previsto";

const CONTAS_PROPRIAS = new Set(["A", "B"]);
const DOCS_PROPRIOS = new Set(["11714876000116", "35027047000123"]);

const regraDoPinguinho: Regra = {
  id: "r-erro", tipoMatch: "documento", documento: "11714876000116", padraoTexto: null,
  valorEsperado: null, diaInicio: null, diaFim: null, contaId: null,
  categoriaId: "cat-despesa-errada", companyId: null, classeDespesa: null,
};

describe("classificarDebitos — ordem do pipeline", () => {
  it("transferência interna NUNCA chega na regra, mesmo havendo regra para aquele documento", () => {
    const debitos: MovimentoConta[] = [
      { id: "d1", contaId: "A", data: "2026-08-05", valor: 10000, tipo: "debito" },
    ];
    const creditos: MovimentoConta[] = [
      { id: "c1", contaId: "B", data: "2026-08-05", valor: 10000, tipo: "credito" },
    ];
    const r = classificarDebitos({
      debitos,
      creditos,
      documentos: { d1: "11714876000116" },
      descricoes: { d1: "DÉB.TRANSF.CONTAS DIF.TITULARIDADE" },
      regras: [regraDoPinguinho],
      contasProprias: CONTAS_PROPRIAS,
      documentosProprios: DOCS_PROPRIOS,
    });

    expect(r.transferenciasInternas.map((t) => t.debitoId)).toEqual(["d1"]);
    expect(r.sugestoes).toEqual([]);
    expect(r.aClassificar).toEqual([]);
    expect(r.contaPropriaSemPar).toEqual([]);
    expect(r.ambiguos).toEqual([]);
  });

  it("débito para CNPJ próprio SEM par vira transferência para conta própria, não despesa", () => {
    const r = classificarDebitos({
      debitos: [{ id: "d1", contaId: "A", data: "2026-08-05", valor: 48000, tipo: "debito" }],
      creditos: [],
      documentos: { d1: "11714876000116" },
      descricoes: { d1: "PIX EMITIDO OUTRA IF - MESMA TIT." },
      regras: [regraDoPinguinho],
      contasProprias: CONTAS_PROPRIAS,
      documentosProprios: DOCS_PROPRIOS,
    });

    expect(r.contaPropriaSemPar.map((x) => x.debitoId)).toEqual(["d1"]);
    expect(r.sugestoes).toEqual([]);
  });

  it("débito de terceiro com regra vira sugestão, nunca lançamento direto (D1)", () => {
    const regra: Regra = { ...regraDoPinguinho, id: "r1", documento: "01816875000129", categoriaId: "cat-ok" };
    const r = classificarDebitos({
      debitos: [{ id: "d1", contaId: "A", data: "2026-08-05", valor: 1200, tipo: "debito" }],
      creditos: [],
      documentos: { d1: "01816875000129" },
      descricoes: { d1: "PIX EMITIDO OUTRA IF" },
      regras: [regra],
      contasProprias: CONTAS_PROPRIAS,
      documentosProprios: DOCS_PROPRIOS,
    });

    expect(r.sugestoes).toEqual([{ debitoId: "d1", regraId: "r1", categoriaId: "cat-ok", companyId: null, classeDespesa: null }]);
    expect(r.aClassificar).toEqual([]);
  });

  it("débito sem regra e sem documento cai na fila", () => {
    const r = classificarDebitos({
      debitos: [{ id: "d1", contaId: "A", data: "2026-08-05", valor: 3229.61, tipo: "debito" }],
      creditos: [],
      documentos: { d1: null },
      descricoes: { d1: "DÉB.TIT.COMPE EFETIVADO" },
      regras: [],
      contasProprias: CONTAS_PROPRIAS,
      documentosProprios: DOCS_PROPRIOS,
    });

    expect(r.aClassificar).toEqual(["d1"]);
  });

  it("todo débito de entrada sai em exatamente um balde", () => {
    const debitos: MovimentoConta[] = [
      { id: "d1", contaId: "A", data: "2026-08-05", valor: 10000, tipo: "debito" },
      { id: "d2", contaId: "A", data: "2026-08-05", valor: 48000, tipo: "debito" },
      { id: "d3", contaId: "A", data: "2026-08-06", valor: 1200, tipo: "debito" },
      { id: "d4", contaId: "A", data: "2026-08-07", valor: 300, tipo: "debito" },
      // Ambíguo: dois créditos do mesmo valor no mesmo dia, em contas distintas
      // ("B" e "C"). Documento próprio + regra batendo também — para provar que
      // ele só cai em `ambiguos`, mesmo tendo condição de cair nos outros baldes.
      { id: "d5", contaId: "A", data: "2026-08-05", valor: 500, tipo: "debito" },
    ];
    const r = classificarDebitos({
      debitos,
      creditos: [
        { id: "c1", contaId: "B", data: "2026-08-05", valor: 10000, tipo: "credito" },
        { id: "c2", contaId: "B", data: "2026-08-05", valor: 500, tipo: "credito" },
        { id: "c3", contaId: "C", data: "2026-08-05", valor: 500, tipo: "credito" },
      ],
      documentos: {
        d1: "11714876000116", d2: "35027047000123", d3: "01816875000129", d4: null,
        d5: "11714876000116",
      },
      descricoes: {
        d1: "DÉB.TRANSF", d2: "PIX MESMA TIT.", d3: "PIX EMITIDO", d4: "DÉB.TIT.COMPE",
        d5: "PIX EMITIDO OUTRA IF",
      },
      regras: [
        { ...regraDoPinguinho, id: "r1", documento: "01816875000129", categoriaId: "cat-ok" },
        { ...regraDoPinguinho, id: "r2", documento: "11714876000116", categoriaId: "cat-erro-d5" },
      ],
      contasProprias: CONTAS_PROPRIAS,
      documentosProprios: DOCS_PROPRIOS,
    });

    expect(r.ambiguos.map((a) => a.debitoId)).toEqual(["d5"]);

    const idsClassificados = [
      ...r.transferenciasInternas.map((p) => p.debitoId),
      ...r.contaPropriaSemPar.map((x) => x.debitoId),
      ...r.sugestoes.map((s) => s.debitoId),
      ...r.aClassificar,
      ...r.ambiguos.map((a) => a.debitoId),
    ].sort();
    expect(idsClassificados).toEqual(debitos.map((d) => d.id).sort());
  });
});

describe("classificarDebitos — etapa 3: baixa de previsto", () => {
  const previsto: PrevistoAberto = {
    id: "p1", valor: 5000, dataVencimento: "2026-08-05", documento: null, companyId: null,
  };
  const debitoSimples: MovimentoConta[] = [
    { id: "d1", contaId: "A", data: "2026-08-05", valor: 5000, tipo: "debito" },
  ];
  const base = {
    debitos: debitoSimples,
    creditos: [] as MovimentoConta[],
    documentos: { d1: null },
    descricoes: { d1: "DÉB.CONV.TRIBUTOS FEDERAIS" },
    regras: [] as Regra[],
    contasProprias: CONTAS_PROPRIAS,
    documentosProprios: DOCS_PROPRIOS,
  };

  it("título casado sai da fila e vira baixa única", () => {
    const r = classificarDebitos({ ...base, previstos: [previsto] });
    expect(r.baixasUnicas).toEqual([{ debitoId: "d1", lancamentoId: "p1" }]);
    expect(r.aClassificar).toEqual([]);
    expect(r.sugestoes).toEqual([]);
  });

  it("a baixa vence a regra: com título casado a regra não sugere", () => {
    const regra: Regra = { ...regraDoPinguinho, id: "r-x", documento: "99999999000199" };
    const r = classificarDebitos({ ...base, documentos: { d1: "99999999000199" }, regras: [regra], previstos: [previsto] });
    expect(r.baixasUnicas).toHaveLength(1);
    expect(r.sugestoes).toEqual([]);
  });

  it("transferência interna continua ANTES da baixa", () => {
    const r = classificarDebitos({
      ...base,
      creditos: [{ id: "c1", contaId: "B", data: "2026-08-05", valor: 5000, tipo: "credito" }],
      previstos: [previsto],
    });
    expect(r.transferenciasInternas.map((t) => t.debitoId)).toEqual(["d1"]);
    expect(r.baixasUnicas).toEqual([]);
  });

  it("empate vira baixa ambígua e não cai na fila", () => {
    const r = classificarDebitos({ ...base, previstos: [previsto, { ...previsto, id: "p2" }] });
    expect(r.baixasAmbiguas).toEqual([{ debitoId: "d1", candidatos: ["p1", "p2"] }]);
    expect(r.aClassificar).toEqual([]);
  });

  it("empresa da conta impede casar com título de outra empresa", () => {
    const r = classificarDebitos({
      ...base,
      companyPorConta: { A: "emp-1" },
      previstos: [{ ...previsto, companyId: "emp-2" }],
    });
    expect(r.baixasUnicas).toEqual([]);
    expect(r.aClassificar).toEqual(["d1"]);
  });

  it("sem previstos, o comportamento anterior não muda", () => {
    const r = classificarDebitos(base);
    expect(r.baixasUnicas).toEqual([]);
    expect(r.baixasAmbiguas).toEqual([]);
    expect(r.aClassificar).toEqual(["d1"]);
  });
});
