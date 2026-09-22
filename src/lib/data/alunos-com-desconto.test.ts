import { describe, it, expect } from "vitest";
import { buildDescontoRow, type RawMatricula } from "./alunos-com-desconto-constants";

const respFin = {
  nome: "Maria",
  parentesco: "mãe",
  telefone: "",
  celular: "62999990000",
  responsavel_financeiro: true,
};

function baseRaw(overrides: Partial<RawMatricula> = {}): RawMatricula {
  return {
    id: "m1",
    tipo_vaga: "NORMAL",
    percentual_bolsa: 0,
    valor_mensalidade_praticado: null,
    alunos: { id: "a1", nome: "JOÃO SILVA", responsaveis_aluno: [respFin] },
    series: { id: "s1", nome: "5º Ano", ordem: 5, segmento: "FUNDAMENTAL1" },
    turmas: { id: "t1", nome: "A" },
    planos: { valor_mensalidade: 690 },
    ...overrides,
  };
}

// valoresSeg shape: [ordem_filho=1, ordem_filho=2, ordem_filho=3]
// Using FUNDAMENTAL1 2026 reference: 745 / 690 / 650.
const FUND1 = [745, 690, 650];

describe("buildDescontoRow — exclusions", () => {
  it("NORMAL + plano matches valor cheio (ordem 1) -> null", () => {
    expect(buildDescontoRow(baseRaw({ planos: { valor_mensalidade: 745 } }), FUND1)).toBeNull();
  });
  it("NORMAL + plano matches valor irmão 2 (ordem 2) -> null", () => {
    expect(buildDescontoRow(baseRaw({ planos: { valor_mensalidade: 690 } }), FUND1)).toBeNull();
  });
  it("NORMAL + plano matches valor irmão 3 (ordem 3) -> null", () => {
    expect(buildDescontoRow(baseRaw({ planos: { valor_mensalidade: 650 } }), FUND1)).toBeNull();
  });
  it("NORMAL + plano > cheio -> null (no discount)", () => {
    expect(buildDescontoRow(baseRaw({ planos: { valor_mensalidade: 800 } }), FUND1)).toBeNull();
  });
  it("no plano -> null", () => {
    expect(buildDescontoRow(baseRaw({ planos: null }), FUND1)).toBeNull();
  });
  it("no segmento -> null", () => {
    const raw = baseRaw({
      series: { id: "s1", nome: "5º Ano", ordem: 5, segmento: null },
    });
    expect(buildDescontoRow(raw, FUND1)).toBeNull();
  });
  it("empty valoresSeg -> null", () => {
    expect(buildDescontoRow(baseRaw(), [])).toBeNull();
  });
});

describe("buildDescontoRow — inclusions", () => {
  it("NORMAL + plano below min sibling -> origem 'plano'", () => {
    const row = buildDescontoRow(baseRaw({ planos: { valor_mensalidade: 600 } }), FUND1);
    expect(row).not.toBeNull();
    expect(row!.origem).toBe("plano");
    expect(row!.valorPraticadoCheio).toBe(745);
    expect(row!.valorMensalidadePlano).toBe(600);
    expect(row!.percentualBolsaParcial).toBe(0);
    expect(row!.percentualDescontoEfetivo).toBeCloseTo(1 - 600 / 745, 4);
  });

  it("BOLSA_50_PORCENTO + plano cheio -> origem 'bolsa_50', % ~ 0.5", () => {
    const raw = baseRaw({
      tipo_vaga: "BOLSA_50_PORCENTO",
      percentual_bolsa: 50,
      planos: { valor_mensalidade: 745 },
    });
    const row = buildDescontoRow(raw, FUND1);
    expect(row).not.toBeNull();
    expect(row!.origem).toBe("bolsa_50");
    expect(row!.percentualBolsaParcial).toBe(50);
    expect(row!.percentualDescontoEfetivo).toBeCloseTo(0.5, 4);
  });

  it("BOLSA_50_PORCENTO + plano abaixo do menor irmão -> origem 'plano+bolsa'", () => {
    const raw = baseRaw({
      tipo_vaga: "BOLSA_50_PORCENTO",
      percentual_bolsa: 50,
      planos: { valor_mensalidade: 600 },
    });
    const row = buildDescontoRow(raw, FUND1);
    expect(row).not.toBeNull();
    expect(row!.origem).toBe("plano+bolsa");
    expect(row!.percentualDescontoEfetivo).toBeCloseTo(1 - 300 / 745, 4);
  });

  it("BOLSA_50_PORCENTO with plan that matches sibling 2 still includes (bolsa wins)", () => {
    const raw = baseRaw({
      tipo_vaga: "BOLSA_50_PORCENTO",
      percentual_bolsa: 50,
      planos: { valor_mensalidade: 690 },
    });
    const row = buildDescontoRow(raw, FUND1);
    expect(row).not.toBeNull();
    expect(row!.origem).toBe("bolsa_50");
  });
});

describe("buildDescontoRow — derivations", () => {
  it("derives nome / série / turma / segmento / serieOrdem from joins", () => {
    const row = buildDescontoRow(baseRaw({ planos: { valor_mensalidade: 600 } }), FUND1);
    expect(row!.nome).toBe("JOÃO SILVA");
    expect(row!.serie).toBe("5º Ano");
    expect(row!.serieId).toBe("s1");
    expect(row!.serieOrdem).toBe(5);
    expect(row!.turma).toBe("A");
    expect(row!.turmaId).toBe("t1");
    expect(row!.segmento).toBe("FUNDAMENTAL1");
  });

  it("picks responsavel_financeiro first and celular||telefone", () => {
    const respOther = {
      nome: "Carlos",
      parentesco: "pai",
      telefone: "62888880000",
      celular: "",
      responsavel_financeiro: false,
    };
    const raw = baseRaw({
      planos: { valor_mensalidade: 600 },
      alunos: { id: "a1", nome: "JOÃO SILVA", responsaveis_aluno: [respOther, respFin] },
    });
    const row = buildDescontoRow(raw, FUND1);
    expect(row!.responsavelNome).toBe("Maria");
    expect(row!.responsavelParentesco).toBe("mãe");
    expect(row!.responsavelTelefone).toBe("62999990000");
  });

  it("no responsável -> null fields", () => {
    const raw = baseRaw({
      planos: { valor_mensalidade: 600 },
      alunos: { id: "a1", nome: "JOÃO SILVA", responsaveis_aluno: [] },
    });
    const row = buildDescontoRow(raw, FUND1);
    expect(row!.responsavelNome).toBeNull();
    expect(row!.responsavelParentesco).toBeNull();
    expect(row!.responsavelTelefone).toBeNull();
  });
});

describe("buildDescontoRow — edge cases", () => {
  it("handles alunos: null defensively (no throw; returns row with fallbacks)", () => {
    const raw = baseRaw({
      planos: { valor_mensalidade: 600 },
      alunos: null,
    });
    const row = buildDescontoRow(raw, FUND1);
    expect(row).not.toBeNull();
    expect(row!.alunoId).toBe("");
    expect(row!.nome).toBe("—");
    expect(row!.responsavelNome).toBeNull();
  });
});
