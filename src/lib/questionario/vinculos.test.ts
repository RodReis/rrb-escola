import { describe, expect, it } from "vitest";
import { diffVinculos, normalizarVinculos, questoesParaAdicionar, type QuestaoInfo } from "./vinculos";

const info = (tipo: QuestaoInfo["tipo"], pergunta = "P", ativa = true): QuestaoInfo => ({ tipo, pergunta, ativa });

describe("normalizarVinculos", () => {
  const questoes = new Map<string, QuestaoInfo>([
    ["q1", info("subjetiva", "Pergunta 1")],
    ["q2", info("objetiva_escala", "Pergunta 2")],
  ]);

  it("numera por posição e zera a escala de tipo que não usa escala", () => {
    const r = normalizarVinculos(
      [{ questaoId: "q1", escalaId: "e1" }, { questaoId: "q2", escalaId: "e1" }],
      questoes,
    );
    expect(r).toEqual({
      ok: true,
      vinculos: [
        { id: undefined, questaoId: "q1", escalaId: null, ordem: 1 },
        { id: undefined, questaoId: "q2", escalaId: "e1", ordem: 2 },
      ],
    });
  });
  it("exige escala para questão com escala", () => {
    const r = normalizarVinculos([{ questaoId: "q2", escalaId: null }], questoes);
    expect(r).toEqual({ ok: false, error: 'Escolha a escala da questão "Pergunta 2".' });
  });
  it("recusa questão repetida", () => {
    const r = normalizarVinculos([{ questaoId: "q1", escalaId: null }, { questaoId: "q1", escalaId: null }], questoes);
    expect(r.ok).toBe(false);
  });
  it("recusa questão desconhecida", () => {
    const r = normalizarVinculos([{ questaoId: "zzz", escalaId: null }], questoes);
    expect(r.ok).toBe(false);
  });
});

describe("diffVinculos", () => {
  const atuais = [{ id: "v1", questaoId: "q1" }, { id: "v2", questaoId: "q2" }];

  it("separa manter/atualizar, inserir e remover", () => {
    const d = diffVinculos(atuais, [
      { id: "v1", questaoId: "q1", escalaId: null, ordem: 2 },
      { questaoId: "q3", escalaId: null, ordem: 1 },
    ]);
    expect(d.atualizar).toEqual([{ id: "v1", questaoId: "q1", escalaId: null, ordem: 2 }]);
    expect(d.inserir).toEqual([{ id: undefined, questaoId: "q3", escalaId: null, ordem: 1 }]);
    expect(d.remover).toEqual(["v2"]);
  });
  it("id que não pertence ao questionário vira inserção (nunca atualiza linha alheia)", () => {
    const d = diffVinculos(atuais, [{ id: "estranho", questaoId: "q9", escalaId: null, ordem: 1 }]);
    expect(d.atualizar).toEqual([]);
    expect(d.inserir).toHaveLength(1);
    expect(d.remover).toEqual(["v1", "v2"]);
  });
});

describe("questoesParaAdicionar", () => {
  const todas = [
    { id: "a", grupoId: "g1" },
    { id: "b", grupoId: "g1" },
    { id: "c", grupoId: "g2" },
  ];
  it("'Todos' do grupo adiciona as que faltam", () => {
    expect(questoesParaAdicionar(todas, new Set(["a"]), "g1", null)).toEqual(["b"]);
  });
  it("sem grupo nem questão adiciona todas as que faltam", () => {
    expect(questoesParaAdicionar(todas, new Set(), null, null)).toEqual(["a", "b", "c"]);
  });
  it("questão específica já adicionada não duplica", () => {
    expect(questoesParaAdicionar(todas, new Set(["c"]), null, "c")).toEqual([]);
    expect(questoesParaAdicionar(todas, new Set(), null, "c")).toEqual(["c"]);
  });
});
