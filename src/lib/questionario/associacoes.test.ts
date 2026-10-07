import { describe, expect, it } from "vitest";
import { anoPadrao, combinarAssociacoes, rotuloTurma, unicos } from "./associacoes";

describe("unicos", () => {
  it("remove repetidos preservando a ordem", () => {
    expect(unicos([3, 1, 3, 2, 1])).toEqual([3, 1, 2]);
  });
});

describe("combinarAssociacoes", () => {
  it("cria todas as combinações etapa × turma quando nada existe", () => {
    const r = combinarAssociacoes([1, 2], ["t1", "t2"], []);
    expect(r.criar).toEqual([
      { turmaId: "t1", etapa: 1 },
      { turmaId: "t1", etapa: 2 },
      { turmaId: "t2", etapa: 1 },
      { turmaId: "t2", etapa: 2 },
    ]);
    expect(r.ignoradas).toBe(0);
  });
  it("ignora as que já existem e conta quantas", () => {
    const r = combinarAssociacoes([1, 2], ["t1", "t2"], [{ turmaId: "t1", etapa: 2 }, { turmaId: "t2", etapa: 1 }]);
    expect(r.criar).toEqual([{ turmaId: "t1", etapa: 1 }, { turmaId: "t2", etapa: 2 }]);
    expect(r.ignoradas).toBe(2);
  });
  it("tudo existente → nada a criar", () => {
    const r = combinarAssociacoes([1], ["t1"], [{ turmaId: "t1", etapa: 1 }]);
    expect(r).toEqual({ criar: [], ignoradas: 1 });
  });
  it("etapas e turmas repetidas na entrada não geram combinação duplicada", () => {
    const r = combinarAssociacoes([1, 1], ["t1", "t1"], []);
    expect(r.criar).toEqual([{ turmaId: "t1", etapa: 1 }]);
  });
});

describe("anoPadrao", () => {
  it("usa o ano atual se existe; senão o maior; null sem anos", () => {
    expect(anoPadrao([2026, 2025], 2026)).toBe(2026);
    expect(anoPadrao([2026, 2025], 2027)).toBe(2026);
    expect(anoPadrao([], 2026)).toBeNull();
  });
});

describe("rotuloTurma", () => {
  it("junta nome e turno legível; sem repetir quando o nome já é o turno", () => {
    expect(rotuloTurma("A", "matutino")).toBe("A (Matutino)");
    expect(rotuloTurma("Vespertino", "vespertino")).toBe("Vespertino");
  });
});
