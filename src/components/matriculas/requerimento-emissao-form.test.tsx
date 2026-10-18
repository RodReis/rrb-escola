// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockPrevisualizar = vi.fn();
const mockCarregar = vi.fn();
vi.mock("@/lib/actions/requerimento-matricula", () => ({
  carregarRequerimentosAction: (...args: unknown[]) => mockCarregar(...args),
  previsualizarRequerimentoAction: (...args: unknown[]) => mockPrevisualizar(...args)
}));

vi.mock("@/lib/documents/requerimento-matricula-pdf", () => ({
  renderRequerimentos: vi.fn(() => ({ save: vi.fn() }))
}));

const mockCarregarImagens = vi.fn().mockResolvedValue(new Map());
vi.mock("@/lib/documents/pdf-utils", () => ({
  carregarImagens: (...args: unknown[]) => mockCarregarImagens(...args)
}));

let mockSearchParams = new URLSearchParams();
const listeners = new Set<() => void>();
vi.mock("next/navigation", async () => {
  const React = await import("react");
  return {
    useRouter: () => ({
      push: (url: string) => {
        const query = url.split("?")[1] ?? "";
        mockSearchParams = new URLSearchParams(query);
        listeners.forEach((l) => l());
      }
    }),
    useSearchParams: () =>
      React.useSyncExternalStore(
        (onStoreChange) => {
          listeners.add(onStoreChange);
          return () => listeners.delete(onStoreChange);
        },
        () => mockSearchParams
      )
  };
});

import { RequerimentoEmissaoForm } from "./requerimento-emissao-form";

const dadosFake = {
  aluno: {
    matricula: "1754",
    nome: "Ana",
    sexo: "Feminino",
    dataNascimento: "2017-01-31",
    naturalidade: "GOIÂNIA-GO",
    telefones: null,
    endereco: null,
    cpf: null,
    rg: null,
    etnia: null,
    religiao: null
  },
  pai: null,
  mae: null,
  matricula: {
    anoLetivo: 2027,
    serieId: "serie-1",
    serie: "5º ANO",
    turma: "A",
    turno: "Matutino",
    tipoEnsino: "Ensino Fundamental",
    dataMatricula: "2026-10-16"
  },
  responsavelFinanceiro: { nome: "Ana Paula", cpfOuCnpj: "043", parentesco: "Mãe" }
};

describe("RequerimentoEmissaoForm", () => {
  beforeEach(() => {
    mockPrevisualizar.mockReset();
    mockCarregar.mockReset();
    mockCarregarImagens.mockClear().mockResolvedValue(new Map());
    mockSearchParams = new URLSearchParams();
    listeners.clear();
  });

  it("mostra o botão Emitir desabilitado sem nenhum aluno elegível", () => {
    render(<RequerimentoEmissaoForm anoLetivo={2027} series={[]} turmas={[]} alunosElegiveis={[]} />);
    expect(screen.getByRole("button", { name: /emitir/i })).toBeDisabled();
  });

  it("monta a URL pública da logo (companyLogoUrl) antes de carregarImagens, não o logo_path cru (bug I1 da revisão)", async () => {
    const { companyLogoUrl } = await import("@/lib/storage/company-logo-url");
    mockCarregar.mockResolvedValue({
      paginas: [{ escola: { logoPath: "escola-1/logo.png" } }],
      falhas: []
    });
    render(
      <RequerimentoEmissaoForm
        anoLetivo={2027}
        series={[]}
        turmas={[]}
        alunosElegiveis={[{ matriculaId: "m1", alunoId: "a1", nome: "Ana" }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /emitir/i }));

    await waitFor(() => {
      expect(mockCarregarImagens).toHaveBeenCalled();
    });
    const urlsCarregadas = mockCarregarImagens.mock.calls[0][0] as Array<string | null>;
    expect(urlsCarregadas).toContain(companyLogoUrl("escola-1/logo.png"));
    expect(urlsCarregadas).not.toContain("escola-1/logo.png");
  });

  it("sem aluno selecionado, emite para todos os elegíveis (modo coletivo)", async () => {
    mockCarregar.mockResolvedValue({ paginas: [], falhas: [] });
    render(
      <RequerimentoEmissaoForm
        anoLetivo={2027}
        series={[]}
        turmas={[]}
        alunosElegiveis={[
          { matriculaId: "m1", alunoId: "a1", nome: "Ana" },
          { matriculaId: "m2", alunoId: "a2", nome: "Beto" }
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /emitir/i }));

    await waitFor(() => {
      expect(mockCarregar).toHaveBeenCalledWith(["m1", "m2"], null);
    });
    expect(mockPrevisualizar).not.toHaveBeenCalled();
  });

  it("com aluno selecionado, mostra preview antes de habilitar emitir (modo individual)", async () => {
    mockPrevisualizar.mockResolvedValue(dadosFake);
    render(
      <RequerimentoEmissaoForm
        anoLetivo={2027}
        series={[]}
        turmas={[]}
        alunosElegiveis={[{ matriculaId: "m1", alunoId: "a1", nome: "Ana" }]}
      />
    );

    fireEvent.change(screen.getByLabelText(/^aluno$/i), { target: { value: "a1" } });

    await waitFor(() => {
      expect(mockPrevisualizar).toHaveBeenCalledWith("m1");
    });
    await waitFor(() => {
      expect(screen.getAllByText(dadosFake.aluno.nome).length).toBeGreaterThan(0);
    });
  });

  it("observações preenchidas vão junto no payload de carregarRequerimentosAction", async () => {
    mockCarregar.mockResolvedValue({ paginas: [], falhas: [] });
    render(
      <RequerimentoEmissaoForm
        anoLetivo={2027}
        series={[]}
        turmas={[]}
        alunosElegiveis={[{ matriculaId: "m1", alunoId: "a1", nome: "Ana" }]}
      />
    );

    fireEvent.change(screen.getByLabelText(/observações/i), { target: { value: "Conferido na secretaria." } });
    fireEvent.click(screen.getByRole("button", { name: /emitir/i }));

    await waitFor(() => {
      expect(mockCarregar).toHaveBeenCalledWith(["m1"], "Conferido na secretaria.");
    });
  });

  it("preview bloqueado quando o aluno não tem responsável financeiro", async () => {
    mockPrevisualizar.mockRejectedValue(new Error("Responsável financeiro não cadastrado para este aluno."));
    render(
      <RequerimentoEmissaoForm
        anoLetivo={2027}
        series={[]}
        turmas={[]}
        alunosElegiveis={[{ matriculaId: "m1", alunoId: "a1", nome: "Ana" }]}
      />
    );

    fireEvent.change(screen.getByLabelText(/^aluno$/i), { target: { value: "a1" } });

    await waitFor(() => {
      expect(screen.getByText(/responsável financeiro/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /emitir/i })).toBeDisabled();
  });
});
