import { describe, it, expect, vi, beforeEach } from "vitest";

// Teste de integração do achado CRITICAL da revisão final: emissão em lote
// SEM overrides não pode vazar dados pessoais de um aluno para os demais.
// Antes da correção, `declaracao-emissao-form.tsx` mandava sempre o texto
// já resolvido para o "aluno de referência" como override, e
// `carregarDeclaracoesAction` usava esse texto (sem nenhum [TOKEN] restante)
// como "modelo" para todos os alunos do lote — todas as páginas saíam com
// os dados do primeiro aluno. Este teste prova que, no caminho principal
// (lote, sem overrides), cada aluno é resolvido com os PRÓPRIOS dados.

const mockRequirePermission = vi.fn().mockResolvedValue({ profile: { escola_id: "escola-1" } });
vi.mock("@/lib/auth/session", () => ({
  requirePermission: (...args: unknown[]) => mockRequirePermission(...args)
}));

const mockGetDeclaracaoModeloById = vi.fn();
vi.mock("@/lib/data/declaracoes", () => ({
  getDeclaracaoModeloById: (...args: unknown[]) => mockGetDeclaracaoModeloById(...args)
}));

const mockBuscarDadosDeclaracao = vi.fn();
vi.mock("@/lib/data/declaracao-emissao", () => ({
  buscarDadosDeclaracao: (...args: unknown[]) => mockBuscarDadosDeclaracao(...args)
}));

const mockGetCredenciamentoVigente = vi.fn();
vi.mock("@/lib/data/historico", () => ({
  getCredenciamentoVigente: (...args: unknown[]) => mockGetCredenciamentoVigente(...args)
}));

const mockMaybeSingle = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mockMaybeSingle })
      })
    })
  })
}));

import { carregarDeclaracoesAction, previsualizarDeclaracaoAction } from "./declaracao-emissao";

const modelo = {
  id: "modelo-1",
  codigo: 1,
  nome: "Declaração de Frequência",
  titulo: "DECLARAÇÃO",
  texto: "Aluno [NOME_ALUNO], matrícula [MATRICULA].",
  fecho: "F",
  ativo: true,
  created_at: null,
  updated_at: null
};

const credenciamento = {
  logoPath: null,
  nomeFantasia: "EPG Trindade",
  cnpj: null,
  endereco: null,
  cidade: "Trindade",
  uf: "GO",
  cep: null,
  secretarioNome: "Fulano",
  secretarioCargo: "Secretário",
  diretorNome: "Ciclana",
  diretorCargo: "Diretora"
};

function dadosPara(nome: string, matricula: string) {
  return {
    nomeAluno: nome,
    matricula,
    dataNascimento: "2015-01-01",
    naturalidade: "Trindade - GO",
    filiacao: `PAI DE ${nome}`,
    anoLetivo: 2026,
    serieCorrente: "3º ANO",
    turma: "3º ANO A",
    turno: "Matutino",
    proximaSerie: "4º ANO",
    nomeEmpresa: "EPG Trindade",
    cidadeEmpresa: "Trindade",
    dataEmissaoIso: "2026-09-24"
  };
}

