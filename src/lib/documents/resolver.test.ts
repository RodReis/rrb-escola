import { describe, expect, it, vi } from "vitest";
import { resolveMappings, type ResolverContext } from "./resolver";

function fakeSupabase(anoReferenciaAtual: number) {
  return {
    from(table: string) {
      if (table === "matriculas") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null })
            })
          })
        };
      }
      if (table === "escolas") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { ano_referencia_atual: anoReferenciaAtual }, error: null })
            })
          })
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) })
      };
    }
  } as never;
}

function ctx(anoReferenciaAtual: number): ResolverContext {
  return {
    supabase: fakeSupabase(anoReferenciaAtual),
    matriculaId: "matricula-1",
    alunoId: "aluno-1",
    escolaId: "escola-1"
  };
}

describe("resolveMappings — computed ano_letivo_atual", () => {
  it("usa o ano de referência da escola, sem corte de mês", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-12-15"));

    const resultado = await resolveMappings(
      [{ type: "computed", placeholder: "ANO", fn: "ano_letivo_atual" }],
      ctx(2031)
    );

    expect(resultado.ANO).toBe("2031");
    vi.useRealTimers();
  });
});
