import { describe, expect, it } from "vitest";
import { montarFiltroAlunosAtivos } from "./students-shared-constants";

describe("montarFiltroAlunosAtivos", () => {
  it("usa ano corrente quando anoLetivo nao informado", () => {
    const anoAtual = new Date().getFullYear();
    expect(montarFiltroAlunosAtivos({}).anoLetivo).toBe(anoAtual);
  });

  it("usa anoLetivo explicito quando informado", () => {
    expect(montarFiltroAlunosAtivos({ anoLetivo: 2024 }).anoLetivo).toBe(2024);
  });

  it("normaliza nome de busca para comparacao sem acento", () => {
    expect(montarFiltroAlunosAtivos({ nome: "CÔRTES" }).nomeNormalizado).toBe("cortes");
  });

  it("nome ausente nao gera filtro de nome", () => {
    expect(montarFiltroAlunosAtivos({}).nomeNormalizado).toBeUndefined();
  });

  it("repassa serieId e turmaId sem alteracao", () => {
    const r = montarFiltroAlunosAtivos({ serieId: "s1", turmaId: "t1" });
    expect(r.serieId).toBe("s1");
    expect(r.turmaId).toBe("t1");
  });
});
