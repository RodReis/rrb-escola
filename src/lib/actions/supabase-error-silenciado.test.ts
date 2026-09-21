/**
 * Prova que um write do Supabase sem checagem de `error` some em silencio.
 *
 * O client do Supabase NAO lanca excecao quando o banco recusa a operacao:
 * `insert/update/delete` resolvem com `{ data: null, error }`. Quem faz
 *
 *     await supabase.from("x").insert({ ... });
 *     revalidatePath("/x");
 *
 * descarta esse `error`, revalida a pagina e devolve sucesso ao usuario —
 * que ve um toast verde e uma linha que nunca foi gravada.
 *
 * Este teste nao depende de banco: usa um duble que imita o contrato de
 * retorno do supabase-js (resolve com `{ error }`, nunca rejeita).
 */

import { describe, expect, it, vi } from "vitest";

type RespostaSupabase = { data: unknown; error: { message: string; code: string } | null };

/** Duble do PostgrestBuilder: resolve com `{ error }`, nunca rejeita. */
function fakeSupabase(resposta: RespostaSupabase) {
  return {
    from: () => ({
      insert: () => Promise.resolve(resposta),
      update: () => ({ eq: () => Promise.resolve(resposta) }),
      delete: () => ({ eq: () => Promise.resolve(resposta) }),
    }),
  };
}

const RLS_NEGADO = {
  data: null,
  error: { message: 'new row violates row-level security policy for table "avaliacoes"', code: "42501" },
};

describe("write do Supabase sem checar error", () => {
  it("nao lanca excecao quando o banco recusa — o erro so aparece no retorno", async () => {
    const supabase = fakeSupabase(RLS_NEGADO);

    // Exatamente o formato usado em avaliacoes.ts:34 e em outros 44 pontos:
    // o valor resolvido e ignorado.
    await expect(supabase.from().insert()).resolves.toBeDefined();

    // Nada foi lancado. Um try/catch em volta nao pegaria nada.
    let lancou = false;
    try {
      await supabase.from().insert();
    } catch {
      lancou = true;
    }
    expect(lancou).toBe(false);
  });

  it("padrao atual: revalida e devolve sucesso mesmo com a escrita recusada", async () => {
    const supabase = fakeSupabase(RLS_NEGADO);
    const revalidatePath = vi.fn();

    // Reproducao fiel do corpo de createAvaliacaoAction.
    async function actionComoEstaHoje() {
      await supabase.from().insert(); // <- error descartado
      revalidatePath("/avaliacoes");
    }

    await expect(actionComoEstaHoje()).resolves.toBeUndefined();
    expect(revalidatePath).toHaveBeenCalledWith("/avaliacoes");
    // A action completou "com sucesso" e a linha nao existe.
  });

  it("com assertOk: o erro do banco vira erro da action antes de revalidar", async () => {
    const supabase = fakeSupabase(RLS_NEGADO);
    const revalidatePath = vi.fn();

    function assertOk<T extends { error: { message: string } | null }>(resposta: T): T {
      if (resposta.error) throw new Error(resposta.error.message);
      return resposta;
    }

    async function actionCorrigida() {
      assertOk(await supabase.from().insert());
      revalidatePath("/avaliacoes");
    }

    await expect(actionCorrigida()).rejects.toThrow(/row-level security/);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("assertOk deixa passar a escrita que deu certo", async () => {
    const supabase = fakeSupabase({ data: [{ id: "1" }], error: null });

    function assertOk<T extends { error: { message: string } | null }>(resposta: T): T {
      if (resposta.error) throw new Error(resposta.error.message);
      return resposta;
    }

    expect(() => assertOk({ data: [{ id: "1" }], error: null })).not.toThrow();
    await expect(supabase.from().insert()).resolves.toMatchObject({ error: null });
  });
});
