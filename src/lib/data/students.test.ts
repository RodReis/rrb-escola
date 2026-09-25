import { describe, it, expect, vi, beforeEach } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn(async () => ({ from: fromMock })) }));

import { getFinanceiroMesCorrentePorAluno, listStudents } from "./students";

beforeEach(() => {
  fromMock.mockReset();
});

describe("getFinanceiroMesCorrentePorAluno", () => {
  it("retorna um mapa aluno_id -> status, usando so cobrancas do mes corrente", async () => {
    // Chain real: select().in().gte().lte() — cada elo encadeado no anterior,
    // resolvendo so no ultimo (.lte()).
    const lte = vi.fn().mockResolvedValue({
      data: [
        { aluno_id: "aluno-1", origem: "isaac", status: "paga", data_vencimento: "2026-09-10" },
        { aluno_id: "aluno-2", origem: "manual", status: "aberta", data_vencimento: "2026-09-01" },
      ],
      error: null,
    });
    const gte = vi.fn().mockReturnValue({ lte });
    const inFn = vi.fn().mockReturnValue({ gte });
    const select = vi.fn().mockReturnValue({ in: inFn });
    fromMock.mockReturnValue({ select });

    const result = await getFinanceiroMesCorrentePorAluno(["aluno-1", "aluno-2", "aluno-3"]);

    expect(result.get("aluno-1")).toBe("pago_isaac");
    expect(result.get("aluno-2")).toBe("vencido");
    expect(result.has("aluno-3")).toBe(false);
  });

  it("retorna mapa vazio para lista de ids vazia, sem consultar o banco", async () => {
    const result = await getFinanceiroMesCorrentePorAluno([]);
    expect(result.size).toBe(0);
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("listStudents com filtro financeiro", () => {
  it("filtra por status financeiro antes de paginar", async () => {
    // listStudents chama runStudentsQuery (nao exportada) internamente, que
    // monta a chain real: from("alunos").select(sel, {count}).eq("escola_id",
    // ...).order("nome").range(from, to) — sem outros filtros (nome/situacao
    // padrao "ativos"/sem enrollment filter) so entra o .eq("ativo", true)
    // extra. O resultado final e obtido via await direto na query (thenable),
    // entao o ultimo elo da chain precisa resolver a promise.
    const alunosBase = [
      { id: "a1", nome: "Ana" },
      { id: "a2", nome: "Bruno" },
      { id: "a3", nome: "Carla" },
      { id: "a4", nome: "Davi" },
      { id: "a5", nome: "Elis" },
    ];
    // Chain real (sem outros filtros, situacao default "ativos", sem
    // enrollment filter): select().eq(escola_id).order().range().eq(ativo) —
    // so o ultimo elo resolve.
    const eqAtivo = vi.fn().mockResolvedValue({ data: alunosBase, error: null, count: alunosBase.length });
    const range = vi.fn().mockReturnValue({ eq: eqAtivo });
    const order = vi.fn().mockReturnValue({ range });
    const eqEscola = vi.fn().mockReturnValue({ order });
    const alunosSelect = vi.fn().mockReturnValue({ eq: eqEscola });

    fromMock.mockImplementation((table: string) => {
      if (table === "cobrancas") {
        const lte = vi.fn().mockResolvedValue({
          data: [
            { aluno_id: "a2", origem: "manual", status: "aberta", data_vencimento: "2026-09-01" },
            { aluno_id: "a4", origem: "manual", status: "aberta", data_vencimento: "2026-09-02" },
          ],
          error: null,
        });
        const gte = vi.fn().mockReturnValue({ lte });
        const inFn = vi.fn().mockReturnValue({ gte });
        return { select: vi.fn().mockReturnValue({ in: inFn }) };
      }
      return { select: alunosSelect };
    });

    const result = await listStudents({ financeiro: "vencido", page: 1, pageSize: 1 });

    expect(result.total).toBe(2); // so a2 e a4 batem "vencido"
    expect(result.rows).toHaveLength(1); // pageSize=1 corta dentro do subconjunto de 2
  });
});