describe("carregarDeclaracoesAction", () => {
  beforeEach(() => {
    mockRequirePermission.mockClear();
    mockGetDeclaracaoModeloById.mockReset().mockResolvedValue(modelo);
    mockGetCredenciamentoVigente.mockReset().mockResolvedValue(credenciamento);
    mockMaybeSingle.mockReset().mockResolvedValue({ data: { serie_id: "serie-1", ano_letivo: 2026 } });
  });

  it("checa a permissao historico/read antes de montar as paginas", async () => {
    mockBuscarDadosDeclaracao.mockResolvedValue(dadosPara("ANA", "2026-001"));
    await carregarDeclaracoesAction(["mat-ana"], "modelo-1");
    expect(mockRequirePermission).toHaveBeenCalledWith("historico", "read");
  });

  it("emissão em lote SEM overrides resolve cada aluno com os PRÓPRIOS dados — não vaza os dados do primeiro aluno para os demais", async () => {
    mockBuscarDadosDeclaracao.mockImplementation(async (matriculaId: string) => {
      if (matriculaId === "mat-ana") return dadosPara("ANA", "2026-001");
      if (matriculaId === "mat-bruno") return dadosPara("BRUNO", "2026-002");
      throw new Error("matrícula inesperada");
    });

    const { paginas, falhas } = await carregarDeclaracoesAction(["mat-ana", "mat-bruno"], "modelo-1");

    expect(falhas).toEqual([]);
    expect(paginas).toHaveLength(2);

    // Página 1 (ANA): deve conter os dados da ANA, nunca os do BRUNO.
    expect(paginas[0].corpo).toContain("ANA");
    expect(paginas[0].corpo).toContain("2026-001");
    expect(paginas[0].corpo).not.toContain("BRUNO");
    expect(paginas[0].corpo).not.toContain("2026-002");

    // Página 2 (BRUNO): deve conter os dados do BRUNO, nunca os da ANA.
    expect(paginas[1].corpo).toContain("BRUNO");
    expect(paginas[1].corpo).toContain("2026-002");
    expect(paginas[1].corpo).not.toContain("ANA");
    expect(paginas[1].corpo).not.toContain("2026-001");
  });

  it("aluno sem credenciamento entra em falhas com o nome, sem derrubar o lote", async () => {
    mockBuscarDadosDeclaracao.mockImplementation(async (matriculaId: string) => {
      if (matriculaId === "mat-ana") return dadosPara("ANA", "2026-001");
      if (matriculaId === "mat-bruno") return dadosPara("BRUNO", "2026-002");
      throw new Error("matrícula inesperada");
    });
    mockGetCredenciamentoVigente.mockImplementation(async () => null);

    const { paginas, falhas } = await carregarDeclaracoesAction(["mat-ana", "mat-bruno"], "modelo-1");

    expect(paginas).toHaveLength(0);
    expect(falhas).toHaveLength(2);
    expect(falhas.map((f) => f.nome).sort()).toEqual(["ANA", "BRUNO"]);
    expect(falhas[0].motivo).toMatch(/credenciamento/i);
  });

  it("exceção ao buscar dados de um aluno não interrompe os demais e aparece em falhas", async () => {
    mockBuscarDadosDeclaracao.mockImplementation(async (matriculaId: string) => {
      if (matriculaId === "mat-ana") throw new Error("Aluno sem série vinculada");
      if (matriculaId === "mat-bruno") return dadosPara("BRUNO", "2026-002");
      throw new Error("matrícula inesperada");
    });

    const { paginas, falhas } = await carregarDeclaracoesAction(["mat-ana", "mat-bruno"], "modelo-1");

    expect(paginas).toHaveLength(1);
    expect(paginas[0].corpo).toContain("BRUNO");
    expect(falhas).toHaveLength(1);
    expect(falhas[0].motivo).toBe("Aluno sem série vinculada");
  });

  it("com overrides (emissão de 1 aluno), aplica o texto editado para esse único aluno", async () => {
    mockBuscarDadosDeclaracao.mockResolvedValue(dadosPara("ANA", "2026-001"));

    const { paginas } = await carregarDeclaracoesAction(["mat-ana"], "modelo-1", {
      titulo: "TÍTULO EDITADO",
      texto: "Texto totalmente reescrito na pré-visualização.",
      fecho: "Fecho editado"
    });

    expect(paginas).toHaveLength(1);
    expect(paginas[0].titulo).toBe("TÍTULO EDITADO");
    expect(paginas[0].corpo).toBe("Texto totalmente reescrito na pré-visualização.");
    expect(paginas[0].fecho).toBe("Fecho editado");
  });
});

describe("previsualizarDeclaracaoAction", () => {
  beforeEach(() => {
    mockRequirePermission.mockClear();
    mockGetDeclaracaoModeloById.mockReset().mockResolvedValue(modelo);
  });

  it("checa a permissao historico/read antes de resolver a pré-visualização", async () => {
    mockBuscarDadosDeclaracao.mockResolvedValue(dadosPara("ANA", "2026-001"));
    await previsualizarDeclaracaoAction("mat-ana", "modelo-1");
    expect(mockRequirePermission).toHaveBeenCalledWith("historico", "read");
  });
});
