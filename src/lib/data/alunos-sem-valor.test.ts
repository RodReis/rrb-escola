import { describe, it, expect } from "vitest";
import {
  deriveMotivo,
  isSemValor,
  buildRow,
  motivoTone,
  type RawAluno,
} from "./alunos-sem-valor-constants";

describe("isSemValor", () => {
  it("true when plano_id is null and no praticado", () => {
    expect(isSemValor(null, null, null)).toBe(true);
  });
  it("true when valor_matricula is 0 and no praticado", () => {
    expect(isSemValor("plan-1", 0, null)).toBe(true);
  });
  it("true when valor_matricula is null and no praticado", () => {
    expect(isSemValor("plan-1", null, null)).toBe(true);
  });
  it("false when plano with valor_matricula > 0", () => {
    expect(isSemValor("plan-1", 250, null)).toBe(false);
  });
  it("false when valor_mensalidade_praticado > 0 even without plano", () => {
    expect(isSemValor(null, null, 700)).toBe(false);
  });
  it("false when valor_mensalidade_praticado > 0 and plano valor 0", () => {
    expect(isSemValor("plan-1", 0, 700)).toBe(false);
  });
  it("true when praticado is 0 (fallback to plano check)", () => {
    expect(isSemValor(null, null, 0)).toBe(true);
  });
});

describe("deriveMotivo", () => {
  it("NORMAL + no plano + no praticado -> sem_valor", () => {
    expect(deriveMotivo("NORMAL", null, null, null, true)).toBe("sem_valor");
  });
  it("NORMAL + plano valor 0 + no praticado -> sem_valor", () => {
    expect(deriveMotivo("NORMAL", "plan-1", 0, null, true)).toBe("sem_valor");
  });
  it("NORMAL + no plano + praticado > 0 -> null (not shown)", () => {
    expect(deriveMotivo("NORMAL", null, null, 700, true)).toBeNull();
  });
  it("BOLSA_INTEGRAL + valid plano -> BOLSA_INTEGRAL (tipo_vaga wins)", () => {
    expect(deriveMotivo("BOLSA_INTEGRAL", "plan-1", 250, null, true)).toBe("BOLSA_INTEGRAL");
  });
  it("BOLSA_INTEGRAL + no plano -> BOLSA_INTEGRAL (tipo_vaga wins over sem_valor)", () => {
    expect(deriveMotivo("BOLSA_INTEGRAL", null, null, null, true)).toBe("BOLSA_INTEGRAL");
  });
  it("PERMUTA -> PERMUTA", () => {
    expect(deriveMotivo("PERMUTA", "plan-1", 250, null, true)).toBe("PERMUTA");
  });
  it("ISENTO -> ISENTO", () => {
    expect(deriveMotivo("ISENTO", "plan-1", 250, null, true)).toBe("ISENTO");
  });
  it("BOLSA_50_PORCENTO -> BOLSA_50_PORCENTO", () => {
    expect(deriveMotivo("BOLSA_50_PORCENTO", "plan-1", 100, null, true)).toBe("BOLSA_50_PORCENTO");
  });
  it("NORMAL + valid plano -> null (not included)", () => {
    expect(deriveMotivo("NORMAL", "plan-1", 250, null, true)).toBeNull();
  });
});

// sem_matricula path — the other deriveMotivo cases are covered in the main block above.
describe("deriveMotivo sem_matricula", () => {
  it("no matrícula -> sem_matricula (hasMatricula false)", () => {
    expect(deriveMotivo("NORMAL", null, null, null, false)).toBe("sem_matricula");
  });
  it("non-NORMAL + no matrícula still resolves sem_matricula (precedence)", () => {
    expect(deriveMotivo("BOLSA_INTEGRAL", null, null, null, false)).toBe("sem_matricula");
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
        tipo_vaga: "NORMAL",
        plano_id: null,
        status: "ativa",
        valor_mensalidade_praticado: null,
        percentual_bolsa: null,
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
    expect(row!.status).toBe("ativa");
    expect(row!.tipoVaga).toBe("NORMAL");
    expect(row!.planoId).toBeNull();
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
    expect(row!.status).toBeNull();
    expect(row!.tipoVaga).toBeNull();
    expect(row!.planoId).toBeNull();
  });

  it("returns null for an aluno with a paga matrícula and valid plano", () => {
    const ok: RawAluno = {
      ...alunoComMatricula,
      matriculas: [
        {
          id: "m1",
          tipo_vaga: "NORMAL",
          plano_id: "p1",
          status: "ativa",
          valor_mensalidade_praticado: null,
        percentual_bolsa: null,
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
  it("BOLSA_INTEGRAL -> warning", () => {
    expect(motivoTone("BOLSA_INTEGRAL")).toBe("warning");
  });
  it("BOLSA_50_PORCENTO -> warning", () => {
    expect(motivoTone("BOLSA_50_PORCENTO")).toBe("warning");
  });
  it("PERMUTA -> neutral", () => {
    expect(motivoTone("PERMUTA")).toBe("neutral");
  });
  it("ISENTO -> neutral", () => {
    expect(motivoTone("ISENTO")).toBe("neutral");
  });
});

describe("motivoTone sem_matricula", () => {
  it("sem_matricula -> danger", () => {
    expect(motivoTone("sem_matricula")).toBe("danger");
  });
});
