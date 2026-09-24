import { describe, expect, it } from "vitest";
import { classificarDebitos } from "@/lib/conciliacao/pipeline-debitos";
import type { Regra } from "@/lib/conciliacao/classificar-regra";
import type { MovimentoConta } from "@/lib/conciliacao/transferencia-interna";

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
    ];
    const r = classificarDebitos({
      debitos,
      creditos: [{ id: "c1", contaId: "B", data: "2026-08-05", valor: 10000, tipo: "credito" }],
      documentos: { d1: "11714876000116", d2: "35027047000123", d3: "01816875000129", d4: null },
      descricoes: { d1: "DÉB.TRANSF", d2: "PIX MESMA TIT.", d3: "PIX EMITIDO", d4: "DÉB.TIT.COMPE" },
      regras: [{ ...regraDoPinguinho, id: "r1", documento: "01816875000129", categoriaId: "cat-ok" }],
      contasProprias: CONTAS_PROPRIAS,
      documentosProprios: DOCS_PROPRIOS,
    });

    const total =
      r.transferenciasInternas.length + r.contaPropriaSemPar.length +
      r.sugestoes.length + r.aClassificar.length + r.ambiguos.length;
    expect(total).toBe(debitos.length);
  });
});
