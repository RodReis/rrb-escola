import { describe, expect, it } from "vitest";
import {
  AssociacaoEdicaoSchema,
  AssociacaoLoteSchema,
  EscalaSchema,
  GrupoSchema,
  QuestaoSchema,
  QuestionarioSchema,
  SecaoSchema,
} from "./questionario";

const GRUPO = "11111111-1111-4111-8111-111111111111";
const base = {
  grupoId: GRUPO,
  tipo: "subjetiva",
  pergunta: "Como foi?",
  ativa: true,
  obrigatoria: false,
  limitarCaracteres: false,
  qtdeCaracteres: 0,
  qtdeLinhas: 0,
  alternativas: [] as string[],
  escalaId: null as string | null,
};

describe("GrupoSchema", () => {
  it("recusa descrição vazia ou só espaços", () => {
    expect(GrupoSchema.safeParse({ descricao: "   " }).success).toBe(false);
  });
  it("apara a descrição", () => {
    expect(GrupoSchema.parse({ descricao: "  Corpo  " }).descricao).toBe("Corpo");
  });
});

describe("EscalaSchema", () => {
  it("exige ao menos 2 opções", () => {
    const r = EscalaSchema.safeParse({ descricao: "E", opcoes: ["Sim"] });
    expect(r.success).toBe(false);
  });
  it("recusa opções repetidas ignorando caixa e espaços", () => {
    const r = EscalaSchema.safeParse({ descricao: "E", opcoes: ["Sim", "  sim "] });
    expect(r.success).toBe(false);
  });
  it("aceita e apara", () => {
    const r = EscalaSchema.parse({ descricao: " E ", opcoes: [" A ", "B"] });
    expect(r).toEqual({ descricao: "E", opcoes: ["A", "B"] });
  });
});

describe("QuestaoSchema", () => {
  it("subjetiva limitando caracteres exige a quantidade", () => {
    const r = QuestaoSchema.safeParse({ ...base, limitarCaracteres: true, qtdeCaracteres: 0 });
    expect(r.success).toBe(false);
  });
  it("subjetiva mantém limites e linhas", () => {
    const r = QuestaoSchema.parse({ ...base, limitarCaracteres: true, qtdeCaracteres: 200, qtdeLinhas: 4 });
    expect(r).toMatchObject({ limitarCaracteres: true, qtdeCaracteres: 200, qtdeLinhas: 4 });
  });
  it("única escolha exige 2 alternativas", () => {
    const r = QuestaoSchema.safeParse({ ...base, tipo: "objetiva_unica", alternativas: ["A"] });
    expect(r.success).toBe(false);
  });
  it("múltipla escolha recusa alternativas repetidas", () => {
    const r = QuestaoSchema.safeParse({ ...base, tipo: "objetiva_multipla", alternativas: ["A", " a"] });
    expect(r.success).toBe(false);
  });
  it("única escolha com 2 alternativas passa e zera limites", () => {
    const r = QuestaoSchema.parse({
      ...base, tipo: "objetiva_unica", alternativas: ["A", "B"],
      limitarCaracteres: true, qtdeCaracteres: 50, qtdeLinhas: 3,
    });
    expect(r).toMatchObject({ alternativas: ["A", "B"], limitarCaracteres: false, qtdeCaracteres: 0, qtdeLinhas: 0 });
  });
  it("tipos sem alternativas descartam as que vieram", () => {
    const r = QuestaoSchema.parse({ ...base, tipo: "objetiva_escala", alternativas: ["X", "Y"], escalaId: GRUPO });
    expect(r.alternativas).toEqual([]);
  });
  it("matriz descritiva salva só os campos base", () => {
    const r = QuestaoSchema.parse({ ...base, tipo: "matriz_descritiva" });
    expect(r).toMatchObject({ tipo: "matriz_descritiva", alternativas: [], qtdeLinhas: 0 });
  });
  it("questão com escala exige a escala padrão", () => {
    const r = QuestaoSchema.safeParse({ ...base, tipo: "objetiva_escala" });
    expect(r.success).toBe(false);
    const ok = QuestaoSchema.parse({ ...base, tipo: "objetiva_escala", escalaId: GRUPO });
    expect(ok.escalaId).toBe(GRUPO);
  });
  it("outros tipos descartam a escala que vier", () => {
    const r = QuestaoSchema.parse({ ...base, tipo: "subjetiva", escalaId: GRUPO });
    expect(r.escalaId).toBeNull();
  });
  it("recusa grupo que não é uuid", () => {
    expect(QuestaoSchema.safeParse({ ...base, grupoId: "" }).success).toBe(false);
  });
});

describe("QuestionarioSchema", () => {
  it("observação vazia vira null e aceita questionário sem vínculos", () => {
    const r = QuestionarioSchema.parse({ descricao: "Q", observacoes: "  ", ativo: true, vinculos: [] });
    expect(r.observacoes).toBeNull();
    expect(r.vinculos).toEqual([]);
  });
  it("recusa vínculo com questão que não é uuid", () => {
    const r = QuestionarioSchema.safeParse({
      descricao: "Q", observacoes: "", ativo: true, vinculos: [{ questaoId: "x", escalaId: null }],
    });
    expect(r.success).toBe(false);
  });
});

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const U3 = "33333333-3333-4333-8333-333333333333";

describe("SecaoSchema", () => {
  it("recusa descrição vazia e apara", () => {
    expect(SecaoSchema.safeParse({ descricao: "  ", permiteLancamentoColetivo: false }).success).toBe(false);
    expect(SecaoSchema.parse({ descricao: " Expressão corporal ", permiteLancamentoColetivo: true })).toEqual({
      descricao: "Expressão corporal",
      permiteLancamentoColetivo: true,
    });
  });
});

describe("AssociacaoLoteSchema", () => {
  const ok = { questionarioId: U1, professorId: U2, etapas: [1, 2], turmaIds: [U3] };
  it("aceita um lote válido", () => {
    expect(AssociacaoLoteSchema.safeParse(ok).success).toBe(true);
  });
  it("exige ao menos uma etapa e uma turma", () => {
    const semEtapa = AssociacaoLoteSchema.safeParse({ ...ok, etapas: [] });
    expect(!semEtapa.success && semEtapa.error.issues[0].message).toBe("Marque ao menos uma etapa");
    const semTurma = AssociacaoLoteSchema.safeParse({ ...ok, turmaIds: [] });
    expect(!semTurma.success && semTurma.error.issues[0].message).toBe("Marque ao menos uma turma");
  });
  it("recusa etapa fora de 1 a 4 e NaN", () => {
    expect(AssociacaoLoteSchema.safeParse({ ...ok, etapas: [5] }).success).toBe(false);
    expect(AssociacaoLoteSchema.safeParse({ ...ok, etapas: [0] }).success).toBe(false);
    expect(AssociacaoLoteSchema.safeParse({ ...ok, etapas: [NaN] }).success).toBe(false);
  });
});

describe("AssociacaoEdicaoSchema", () => {
  it("exige ids válidos e etapa de 1 a 4", () => {
    const ok = { id: U1, questionarioId: U2, turmaId: U3, professorId: U1, etapa: 3 };
    expect(AssociacaoEdicaoSchema.safeParse(ok).success).toBe(true);
    expect(AssociacaoEdicaoSchema.safeParse({ ...ok, etapa: 9 }).success).toBe(false);
    expect(AssociacaoEdicaoSchema.safeParse({ ...ok, turmaId: "" }).success).toBe(false);
  });
});
