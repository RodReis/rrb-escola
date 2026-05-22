import { describe, it, expect } from "vitest";
import { deriveMotivo, isSemValor, buildRow, motivoTone, type RawMatricula } from "./alunos-sem-valor";

describe("isSemValor", () => {
  it("true when plano_id is null", () => {
    expect(isSemValor(null, null)).toBe(true);
  });
  it("true when valor_matricula is 0", () => {
    expect(isSemValor("plan-1", 0)).toBe(true);
  });
  it("true when valor_matricula is null", () => {
    expect(isSemValor("plan-1", null)).toBe(true);
  });
  it("false when plano with valor_matricula > 0", () => {
    expect(isSemValor("plan-1", 250)).toBe(false);
  });
});

describe("deriveMotivo", () => {
  it("paga + no plano -> sem_valor", () => {
    expect(deriveMotivo("paga", null, null)).toBe("sem_valor");
  });
  it("paga + plano valor 0 -> sem_valor", () => {
    expect(deriveMotivo("paga", "plan-1", 0)).toBe("sem_valor");
  });
  it("bolsa_integral + valid plano -> bolsa_integral (tipo_vaga wins)", () => {
    expect(deriveMotivo("bolsa_integral", "plan-1", 250)).toBe("bolsa_integral");
  });
  it("bolsa_integral + no plano -> bolsa_integral (tipo_vaga wins over sem_valor)", () => {
    expect(deriveMotivo("bolsa_integral", null, null)).toBe("bolsa_integral");
  });
  it("permuta -> permuta", () => {
    expect(deriveMotivo("permuta", "plan-1", 250)).toBe("permuta");
  });
  it("gratuita -> gratuita", () => {
    expect(deriveMotivo("gratuita", "plan-1", 250)).toBe("gratuita");
  });
  it("bolsa_parcial -> bolsa_parcial", () => {
    expect(deriveMotivo("bolsa_parcial", "plan-1", 100)).toBe("bolsa_parcial");
  });
  it("paga + valid plano -> null (not included)", () => {
    expect(deriveMotivo("paga", "plan-1", 250)).toBeNull();
  });
});

describe("buildRow", () => {
  const raw: RawMatricula = {
    id: "m1",
    tipo_vaga: "paga",
    plano_id: null,
    alunos: { id: "a1", nome: "JOÃO SILVA" },
    planos: null,
    turmas: { id: "t1", nome: "A", series: { id: "s1", nome: "1º Ano", ordem: 1 } },
    responsaveis_aluno: [
      { nome: "Maria", parentesco: "mãe", telefone: "", celular: "62999990000", responsavel_financeiro: false },
      { nome: "Carlos", parentesco: "pai", telefone: "62888880000", celular: "", responsavel_financeiro: true },
    ],
  };

  it("derives fields and includes the row", () => {
    const row = buildRow(raw);
    expect(row).not.toBeNull();
    expect(row!.nome).toBe("JOÃO SILVA");
    expect(row!.serie).toBe("1º Ano");
    expect(row!.turma).toBe("A");
    expect(row!.motivo).toBe("sem_valor");
    expect(row!.valorMatricula).toBe(0);
  });

  it("orders responsavel_financeiro first and uses celular||telefone", () => {
    const row = buildRow(raw);
    expect(row!.responsaveis[0].nome).toBe("Carlos");
    expect(row!.responsaveis[0].telefone).toBe("62888880000");
    expect(row!.responsaveis[1].nome).toBe("Maria");
    expect(row!.responsaveis[1].telefone).toBe("62999990000");
  });

  it("returns null for a paga matricula with valid plano", () => {
    const ok: RawMatricula = { ...raw, plano_id: "p1", planos: { valor_matricula: 250 } };
    expect(buildRow(ok)).toBeNull();
  });

  it("handles a student with no responsaveis", () => {
    const noResp: RawMatricula = { ...raw, responsaveis_aluno: [] };
    expect(buildRow(noResp)!.responsaveis).toEqual([]);
  });
});

describe("motivoTone", () => {
  it("sem_valor -> danger", () => {
    expect(motivoTone("sem_valor")).toBe("danger");
  });
  it("bolsa_integral -> warning", () => {
    expect(motivoTone("bolsa_integral")).toBe("warning");
  });
  it("bolsa_parcial -> warning", () => {
    expect(motivoTone("bolsa_parcial")).toBe("warning");
  });
  it("permuta -> neutral", () => {
    expect(motivoTone("permuta")).toBe("neutral");
  });
  it("gratuita -> neutral", () => {
    expect(motivoTone("gratuita")).toBe("neutral");
  });
});
