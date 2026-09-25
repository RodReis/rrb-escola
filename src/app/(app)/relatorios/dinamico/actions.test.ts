import { describe, it, expect, vi, beforeEach } from "vitest";

const { requirePermissionMock, carregarAlunosMock, carregarFuncMock } = vi.hoisted(() => ({
  requirePermissionMock: vi.fn(),
  carregarAlunosMock: vi.fn(),
  carregarFuncMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requirePermission: requirePermissionMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/relatorio-dinamico/dados/aluno", () => ({
  carregarCtxAlunos: carregarAlunosMock,
  listarRegistrosAluno: vi.fn(),
}));
vi.mock("@/lib/relatorio-dinamico/dados/rh", () => ({
  carregarCtxFuncionarios: carregarFuncMock,
  listarRegistrosRh: vi.fn(),
}));

import { gerarDadosRelatorioAction } from "./actions";

const ID = "11111111-1111-1111-1111-111111111111";
const filtrosAluno = { ano: 2026, filtrarPor: "serie", valores: [], status: ["ativa"] };

beforeEach(() => {
  requirePermissionMock.mockReset().mockResolvedValue({ profile: { perfil: "secretaria", escola_id: "e1" }, permissions: {} });
  carregarAlunosMock.mockReset().mockResolvedValue([]);
  carregarFuncMock.mockReset().mockResolvedValue([]);
});

describe("gerarDadosRelatorioAction", () => {
  it("rejeita coluna fora do catálogo", async () => {
    const r = await gerarDadosRelatorioAction({ entidade: "aluno", ids: [ID], colunas: ["xxx"], ordenacao: [], filtros: filtrosAluno });
    expect(r).toEqual({ ok: false, error: "Coluna desconhecida: xxx" });
    expect(carregarAlunosMock).not.toHaveBeenCalled();
  });
  it("rejeita coluna salarial para quem não tem rh.folha-v2", async () => {
    const r = await gerarDadosRelatorioAction({ entidade: "funcionario", ids: [ID], colunas: ["ctr.salario"], ordenacao: [], filtros: null });
    expect(r).toEqual({ ok: false, error: "Coluna desconhecida: ctr.salario" });
  });
  it("rejeita acima do limite de registros", async () => {
    const ids = Array.from({ length: 2001 }, () => ID);
    const r = await gerarDadosRelatorioAction({ entidade: "aluno", ids, colunas: ["aluno.nome"], ordenacao: [], filtros: filtrosAluno });
    expect(r.ok).toBe(false);
  });
  it("pede permissão de leitura do módulo da entidade e só as relações necessárias", async () => {
    await gerarDadosRelatorioAction({ entidade: "aluno", ids: [ID], colunas: ["aluno.nome", "mae.nome"], ordenacao: [], filtros: filtrosAluno });
    expect(requirePermissionMock).toHaveBeenCalledWith("relatorios.dinamico-aluno", "read");
    expect(carregarAlunosMock).toHaveBeenCalledWith([ID], 2026, new Set(["responsaveis"]));
  });
  it("entidade inválida é recusada", async () => {
    const r = await gerarDadosRelatorioAction({ entidade: "x" as never, ids: [ID], colunas: [], ordenacao: [], filtros: null });
    expect(r.ok).toBe(false);
  });
});
