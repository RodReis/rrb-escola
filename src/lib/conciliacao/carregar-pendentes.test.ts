import { describe, expect, it } from "vitest";
import { carregarPendentes } from "@/lib/conciliacao/carregar-pendentes";

/**
 * Fake mínimo do client Supabase: cada `.range(offset, until)` devolve uma
 * fatia de `todasAsLinhas`, simulando o corte de 1000 do PostgREST sobre um
 * dataset maior que uma página — é o cenário exato do C1 (1220 pendentes).
 */
function fakeSupabase(todasAsLinhas: { id: string; status_conciliacao: string }[]) {
  return {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        in(_col: string, status: string[]) {
          this._status = status;
          return this;
        },
        order() {
          return this;
        },
        async range(offset: number, until: number) {
          const filtradas = todasAsLinhas.filter((l) => this._status.includes(l.status_conciliacao));
          return { data: filtradas.slice(offset, until + 1), error: null };
        },
        _status: [] as string[],
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("carregarPendentes", () => {
  it("pagina em loop até esgotar, sem cortar em 1000 linhas", async () => {
    const linhas = Array.from({ length: 1220 }, (_, i) => ({
      id: `l${i}`,
      status_conciliacao: "pendente",
    }));
    const supabase = fakeSupabase(linhas);

    const resultado = await carregarPendentes(supabase, "escola-1", ["pendente"]);

    expect(resultado).toHaveLength(1220);
  });

  it("para na primeira página menor que o tamanho pedido (dataset pequeno, 1 chamada basta)", async () => {
    const linhas = [{ id: "a", status_conciliacao: "pendente" }, { id: "b", status_conciliacao: "auto" }];
    const supabase = fakeSupabase(linhas);

    const resultado = await carregarPendentes(supabase, "escola-1", ["pendente", "auto"]);

    expect(resultado.map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("propaga erro do Supabase em vez de engolir silenciosamente", async () => {
    const supabase = {
      from: () => ({
        select() { return this; },
        eq() { return this; },
        in() { return this; },
        order() { return this; },
        range: async () => ({ data: null, error: { message: "boom" } }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    await expect(carregarPendentes(supabase, "escola-1", ["pendente"])).rejects.toEqual({ message: "boom" });
  });
});
