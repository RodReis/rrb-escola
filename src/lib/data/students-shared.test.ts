import { describe, expect, it } from "vitest";
import { alunoSemMatriculaAtivaNoAno, montarFiltroAlunosAtivos } from "./students-shared-constants";
import { buildAlunosAtivosQuery } from "./students";

/**
 * Fake mínimo de query builder do Supabase: cada método encadeável grava a
 * chamada num array e retorna `this`, sem tocar rede. Suficiente para
 * inspecionar QUAIS chamadas `buildAlunosAtivosQuery` faz.
 */
function createFakeQueryBuilder() {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder = {
    calls,
    select(...args: unknown[]) {
      calls.push({ method: "select", args });
      return builder;
    },
    eq(...args: unknown[]) {
      calls.push({ method: "eq", args });
      return builder;
    },
    ilike(...args: unknown[]) {
      calls.push({ method: "ilike", args });
      return builder;
    },
    order(...args: unknown[]) {
      calls.push({ method: "order", args });
      return builder;
    },
  };
  return builder;
}

function createFakeSupabase() {
  const builder = createFakeQueryBuilder();
  const supabase = {
    from(...args: unknown[]) {
      builder.calls.push({ method: "from", args });
      return builder;
    },
  };
  return { supabase, builder };
}

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

describe("buildAlunosAtivosQuery", () => {
  const filtro = { anoLetivo: 2026 };

  it("usa a MESMA select string com countOnly true e false (regressao do bug critico)", () => {
    const fakeTrue = createFakeSupabase();
    const fakeFalse = createFakeSupabase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildAlunosAtivosQuery(fakeTrue.supabase as any, filtro, { countOnly: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildAlunosAtivosQuery(fakeFalse.supabase as any, filtro, { countOnly: false });

    const selectArgsTrue = fakeTrue.builder.calls.find((c) => c.method === "select")?.args[0];
    const selectArgsFalse = fakeFalse.builder.calls.find((c) => c.method === "select")?.args[0];

    expect(selectArgsTrue).toBe(selectArgsFalse);
    expect(selectArgsTrue).toContain("matriculas!inner");
  });

  it("countOnly so afeta o parametro head, nunca o select", () => {
    const fake = createFakeSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildAlunosAtivosQuery(fake.supabase as any, filtro, { countOnly: true });

    const selectCall = fake.builder.calls.find((c) => c.method === "select");
    expect(selectCall?.args[1]).toEqual({ count: "exact", head: true });
  });

  it("aplica status=ativa e ano_letivo independente de countOnly", () => {
    for (const countOnly of [true, false]) {
      const fake = createFakeSupabase();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      buildAlunosAtivosQuery(fake.supabase as any, filtro, { countOnly });

      const eqCalls = fake.builder.calls.filter((c) => c.method === "eq");
      expect(eqCalls).toContainEqual({ method: "eq", args: ["matriculas.status", "ativa"] });
      expect(eqCalls).toContainEqual({ method: "eq", args: ["matriculas.ano_letivo", 2026] });
    }
  });
});

describe("alunoSemMatriculaAtivaNoAno", () => {
  it("aluno sem nenhuma matricula -> true (entra no combo)", () => {
    expect(alunoSemMatriculaAtivaNoAno([], 2026)).toBe(true);
  });

  it("aluno com matricula concluida no ano (nao ativa) -> true", () => {
    expect(
      alunoSemMatriculaAtivaNoAno([{ ano_letivo: 2026, status: "concluida" }], 2026)
    ).toBe(true);
  });

  it("aluno com matricula ativa no ano -> false (ja matriculado, sai do combo)", () => {
    expect(
      alunoSemMatriculaAtivaNoAno([{ ano_letivo: 2026, status: "ativa" }], 2026)
    ).toBe(false);
  });

  it("aluno com matricula ativa em outro ano -> true (ano corrente livre)", () => {
    expect(
      alunoSemMatriculaAtivaNoAno([{ ano_letivo: 2025, status: "ativa" }], 2026)
    ).toBe(true);
  });
});
