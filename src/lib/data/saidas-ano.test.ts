import { describe, it, expect, vi, beforeEach } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn(async () => ({ from: fromMock })) }));

import { listarSaidasDoAno } from "./saidas-ano";

beforeEach(() => {
  fromMock.mockReset();
});

describe("listarSaidasDoAno", () => {
  it("filtra por ano letivo e cancelamento_data preenchida", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{
        id: "m1",
        cancelamento_motivo: "transferencia",
        cancelamento_data: "2026-04-10",
        ciente_coordenacao: true,
        ciente_diretoria: true,
        alunos: { nome: "Ana Souza" },
        series: { nome: "5º Ano" },
        turmas: { nome: "A" },
      }],
      error: null,
    });
    const not = vi.fn().mockReturnValue({ order });
    const eq2 = vi.fn().mockReturnValue({ not });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    fromMock.mockReturnValue({ select });

    const result = await listarSaidasDoAno(2026);

    expect(select).toHaveBeenCalled();
    expect(eq1).toHaveBeenCalledWith("ano_letivo", 2026);
    expect(eq2).toHaveBeenCalledWith("status", "cancelada");
    expect(not).toHaveBeenCalledWith("cancelamento_data", "is", null);
    expect(result).toEqual([{
      id: "m1",
      alunoNome: "Ana Souza",
      serieNome: "5º Ano",
      turmaNome: "A",
      motivo: "transferencia",
      motivoLabel: "Transferência",
      data: "2026-04-10",
      cienteCoordenacao: true,
      cienteDiretoria: true,
    }]);
  });

  it("nao inclui matricula concluida sem cancelamento_data (nao renovacao)", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const not = vi.fn().mockReturnValue({ order });
    const eq2 = vi.fn().mockReturnValue({ not });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    fromMock.mockReturnValue({ select });

    const result = await listarSaidasDoAno(2026);
    expect(result).toEqual([]);
  });
});
