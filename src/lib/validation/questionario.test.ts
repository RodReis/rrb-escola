import { describe, expect, it } from "vitest";
import { EscalaSchema, GrupoSchema, QuestaoSchema, QuestionarioSchema } from "./questionario";

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
    const r = QuestaoSchema.parse({ ...base, tipo: "objetiva_escala", alternativas: ["X", "Y"] });
    expect(r.alternativas).toEqual([]);
  });
  it("matriz descritiva salva só os campos base", () => {
    const r = QuestaoSchema.parse({ ...base, tipo: "matriz_descritiva" });
    expect(r).toMatchObject({ tipo: "matriz_descritiva", alternativas: [], qtdeLinhas: 0 });
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
