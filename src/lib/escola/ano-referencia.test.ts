import { describe, expect, it, vi } from "vitest";
import { getAnoReferenciaAtual } from "./ano-referencia";

function fakeSupabase(row: { ano_referencia_atual: number } | null, error: unknown = null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error })
        })
      })
    })
  } as never;
}

describe("getAnoReferenciaAtual", () => {
  it("retorna o ano_referencia_atual da escola", async () => {
    const ano = await getAnoReferenciaAtual(fakeSupabase({ ano_referencia_atual: 2031 }), "escola-1");
    expect(ano).toBe(2031);
  });

  it("cai para o ano do relógio quando a linha não existe", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-05-01"));
    const ano = await getAnoReferenciaAtual(fakeSupabase(null), "escola-1");
    expect(ano).toBe(2026);
    vi.useRealTimers();
  });

  it("cai para o ano do relógio quando a query falha", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2026-05-01"));
    const ano = await getAnoReferenciaAtual(fakeSupabase(null, new Error("boom")), "escola-1");
    expect(ano).toBe(2026);
    vi.useRealTimers();
  });
});
