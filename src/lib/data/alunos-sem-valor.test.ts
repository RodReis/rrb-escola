import { describe, it, expect } from "vitest";
import {
  deriveMotivo,
  isSemValor,
  buildRow,
  motivoTone,
  type RawAluno,
} from "./alunos-sem-valor-constants";

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
    expect(deriveMotivo("paga", null, null, true)).toBe("sem_valor");
  });
  it("paga + plano valor 0 -> sem_valor", () => {
    expect(deriveMotivo("paga", "plan-1", 0, true)).toBe("sem_valor");
  });
  it("bolsa_integral + valid plano -> bolsa_integral (tipo_vaga wins)", () => {
    expect(deriveMotivo("bolsa_integral", "plan-1", 250, true)).toBe("bolsa_integral");
  });
  it("bolsa_integral + no plano -> bolsa_integral (tipo_vaga wins over sem_valor)", () => {
    expect(deriveMotivo("bolsa_integral", null, null, true)).toBe("bolsa_integral");
  });
  it("permuta -> permuta", () => {
    expect(deriveMotivo("permuta", "plan-1", 250, true)).toBe("permuta");
  });
  it("gratuita -> gratuita", () => {
    expect(deriveMotivo("gratuita", "plan-1", 250, true)).toBe("gratuita");
  });
  it("bolsa_parcial -> bolsa_parcial", () => {
    expect(deriveMotivo("bolsa_parcial", "plan-1", 100, true)).toBe("bolsa_parcial");
  });
  it("paga + valid plano -> null (not included)", () => {
    expect(deriveMotivo("paga", "plan-1", 250, true)).toBeNull();
  });
});

// sem_matricula path — the other deriveMotivo cases are covered in the main block above.
describe("deriveMotivo sem_matricula", () => {
  it("no matrícula -> sem_matricula (hasMatricula false)", () => {
    expect(deriveMotivo("paga", null, null, false)).toBe("sem_matricula");
  });
  it("non-paga + no matrícula still resolves sem_matricula (precedence)", () => {
    expect(deriveMotivo("bolsa_integral", null, null, false)).toBe("sem_matricula");
  });
});

describe("buildRow", () => {
  const respFin = {
    nome: "Carlos",
    parentesco: "pai",
    telefone: "62888880000",
    celular: "",
    responsavel_financeiro: true,
  };
  const respOther = {
    nome: "Maria",
    parentesco: "mãe",
    telefone: "",
    celular: "62999990000",
    responsavel_financeiro: false,
  };

  const alunoComMatricula: RawAluno = {
    id: "a1",
    nome: "JOÃO SILVA",
    matriculas: [
      {
        id: "m1",
        tipo_vaga: "paga",
        plano_id: null,
        status: "ativa",
        planos: null,
        turmas: { id: "t1", nome: "A", series: { id: "s1", nome: "1º Ano", ordem: 1 } },
      },
    ],
    responsaveis_aluno: [respOther, respFin],
  };

  const alunoSemMatricula: RawAluno = {
    id: "a2",
    nome: "ANA COSTA",
    matriculas: [],
    responsaveis_aluno: [],
  };

  it("derives a row for an aluno with a sem_valor matrícula", () => {
    const row = buildRow(alunoComMatricula);
    expect(row).not.toBeNull();
    expect(row!.alunoId).toBe("a1");
    expect(row!.matriculaId).toBe("m1");
    expect(row!.nome).toBe("JOÃO SILVA");
    expect(row!.serie).toBe("1º Ano");
    expect(row!.serieId).toBe("s1");
    expect(row!.turma).toBe("A");
    expect(row!.turmaId).toBe("t1");
    expect(row!.motivo).toBe("sem_valor");
  });

  it("orders responsavel_financeiro first and uses celular||telefone", () => {
    const row = buildRow(alunoComMatricula);
    expect(row!.responsaveis[0].nome).toBe("Carlos");
    expect(row!.responsaveis[0].telefone).toBe("62888880000");
    expect(row!.responsaveis[1].telefone).toBe("62999990000");
  });

  it("derives a sem_matricula row for an aluno with no 2026 matrícula", () => {
    const row = buildRow(alunoSemMatricula);
    expect(row).not.toBeNull();
    expect(row!.alunoId).toBe("a2");
    expect(row!.matriculaId).toBeNull();
    expect(row!.motivo).toBe("sem_matricula");
    expect(row!.serie).toBe("");
    expect(row!.serieId).toBeNull();
    expect(row!.turma).toBe("");
    expect(row!.turmaId).toBeNull();
    expect(row!.serieOrdem).toBe(9999);
  });

  it("returns null for an aluno with a paga matrícula and valid plano", () => {
    const ok: RawAluno = {
      ...alunoComMatricula,
      matriculas: [
        {
          id: "m1",
          tipo_vaga: "paga",
          plano_id: "p1",
          status: "ativa",
          planos: { valor_matricula: 250 },
          turmas: { id: "t1", nome: "A", series: { id: "s1", nome: "1º Ano", ordem: 1 } },
        },
      ],
    };
    expect(buildRow(ok)).toBeNull();
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

describe("motivoTone sem_matricula", () => {
  it("sem_matricula -> danger", () => {
    expect(motivoTone("sem_matricula")).toBe("danger");
  });
});
